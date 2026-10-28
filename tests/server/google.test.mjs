import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRoomServer } from "../../server/app.ts";
import { Storage, digest } from "../../server/storage.ts";
import { googleFromEnv } from "../../server/google.ts";
import { mockGoogle, mockGoogleCode } from "./mock-google.mjs";
async function fixture(t, enabled = true, secure = false) {
  const dir = await mkdtemp(join(tmpdir(), "afinia-google-")),
    path = join(dir, "google.sqlite"),
    origin = secure ? "https://afinia.example" : "http://localhost:4173";
  let now = Date.now(),
    app,
    base;
  const google = await mockGoogle(origin, () => now),
    mails = new Map();
  async function start() {
    app = createRoomServer({
      databasePath: path,
      secureCookies: secure,
      allowedOrigins: [origin],
      google: enabled ? google : undefined,
      now: () => now,
      enforceSchedule: false,
      sendVerificationEmail: async (e, c) => mails.set(e, c),
    });
    app.server.listen(0, "127.0.0.1");
    await once(app.server, "listening");
    base = `http://127.0.0.1:${app.server.address().port}`;
  }
  await start();
  t.after(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });
  async function req(route, body, cookie = "", method = "POST", from = origin) {
    const r = await fetch(base + route, {
      method,
      redirect: "manual",
      headers: {
        Origin: from,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: method === "GET" ? undefined : JSON.stringify(body || {}),
    });
    const text = await r.text();
    return {
      status: r.status,
      body: text ? JSON.parse(text) : null,
      location: r.headers.get("location"),
      cookies: r.headers.getSetCookie().map((c) => c.split(";")[0]),
      headers: r.headers,
    };
  }
  async function begin(cookie = "", intent = "login", returnTo = "#plaza") {
    return req("/api/auth/google-start", { intent, returnTo }, cookie);
  }
  async function callback(
    start,
    overrides = {},
    cookies = start.cookies.join("; "),
  ) {
    const url = new URL(start.body.authorizationUrl);
    return req(
      "/api/auth/google-callback?" +
        new URLSearchParams({
          state: url.searchParams.get("state"),
          code: mockGoogleCode(url, overrides),
        }),
      null,
      cookies,
      "GET",
    );
  }
  const authCookie = (r) =>
    r.cookies.find((c) => c.startsWith("entre_session="));
  async function local(name = "luz", email = "person@gmail.com") {
    const a = await req("/api/auth/register", {
      username: name,
      alias: name,
      adult: true,
      password: "Una frase de prueba para Google 123",
    });
    const cookie = authCookie(a);
    await req("/api/auth/email-code", { email, adult: true }, cookie);
    assert.equal(
      (await req("/api/auth/confirm-email", { code: mails.get(email) }, cookie))
        .status,
      200,
    );
    return { ...a, cookie };
  }
  return {
    path,
    origin,
    google,
    mails,
    req,
    begin,
    callback,
    authCookie,
    local,
    advance(ms) {
      now += ms;
    },
    async restart() {
      await app.close();
      await start();
    },
  };
}
test("Google sin configurar no expone credenciales ni habilita un acceso ficticio; inicio exige origen e impide redirecciones externas", async (t) => {
  const f = await fixture(t, false);
  assert.deepEqual((await f.req("/api/auth/options", null, "", "GET")).body, {
    google: false,
  });
  assert.equal((await f.begin()).status, 503);
  assert.equal(googleFromEnv({}, f.origin), undefined);
  assert.throws(() =>
    googleFromEnv({ ENTRE_GOOGLE_CLIENT_ID: "solo-id" }, f.origin),
  );
});
test("Google crea cuenta pendiente de alias/18+, confirma Gmail y conserva sesión y sujeto tras reiniciar sin contraseña local", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (
      await f.req("/api/auth/google-start", {
        intent: "login",
        returnTo: "https://otro.test",
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await f.req(
        "/api/auth/google-start",
        { intent: "login", returnTo: "#plaza" },
        "",
        "POST",
        "https://otro.test",
      )
    ).status,
    403,
  );
  const s = await f.begin(),
    url = new URL(s.body.authorizationUrl);
  assert.equal(url.searchParams.get("scope"), "openid email");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(
    s.headers.get("set-cookie").includes("HttpOnly; SameSite=Lax"),
    true,
  );
  const r = await f.callback(s);
  assert.equal(r.status, 303);
  assert.match(r.location, /google=success#plaza$/);
  const cookie = f.authCookie(r),
    self = (await f.req("/api/session", null, cookie, "GET")).body;
  assert.equal(self.emailConfirmed, true);
  assert.equal(self.canParticipate, false);
  assert.equal(self.needsGoogleProfile, true);
  assert.equal(self.passwordEnabled, false);
  assert.equal(self.alias, "Participante");
  assert.equal((await f.req("/api/reservations/cafe", {}, cookie)).status, 403);
  assert.equal(
    (
      await f.req(
        "/api/auth/google-complete",
        { alias: "Sol", adult: false },
        cookie,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await f.req(
        "/api/auth/google-complete",
        { alias: "Sol", adult: true },
        cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await f.req("/api/session", null, cookie, "GET")).body.canParticipate,
    true,
  );
  const db = new Storage(f.path),
    account = db.accountById(self.id);
  db.close();
  assert.equal(
    (
      await f.req("/api/auth/login", {
        username: account.username,
        password: "Una contraseña local larga 123",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.req("/api/auth/recover", {
        username: account.username,
        password: "Otra contraseña local larga 123",
        recoveryCode: "0".repeat(64),
      })
    ).status,
    401,
  );
  await f.restart();
  const again = await f.callback(await f.begin());
  assert.equal(
    (await f.req("/api/session", null, f.authCookie(again), "GET")).body.id,
    self.id,
  );
});
test("Google exige state/cookie concordantes, flujo vigente y de un uso; cancelación no crea sesión", async (t) => {
  const f = await fixture(t),
    s = await f.begin();
  const wrong = await f.callback(s, {}, "");
  assert.match(wrong.location, /google=expired/);
  assert.equal(f.authCookie(wrong), undefined);
  const valid = await f.callback(s);
  assert.ok(f.authCookie(valid));
  assert.match((await f.callback(s)).location, /google=expired/);
  const cancelled = await f.begin(),
    url = new URL(cancelled.body.authorizationUrl);
  const cancel = await f.req(
    "/api/auth/google-callback?" +
      new URLSearchParams({
        state: url.searchParams.get("state"),
        error: "access_denied",
      }),
    null,
    cancelled.cookies.join("; "),
    "GET",
  );
  assert.match(cancel.location, /google=cancelled/);
  assert.equal(f.authCookie(cancel), undefined);
  const expired = await f.begin();
  f.advance(600_001);
  assert.match((await f.callback(expired)).location, /google=expired/);
});
test("Google valida firma, emisor, audiencia, nonce, vencimiento y correo; no confía en claims enviados por cliente", async (t) => {
  const f = await fixture(t);
  for (const overrides of [
    { wrongKey: true },
    { claims: { iss: "https://attacker.test" } },
    { claims: { aud: "other-client" } },
    { nonce: "wrong-nonce" },
    { claims: { exp: 1 } },
    { claims: { email_verified: false } },
    { claims: { iat: 1 } },
    { claims: { azp: "wrong-client" } },
  ]) {
    const r = await f.callback(await f.begin(), overrides);
    assert.equal(f.authCookie(r), undefined);
    assert.match(r.location, /google=(invalid|failed)/);
  }
  assert.equal(
    (
      await f.req("/api/auth/google-start", {
        intent: "login",
        returnTo: "#plaza",
        emailConfirmed: true,
      })
    ).status,
    422,
  );
});
test("Google no fusiona por correo: vinculación requiere sesión confirmada, mismo correo y sujeto libre", async (t) => {
  const f = await fixture(t),
    local = await f.local();
  const collision = await f.callback(await f.begin());
  assert.match(collision.location, /google=account_exists/);
  assert.equal(f.authCookie(collision), undefined);
  assert.equal((await f.begin("", "link")).status, 403);
  const s = await f.begin(local.cookie, "link", "#connections");
  const linked = await f.callback(s);
  assert.match(linked.location, /google=linked#connections/);
  assert.equal(
    (await f.req("/api/session", null, local.cookie, "GET")).body.googleLinked,
    true,
  );
  const login = await f.callback(await f.begin());
  assert.equal(
    (await f.req("/api/session", null, f.authCookie(login), "GET")).body.id,
    local.body.id,
  );
  const other = await f.local("otra", "other@gmail.com"),
    conflict = await f.callback(await f.begin(other.cookie, "link"));
  assert.match(conflict.location, /google=link_conflict/);
});
test("Google rechaza vinculación tras cerrar sesión; correos externos requieren confirmación propia y no admiten cambio silencioso", async (t) => {
  const f = await fixture(t),
    local = await f.local(),
    link = await f.begin(local.cookie, "link");
  await f.req("/api/auth/logout", {}, local.cookie);
  assert.match((await f.callback(link)).location, /google=link_expired/);
  const r = await f.callback(await f.begin(), {
      sub: "external-subject",
      email: "user@example.test",
    }),
    cookie = f.authCookie(r);
  await f.req(
    "/api/auth/google-complete",
    { alias: "Otra", adult: true },
    cookie,
  );
  const user = (await f.req("/api/session", null, cookie, "GET")).body;
  assert.equal(user.emailConfirmed, false);
  assert.equal(user.canParticipate, false);
  assert.equal(
    (
      await f.req(
        "/api/auth/email-code",
        { email: "another@example.test", adult: true },
        cookie,
      )
    ).status,
    422,
  );
});
test("Google mantiene sanciones y su identidad vinculada; un fallo del proveedor no crea cuenta ni sesión", async (t) => {
  const f = await fixture(t),
    failed = await f.callback(await f.begin(), { fail: true });
  assert.match(failed.location, /google=failed/);
  assert.equal(f.authCookie(failed), undefined);
  const r = await f.callback(await f.begin()),
    cookie = f.authCookie(r),
    id = (await f.req("/api/session", null, cookie, "GET")).body.id;
  await f.req(
    "/api/auth/google-complete",
    { alias: "Luz", adult: true },
    cookie,
  );
  const db = new Storage(f.path);
  db.db
    .prepare("INSERT INTO restrictions VALUES(?,?,?,?,?)")
    .run(id, "ban", "Motivo de prueba", null, "test-action");
  db.close();
  const retry = await f.callback(await f.begin()),
    current = f.authCookie(retry),
    self = (await f.req("/api/session", null, current, "GET")).body;
  assert.equal(self.id, id);
  assert.equal(self.restriction.kind, "ban");
  assert.equal(self.canParticipate, false);
  assert.equal(
    (await f.req("/api/reservations/cafe", {}, current)).status,
    403,
  );
});

test("Google en HTTPS usa una cookie de navegador __Host, host-only y Secure para evitar fijación desde subdominios", async (t) => {
  const f = await fixture(t, true, true),
    start = await f.begin();
  const header = start.headers.get("set-cookie");
  assert.match(header, /^__Host-afinia_google_flow=/);
  assert.match(header, /Path=\//);
  assert.match(header, /Secure/);
  assert.equal(header.includes("Domain="), false);
  assert.ok(f.authCookie(await f.callback(start)));
});
