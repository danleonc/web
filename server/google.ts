import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { cookie, accountCookie, readToken } from "./auth.ts";
import { Storage, digest } from "./storage.ts";

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  publicOrigin: string;
  // Test-only transport injection; endpoints and JWT validation remain fixed.
  fetch?: typeof fetch;
};
const callbackPath = "/api/auth/google-callback";
const localFlowCookieName = "afinia_google_flow";
const returns = new Set([
  "#plaza",
  "#discover",
  "#connections",
  "#agenda",
  "#profile",
  "#shared",
]);
const failure = (status: number, error: string) => ({
  status,
  body: { error },
});
type Flow = {
  browserHash: string;
  verifier: string;
  nonceHash: string;
  expiresAt: number;
  intent: "login" | "link";
  sessionHash: string | null;
  accountId: string | null;
  returnTo: string;
};

export function googleFromEnv(
  env: NodeJS.ProcessEnv,
  publicOrigin: string,
): GoogleConfig | undefined {
  if (!env.ENTRE_GOOGLE_CLIENT_ID && !env.ENTRE_GOOGLE_CLIENT_SECRET)
    return undefined;
  if (!env.ENTRE_GOOGLE_CLIENT_ID || !env.ENTRE_GOOGLE_CLIENT_SECRET)
    throw Error("Configura ID y secreto del cliente OAuth web de Google.");
  return {
    clientId: env.ENTRE_GOOGLE_CLIENT_ID,
    clientSecret: env.ENTRE_GOOGLE_CLIENT_SECRET,
    publicOrigin,
  };
}

