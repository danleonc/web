import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Storage, digest } from "./storage.ts";
const lifetime = 4 * 60 * 60_000;
export const accountCookie = "entre_session";
export const readToken = (req: IncomingMessage, name: string) =>
  (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${name}=`))
    ?.slice(name.length + 1);
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (e, key) => (e ? reject(e) : resolve(key)),
    ),
  );
const dummy = "0".repeat(128);
let hashing = 0;
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password, salt)).toString("hex")}`;
}
async function passwordMatches(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  return timingSafeEqual(await derive(password, salt), Buffer.from(key, "hex"));
}
export function cookie(
  res: ServerResponse,
  token: string,
  secure: boolean,
  clear = false,
) {
  res.setHeader(
    "Set-Cookie",
    `${accountCookie}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${clear ? 0 : lifetime / 1000}${secure ? "; Secure" : ""}`,
  );
}
export class Auth {
  readonly storage: Storage;
  readonly secure: boolean;
  readonly now: () => number;
  constructor(storage: Storage, secure: boolean, now: () => number) {
    this.storage = storage;
    this.secure = secure;
    this.now = now;
  }
  async action(
    path: string,
    value: Record<string, unknown>,
    req: IncomingMessage,
    res: ServerResponse,
  ) {
    const keys = Object.keys(value);
    if (path === "logout") {
      if (keys.length)
        return { status: 422, body: { error: "invalid_fields" } };
      const token = readToken(req, accountCookie);
      if (token) this.storage.revoke(digest(token));
      cookie(res, "", this.secure, true);
      return {
        status: 200,
        body: { ok: true },
        revoked: token ? digest(token) : undefined,
      };
    }
    if (!["register", "login", "recover"].includes(path))
      return { status: 404, body: { error: "not_found" } };
    const expected =
      path === "register"
        ? ["username", "alias", "password", "adult"]
        : path === "login"
          ? ["username", "password"]
          : ["username", "password", "recoveryCode"];
    if (
      keys.some((k) => !expected.includes(k)) ||
      typeof value.username !== "string" ||
      !/^[a-zA-Z0-9_]{3,30}$/.test(value.username) ||
      typeof value.password !== "string" ||
      value.password.length < 12 ||
      value.password.length > 128
    )
      return { status: 422, body: { error: "invalid_credentials_format" } };
    if (
      path === "register" &&
      (typeof value.alias !== "string" ||
        !value.alias.trim() ||
        value.alias.trim().length > 30 ||
        /[\u0000-\u001f]/.test(value.alias) ||
        value.adult !== true)
    )
      return { status: 422, body: { error: "invalid_profile" } };
    if (
      path === "recover" &&
      (typeof value.recoveryCode !== "string" ||
        value.recoveryCode.length > 128)
    )
      return { status: 422, body: { error: "invalid_recovery" } };
    const username = value.username.toLowerCase();
    const ip = req.socket.remoteAddress || "local";
    if (
      !this.storage.takeLimit(
        digest(`ip:${ip}`),
        30,
        10 * 60_000,
        this.now(),
      ) ||
      !this.storage.takeLimit(
        digest(`user:${username}`),
        10,
        15 * 60_000,
        this.now(),
      )
    )
      return { status: 429, body: { error: "too_many_attempts" } };
    if (hashing >= 4) return { status: 503, body: { error: "try_later" } };
    hashing++;
    try {
      const account = this.storage.account(username);
      let id = account?.id;
      let alias = account?.alias;
      let recoveryCode: string | undefined;
      if (path === "login") {
        const valid = await passwordMatches(
          value.password,
          account?.passwordHash || `${"0".repeat(32)}:${dummy}`,
        );
        if (
          !account ||
          !valid ||
          this.storage.account(username)?.passwordHash !== account.passwordHash
        )
          return { status: 401, body: { error: "invalid_credentials" } };
      } else if (path === "register") {
        if (account)
          return { status: 409, body: { error: "username_unavailable" } };
        const hash = await passwordHash(value.password);
        // Re-check after async hashing; another registration may have claimed the name.
        if (this.storage.account(username))
          return { status: 409, body: { error: "username_unavailable" } };
        id = randomUUID();
        alias = (value.alias as string).trim();
        recoveryCode = randomBytes(32).toString("hex");
        this.storage.createAccount(
          {
            id,
            username,
            alias,
            passwordHash: hash,
            recoveryHash: digest(recoveryCode),
          },
          this.now(),
        );
      } else {
        const supplied = digest(
          (value.recoveryCode as string).replace(/[-\s]/g, ""),
        );
        const valid = timingSafeEqual(
          Buffer.from(supplied, "hex"),
          Buffer.from(account?.recoveryHash || "0".repeat(64), "hex"),
        );
        // Always do expensive work, including on invalid or unknown recovery requests.
        const hash = await passwordHash(value.password);
        if (
          !account ||
          !valid ||
          this.storage.account(username)?.recoveryHash !== supplied
        )
          return { status: 401, body: { error: "invalid_credentials" } };
        recoveryCode = randomBytes(32).toString("hex");
        this.storage.recover(account.id, hash, digest(recoveryCode));
      }
      const old = readToken(req, accountCookie);
      if (old) this.storage.revoke(digest(old));
      const token = randomBytes(32).toString("hex");
      this.storage.createSession(token, id!, this.now() + lifetime);
      cookie(res, token, this.secure);
      return {
        status: path === "register" ? 201 : 200,
        body: {
          id: id!,
          alias: alias!,
          ...(recoveryCode
            ? { recoveryCode: recoveryCode.match(/.{1,8}/g)!.join("-") }
            : {}),
        },
        revoked: old ? digest(old) : undefined,
        recovered: path === "recover" ? id : undefined,
      };
    } finally {
      hashing--;
    }
  }
}
