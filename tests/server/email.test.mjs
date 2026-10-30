import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WebSocket } from "ws";
import { createRoomServer } from "../../server/app.ts";
import { Storage } from "../../server/storage.ts";
import { smtpMailer } from "../../server/email.ts";
async function setup(t, delivery = true) {
  const dir = await mkdtemp(join(tmpdir(), "afinia-email-")),
    path = join(dir, "db.sqlite"),
    origin = "http://localhost:4173",
    mails = new Map();
  let clock = Date.now(),
    app,
    base;
  async function start() {
    app = createRoomServer({
      databasePath: path,
      allowedOrigins: [origin],
      now: () => clock,
      enforceSchedule: false,
      sendVerificationEmail:
        delivery === true
          ? async (email, code) => {
              mails.set(email, code);
            }
          : delivery || undefined,
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
      headers: {
        Origin: from,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: method === "GET" ? undefined : JSON.stringify(body || {}),
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function signup(name = "luz") {
    const r = await req("/api/auth/register", {
      username: name,
      alias: name,
      adult: true,
      password: "Una frase de prueba para Nexafia 123",
    });
    assert.equal(r.status, 201);
    return r;
  }
  async function send(user, email = "luz@example.test") {
    return req("/api/auth/email-code", { email, adult: true }, user.cookie);
  }
  async function confirm(user, code) {
    return req("/api/auth/confirm-email", { code }, user.cookie);
  }
  async function session(user) {
    return req("/api/session", null, user.cookie, "GET");
  }
  return {
    path,
    mails,
    req,
    signup,
    send,
    confirm,
    session,
    advance(ms) {
      clock += ms;
    },
    async restart() {
      await app.close();
      await start();
    },
    async deniedSocket(user) {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(
          base.replace("http:", "ws:") + "/api/rooms/cafe",
          { headers: { Origin: origin, Cookie: user.cookie } },
        );
        ws.on("error", () => {});
        ws.on("unexpected-response", (_, r) => {
          r.resume();
          resolve(r.statusCode);
        });
        ws.on("open", () => {
          ws.terminate();
          reject(Error("Se abrió una sala sin confirmar correo"));
        });
      });
    },
  };
}
test("correo: visitante y cuenta pendiente no pueden mutar ni abrir WebSocket; no hay autoconfirmación", async (t) => {
  const f = await setup(t, false),
    u = await f.signup();
  assert.equal((await f.session(u)).body.canParticipate, false);
  assert.equal((await f.req("/api/reservations/cafe", {})).status, 401);
  for (const route of [
    "/api/reservations/cafe",
    "/api/rooms/ajena/media",
    "/api/rooms/ajena/reports",
    "/api/moderation/actions",
  ])
    assert.equal((await f.req(route, {}, u.cookie)).status, 403);
  assert.equal(await f.deniedSocket(u), 403);
  assert.equal((await f.send(u)).status, 503);
  assert.equal((await f.session(u)).body.emailConfirmed, false);
  assert.equal(
    (
      await f.req("/api/auth/register", {
        username: "falso",
        alias: "Falso",
        adult: true,
        password: "Una clave larga de prueba 123",
        emailConfirmed: true,
      })
    ).status,
    422,
  );
});
test("correo: código de un uso, declaración explícita, origen y privacidad de la dirección", async (t) => {
  const f = await setup(t),
    u = await f.signup();
  assert.equal(
    (
      await f.req(
        "/api/auth/email-code",
        { email: "luz@example.test", adult: false },
        u.cookie,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await f.req(
        "/api/auth/email-code",
        { email: "luz@example.test", adult: true, id: "ajena" },
        u.cookie,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await f.req(
        "/api/auth/email-code",
        { email: "luz@example.test", adult: true },
        u.cookie,
        "POST",
        "https://otro.test",
      )
    ).status,
    403,
  );
  const sent = await f.send(u);
  assert.equal(sent.status, 200);
  assert.deepEqual(sent.body, { ok: true });
  const code = f.mails.get("luz@example.test");
  assert.match(code, /^\d{8}$/);
  const other = await f.signup("sol");
  assert.equal((await f.confirm(other, code)).status, 422);
  const outcomes = await Promise.all([f.confirm(u, code), f.confirm(u, code)]);
  assert.deepEqual(outcomes.map((x) => x.status).sort(), [200, 422]);
  const s = await f.session(u);
  assert.equal(s.body.email, "luz@example.test");
  assert.equal(s.body.canParticipate, true);
  assert.equal(s.body.adultDeclared, true);
  assert.equal(s.body.identityVerified, undefined);
  assert.equal((await f.session(other)).body.email, "");
  assert.equal(
    (await f.req("/api/reservations/cafe", {}, u.cookie)).status,
    200,
  );
  const db = new Storage(f.path);
  assert.equal(db.emailStatus(u.body.id).codeHash, null);
  db.close();
});
test("correo: cinco intentos, reenvío con espera, invalidación del código anterior y caducidad", async (t) => {
  const f = await setup(t),
    u = await f.signup();
  await f.send(u);
  const old = f.mails.get("luz@example.test");
  const bad = old === "00000000" ? "11111111" : "00000000";
  for (let i = 0; i < 5; i++)
    assert.equal((await f.confirm(u, bad)).status, 422);
  assert.equal((await f.confirm(u, old)).status, 422);
  assert.equal((await f.send(u)).status, 429);
  f.advance(60_001);
  await f.send(u);
  let next = f.mails.get("luz@example.test");
  assert.equal((await f.confirm(u, old)).status, 422);
  f.advance(600_001);
  assert.equal((await f.confirm(u, next)).status, 422);
  assert.equal((await f.session(u)).body.canParticipate, false);
  await f.send(u);
  next = f.mails.get("luz@example.test");
  assert.equal((await f.confirm(u, next)).status, 200);
});
test("correo: pendientes no reservan una dirección; una dirección confirmada no se puede tomar desde otra cuenta", async (t) => {
  const f = await setup(t),
    a = await f.signup("uno"),
    b = await f.signup("dos");
  await f.send(a, "comun@example.test");
  const first = f.mails.get("comun@example.test");
  assert.equal((await f.send(b, "comun@example.test")).status, 200);
  assert.equal(
    (await f.confirm(b, f.mails.get("comun@example.test"))).status,
    200,
  );
  assert.equal((await f.confirm(a, first)).status, 409);
  assert.equal((await f.session(a)).body.canParticipate, false);
  f.advance(60_001);
  assert.equal((await f.send(a, "comun@example.test")).status, 409);
});
test("correo: confirmación persiste tras reiniciar; códigos pendientes y secretos no se restauran", async (t) => {
  const f = await setup(t),
    a = await f.signup("uno"),
    b = await f.signup("dos");
  await f.send(a, "uno@example.test");
  await f.confirm(a, f.mails.get("uno@example.test"));
  await f.send(b, "dos@example.test");
  const code = f.mails.get("dos@example.test");
  await f.restart();
  assert.equal((await f.session(a)).body.canParticipate, true);
  assert.equal((await f.confirm(b, code)).status, 422);
  f.advance(60_001);
  await f.send(b, "dos@example.test");
  assert.equal(
    (await f.confirm(b, f.mails.get("dos@example.test"))).status,
    200,
  );
});
test("correo: fallo de entrega no habilita acceso y SMTP exige configuración TLS completa", async (t) => {
  const f = await setup(t, async () => {
      throw Error("Fallo SMTP de prueba");
    }),
    u = await f.signup();
  assert.equal((await f.send(u)).status, 503);
  assert.equal((await f.session(u)).body.canParticipate, false);
  assert.equal(smtpMailer({}), undefined);
  assert.throws(() =>
    smtpMailer({ ENTRE_SMTP_HOST: "mail.example.test", ENTRE_SMTP_PORT: "25" }),
  );
});