export class GoogleAuth {
  private storage: Storage;
  private now: () => number;
  private config: GoogleConfig;
  private secure: boolean;
  private restricted: (id: string) => boolean;
  private fetcher: typeof fetch;
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  readonly redirectUri: string;
  constructor(
    storage: Storage,
    now: () => number,
    config: GoogleConfig,
    secure: boolean,
    restricted: (id: string) => boolean,
  ) {
    const origin = new URL(config.publicOrigin);
    if (
      origin.origin !== config.publicOrigin ||
      (origin.protocol !== "https:" &&
        !(
          origin.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(origin.hostname)
        )) ||
      origin.username ||
      origin.password ||
      !/^[\w-]+\.apps\.googleusercontent\.com$/.test(config.clientId) ||
      !config.clientSecret ||
      config.clientSecret.length > 4096
    )
      throw Error("Configuración OAuth de Google no válida.");
    if ((origin.protocol === "https:") !== secure)
      throw Error(
        "Las cookies OAuth deben coincidir con HTTPS del origen público.",
      );
    this.storage = storage;
    this.now = now;
    this.config = config;
    this.secure = secure;
    this.restricted = restricted;
    this.fetcher = config.fetch || fetch;
    this.redirectUri = origin.origin + callbackPath;
    this.jwks = createRemoteJWKSet(
      new URL("https://www.googleapis.com/oauth2/v3/certs"),
      { timeoutDuration: 10_000, [customFetch]: this.fetcher },
    );
  }
  private get flowCookieName() {
    return this.secure ? "__Host-afinia_google_flow" : localFlowCookieName;
  }
  private browserCookie(res: ServerResponse, value: string, clear = false) {
    res.appendHeader(
      "Set-Cookie",
      `${this.flowCookieName}=${value}; HttpOnly; SameSite=Lax; Path=${this.secure ? "/" : callbackPath}; Max-Age=${clear ? 0 : 600}${this.secure ? "; Secure" : ""}`,
    );
  }
  start(
    value: Record<string, unknown>,
    req: IncomingMessage,
    res: ServerResponse,
  ) {
    if (
      Object.keys(value).some((k) => !["intent", "returnTo"].includes(k)) ||
      !["login", "link"].includes(String(value.intent)) ||
      typeof value.returnTo !== "string" ||
      !returns.has(value.returnTo)
    )
      return failure(422, "invalid_google_request");
    const token = readToken(req, accountCookie),
      hash = token ? digest(token) : null;
    const session = hash ? this.storage.session(hash, this.now()) : undefined;
    if (
      value.intent === "link" &&
      (!session ||
        !this.storage.canParticipate(session.id) ||
        this.restricted(session.id))
    )
      return failure(403, "google_link_requires_access");
    if (value.intent === "login" && session)
      return failure(409, "google_logout_first");
    const ip = req.socket.remoteAddress || "local";
    if (
      !this.storage.takeLimit(
        digest(`google-start:${ip}`),
        30,
        10 * 60_000,
        this.now(),
      )
    )
      return failure(429, "too_many_attempts");
    this.storage.db
      .prepare("DELETE FROM google_flows WHERE expires_at<=?")
      .run(this.now());
    if (
      Number(
        this.storage.db.prepare("SELECT count(*) AS n FROM google_flows").get()!
          .n,
      ) >= 2000
    )
      return failure(503, "try_later");
    const state = randomBytes(32).toString("hex"),
      browser = randomBytes(32).toString("hex"),
      verifier = randomBytes(32).toString("base64url"),
      nonce = randomBytes(32).toString("hex");
    this.storage.db
      .prepare("INSERT INTO google_flows VALUES(?,?,?,?,?,?,?,?,?)")
      .run(
        digest(state),
        digest(browser),
        verifier,
        digest(nonce),
        this.now() + 600_000,
        value.intent as string,
        value.intent === "link" ? hash : null,
        value.intent === "link" ? session!.id : null,
        value.returnTo,
      );
    this.browserCookie(res, browser);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "openid email",
      state,
      nonce,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return { status: 200, body: { authorizationUrl: url.href } };
  }
  async callback(
    url: URL,
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<{ location: string; revoked?: string }> {
    let flow: Flow | undefined;
    const redirect = (result: string) => ({
      location: `${this.config.publicOrigin}/?google=${result}${flow?.returnTo || "#plaza"}`,
    });
    try {
      for (const key of ["state", "code", "error"])
        if (url.searchParams.getAll(key).length > 1) return redirect("invalid");
      const state = url.searchParams.get("state"),
        browser = readToken(req, this.flowCookieName);
      if (
        !state ||
        !/^[a-f0-9]{64}$/.test(state) ||
        !browser ||
        !/^[a-f0-9]{64}$/.test(browser)
      )
        return redirect("expired");
      flow = this.storage.transaction(() => {
        const row = this.storage.db
          .prepare(
            "SELECT browser_hash AS browserHash,verifier,nonce_hash AS nonceHash,expires_at AS expiresAt,intent,session_hash AS sessionHash,account_id AS accountId,return_to AS returnTo FROM google_flows WHERE state_hash=?",
          )
          .get(digest(state)) as Flow | undefined;
        if (
          !row ||
          row.browserHash !== digest(browser) ||
          row.expiresAt <= this.now()
        )
          return undefined;
        this.storage.db
          .prepare("DELETE FROM google_flows WHERE state_hash=?")
          .run(digest(state));
        return row;
      });
      if (!flow) return redirect("expired");
      if (url.searchParams.has("error"))
        return redirect(
          url.searchParams.get("error") === "access_denied"
            ? "cancelled"
            : "failed",
        );
      const code = url.searchParams.get("code");
      if (!code || code.length > 4096) return redirect("invalid");
      const response = await this.fetcher(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            redirect_uri: this.redirectUri,
            grant_type: "authorization_code",
            code,
            code_verifier: flow.verifier,
          }),
        },
      );
      if (!response.ok) return redirect("failed");
      const token = (await response.json()) as { id_token?: unknown };
      if (typeof token.id_token !== "string" || token.id_token.length > 16_384)
        return redirect("invalid");
      const { payload } = await jwtVerify(token.id_token, this.jwks, {
        algorithms: ["RS256"],
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: this.config.clientId,
        requiredClaims: [
          "exp",
          "iat",
          "sub",
          "nonce",
          "email",
          "email_verified",
        ],
        currentDate: new Date(this.now()),
        clockTolerance: 5,
      });
      if (
        typeof payload.sub !== "string" ||
        !payload.sub ||
        payload.sub.length > 255 ||
        typeof payload.nonce !== "string" ||
        digest(payload.nonce) !== flow.nonceHash ||
        payload.email_verified !== true ||
        typeof payload.email !== "string" ||
        (payload.azp !== undefined && payload.azp !== this.config.clientId) ||
        (Array.isArray(payload.aud) &&
          payload.aud.length > 1 &&
          payload.azp !== this.config.clientId) ||
        typeof payload.iat !== "number" ||
        payload.iat > this.now() / 1000 + 5 ||
        this.now() / 1000 - payload.iat > 600
      )
        return redirect("invalid");
      const email = payload.email.trim().toLowerCase();
      if (
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        /[\u0000-\u001f]/.test(email)
      )
        return redirect("invalid");
      const trustedEmail =
        email.endsWith("@gmail.com") ||
        (typeof payload.hd === "string" && !!payload.hd.trim());
      const outcome = this.storage.transaction(() => {
        const existing = this.storage.db
          .prepare("SELECT user_id AS id FROM account_google WHERE subject=?")
          .get(payload.sub!) as { id: string } | undefined;
        if (flow!.intent === "link") {
          const owner = flow!.sessionHash
            ? this.storage.session(flow!.sessionHash, this.now())
            : undefined;
          if (
            !owner ||
            owner.id !== flow!.accountId ||
            !this.storage.canParticipate(owner.id) ||
            this.restricted(owner.id)
          )
            return { error: "link_expired" };
          if (existing && existing.id !== owner.id)
            return { error: "link_conflict" };
          const prior = this.storage.googleIdentity(owner.id);
          if (
            (prior && prior.subject !== payload.sub) ||
            this.storage.emailStatus(owner.id)?.email !== email
          )
            return { error: "link_conflict" };
          this.storage.db
            .prepare("INSERT OR IGNORE INTO account_google VALUES(?,?,1,?)")
            .run(owner.id, payload.sub!, this.now());
          return { linked: true };
        }
        if (existing) {
          if (this.storage.emailStatus(existing.id)?.email !== email)
            return { error: "email_changed" };
          return { id: existing.id };
        }
        if (
          this.storage.db
            .prepare(
              "SELECT 1 FROM account_emails WHERE email=? AND verified_at IS NOT NULL",
            )
            .get(email)
        )
          return { error: "account_exists" };
        const id = randomUUID();
        this.storage.createAccount(
          {
            id,
            username: `g_${randomBytes(12).toString("hex")}`,
            alias: "Participante",
            passwordHash: "google-only",
            recoveryHash: digest(randomBytes(32).toString("hex")),
          },
          this.now(),
        );
        this.storage.db
          .prepare("INSERT INTO account_google VALUES(?,?,0,?)")
          .run(id, payload.sub!, this.now());
        this.storage.db
          .prepare(
            "INSERT INTO account_emails(user_id,email,verified_at,adult_declared_at) VALUES(?,?,?,0)",
          )
          .run(id, email, trustedEmail ? this.now() : null);
        return { id };
      });
      if (outcome.error) return redirect(outcome.error);
      if (outcome.linked) return redirect("linked");
      const old = readToken(req, accountCookie),
        revoked = old ? digest(old) : undefined;
      if (revoked) this.storage.revoke(revoked);
      const session = randomBytes(32).toString("hex");
      this.storage.createSession(
        session,
        outcome.id!,
        this.now() + 4 * 60 * 60_000,
      );
      cookie(res, session, this.secure);
      return { ...redirect("success"), revoked };
    } catch {
      return redirect("failed");
    } finally {
      if (flow) this.browserCookie(res, "", true);
    }
  }
  complete(value: Record<string, unknown>, id: string) {
    if (
      Object.keys(value).some((k) => !["alias", "adult"].includes(k)) ||
      value.adult !== true ||
      typeof value.alias !== "string" ||
      !value.alias.trim() ||
      value.alias.trim().length > 30 ||
      /[\u0000-\u001f]/.test(value.alias)
    )
      return failure(422, "invalid_profile");
    return this.storage.transaction(() => {
      if (
        !this.storage.googleIdentity(id) ||
        this.storage.googleIdentity(id)!.profileComplete !== 0 ||
        this.restricted(id)
      )
        return failure(403, "google_profile_unavailable");
      this.storage.db
        .prepare("UPDATE accounts SET alias=? WHERE id=?")
        .run((value.alias as string).trim(), id);
      this.storage.db
        .prepare(
          "UPDATE account_emails SET adult_declared_at=? WHERE user_id=?",
        )
        .run(this.now(), id);
      this.storage.db
        .prepare("UPDATE account_google SET profile_complete=1 WHERE user_id=?")
        .run(id);
      return { status: 200, body: { ok: true } };
    });
  }
}
