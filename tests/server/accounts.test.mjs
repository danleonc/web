import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { backupDatabase } from "../../scripts/backup-db.mjs";
import { WebSocket } from "ws";
import { createRoomServer } from "../../server/app.ts";
const origin = "http://localhost:4173";
const password = "Una frase larga para pruebas 123";
async function fixture(t, extra = {}) {
  const directory = await mkdtemp(join(tmpdir(), "entre-accounts-"));
  const path = join(directory, "accounts.sqlite");
  let clock = Date.now();
  const startsAt = clock + 600_000;
  let app;
  let base;
  let counter = 0;
  const mails = new Map();
  async function start() {
    app = createRoomServer({
      databasePath: path,
      sendVerificationEmail: async (email, code) => { mails.set(email,code); },
      allowedOrigins: [origin],
      now: () => clock,
      startAt: startsAt,
      ...extra,
    });
    app.server.listen(0, "127.0.0.1");
    await once(app.server, "listening");
    base = `http://127.0.0.1:${app.server.address().port}`;
  }
  await start();
  t.after(async () => {
    if (app) await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  async function request(
    path,
    method = "GET",
    body,
    cookie = "",
    requestOrigin = origin,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: requestOrigin,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
      header: response.headers.get("set-cookie"),
    };
  }
  async function signup(username = `persona_${++counter}`) {
    const r = await request("/api/auth/register", "POST", {
      username,
      alias: username,
      adult: true,
      password,
    });
    assert.equal(r.status, 201);
    const email = `${username}@example.test`;
    assert.equal((await request("/api/auth/email-code", "POST", { email, adult: true }, r.cookie)).status, 200);
    assert.equal((await request("/api/auth/confirm-email", "POST", { code: mails.get(email) }, r.cookie)).status, 200);
    return { ...r.body, cookie: r.cookie, username };
  }
  async function socket(person) {
    const ws = new WebSocket(base.replace("http:", "ws:") + "/api/rooms/cafe", {
      headers: { Origin: origin, Cookie: person.cookie },
    });
    const events = [];
    ws.on("message", (raw) => events.push(JSON.parse(raw.toString())));
    ws.on("error", () => {});
    await once(ws, "open");
    const result = {
      ws,
      events,
      send: (value) => ws.send(JSON.stringify(value)),
      get snapshot() {
        return events.findLast((e) => e.type === "snapshot");
      },
      async wait(predicate) {
        const end = Date.now() + 2500;
        while (Date.now() < end) {
          if (predicate(result)) return;
          await new Promise((r) => setTimeout(r, 10));
        }
        assert.fail("No llegó el estado compartido esperado");
      },
    };
    await result.wait((c) => !!c.snapshot);
    return result;
  }
  async function rejected(person) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        base.replace("http:", "ws:") + "/api/rooms/cafe",
        { headers: { Origin: origin, Cookie: person.cookie || "" } },
      );
      ws.on("error", () => {});
      ws.on("unexpected-response", (_req, res) => {
        res.resume();
        ws.terminate();
        resolve(res.statusCode);
      });
      ws.on("open", () => {
        ws.close();
        reject(Error("Conexión no autorizada aceptada"));
      });
    });
  }
  return {
    path,
    directory,
    startsAt,
    request,
    signup,
    socket,
    rejected,
    advance(ms) {
      clock += ms;
      app.tick();
    },
    async restart() {
      await app.close();
      app = null;
      await start();
    },
  };
}

test("salir de recepción retira acceso al historial del grupo que empieza después", async (t) => {
  const f = await fixture(t);
  const visitor = await f.signup("visitante");
  await f.request("/api/reservations/cafe", "POST", undefined, visitor.cookie);
  const users = [];
  for (let i = 0; i < 3; i++) {
    const u = await f.signup();
    users.push(u);
    await f.request("/api/reservations/cafe", "POST", undefined, u.cookie);
  }
  f.advance(600_000);
  const waiting = await f.socket(visitor);
  const roomId = waiting.snapshot.roomKey;
  const closed = once(waiting.ws, "close");
  waiting.ws.close();
  await closed;
  const clients = [];
  for (const u of users) clients.push(await f.socket(u));
  clients[0].send({ type: "start" });
  await clients[2].wait((c) => c.snapshot.session.phase === "question");
  clients[0].send({
    type: "message",
    clientId: randomUUID(),
    content: {
      type: "text",
      text: "Solo para quienes participan del encuentro",
    },
  });
  await clients[2].wait((c) => c.snapshot.messages.length === 1);
  assert.equal(
    (
      await f.request(
        `/api/history/${roomId}`,
        "GET",
        undefined,
        visitor.cookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (await f.request("/api/history", "GET", undefined, visitor.cookie)).body
      .rooms.length,
    0,
  );
});

test("cuentas: cookies seguras, contraseñas derivadas y sesión persistente tras reiniciar", async (t) => {
  const f = await fixture(t, { secureCookies: true });
  const user = await f.signup("luz");
  assert.equal(
    (await f.request("/api/session", "GET", undefined, user.cookie)).body.id,
    user.id,
  );
  assert.equal(
    (await f.request("/api/session", "POST", { alias: "Falso", adult: true }))
      .status,
    405,
  );
  assert.equal(await f.rejected({}), 401);
  await f.restart();
  assert.equal(
    (await f.request("/api/session", "GET", undefined, user.cookie)).body.id,
    user.id,
  );
  const login = await f.request("/api/auth/login", "POST", {
    username: "LUZ",
    password,
  });
  assert.equal(login.status, 200);
  assert.match(login.header, /HttpOnly/);
  assert.match(login.header, /SameSite=Strict/);
  assert.match(login.header, /Secure/);
  const db = new DatabaseSync(f.path, { readOnly: true });
  try {
    const row = db
      .prepare("SELECT password_hash,recovery_hash FROM accounts")
      .get();
    assert.notEqual(row.password_hash, password);
    assert.match(row.password_hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
    assert.notEqual(row.recovery_hash, user.recoveryCode.replaceAll("-", ""));
    assert.equal(
      db
        .prepare("SELECT token_hash FROM sessions")
        .all()
        .some((r) => user.cookie.endsWith(r.token_hash)),
      false,
    );
  } finally {
    db.close();
  }
  const logout = await f.request("/api/auth/logout", "POST", {}, login.cookie);
  assert.equal(logout.status, 200);
  assert.match(logout.header, /Max-Age=0/);
  assert.equal(
    (await f.request("/api/session", "GET", undefined, login.cookie)).status,
    401,
  );
  assert.equal(
    (await f.request("/api/session", "GET", undefined, user.cookie)).status,
    200,
  );
});

test("cuentas: validación, rechazo de origen y cierre de sesión de un navegador", async (t) => {
  const f = await fixture(t);
  const user = await f.signup();
  assert.equal(
    (
      await f.request("/api/auth/register", "POST", {
        username: "otro",
        alias: "Otro",
        adult: false,
        password,
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await f.request("/api/auth/register", "POST", {
        username: "otro",
        alias: "Otro",
        adult: true,
        password: "corta",
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await f.request("/api/auth/login", "POST", {
        username: user.username,
        password,
        id: user.id,
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await f.request(
        "/api/auth/login",
        "POST",
        { username: user.username, password },
        "",
        "https://otro.example",
      )
    ).status,
    403,
  );
  await f.request("/api/reservations/cafe", "POST", undefined, user.cookie);
  f.advance(600_000);
  const socket = await f.socket(user);
  const closed = once(socket.ws, "close");
  await f.request("/api/auth/logout", "POST", {}, user.cookie);
  assert.equal((await closed)[0], 4001);
  assert.equal(await f.rejected(user), 401);
});

test("recuperación: rota clave, revoca sesiones y no permite repetir la clave anterior", async (t) => {
  const f = await fixture(t);
  const user = await f.signup("recuperar");
  const nextPassword = "Otra frase nueva para pruebas 456";
  const recovered = await f.request("/api/auth/recover", "POST", {
    username: user.username,
    password: nextPassword,
    recoveryCode: user.recoveryCode,
  });
  assert.equal(recovered.status, 200);
  assert.ok(recovered.body.recoveryCode);
  assert.notEqual(recovered.body.recoveryCode, user.recoveryCode);
  assert.equal(
    (await f.request("/api/session", "GET", undefined, user.cookie)).status,
    401,
  );
  assert.equal(
    (
      await f.request("/api/auth/login", "POST", {
        username: user.username,
        password,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.request("/api/auth/login", "POST", {
        username: user.username,
        password: nextPassword,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.request("/api/auth/recover", "POST", {
        username: user.username,
        password,
        recoveryCode: user.recoveryCode,
      })
    ).status,
    401,
  );
});

test("reservas: seis plazas atómicas, duplicados idempotentes, conflicto horario e aislamiento", async (t) => {
  const f = await fixture(t);
  const users = [];
  for (let i = 0; i < 7; i++) users.push(await f.signup());
  const results = await Promise.all(
    users.map((u) =>
      f.request("/api/reservations/cafe", "POST", undefined, u.cookie),
    ),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 6);
  assert.equal(
    results.filter((r) => r.body.error === "reservation_full").length,
    1,
  );
  assert.equal(
    (
      await f.request(
        "/api/reservations/cafe",
        "POST",
        undefined,
        users[0].cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await f.request(
        "/api/reservations/crear",
        "POST",
        undefined,
        users[0].cookie,
      )
    ).body.error,
    "reservation_conflict",
  );
  const outsider = (
    await f.request("/api/activities", "GET", undefined, users[6].cookie)
  ).body.activities.find((a) => a.id === "cafe");
  assert.equal(outsider.reserved, 6);
  assert.equal(outsider.mine, false);
  await f.restart();
  assert.equal(
    (
      await f.request("/api/activities", "GET", undefined, users[0].cookie)
    ).body.activities.find((a) => a.id === "cafe").mine,
    true,
  );
  await f.request(
    "/api/reservations/cafe",
    "DELETE",
    undefined,
    users[0].cookie,
  );
  assert.equal(
    (
      await f.request(
        "/api/reservations/cafe",
        "POST",
        undefined,
        users[6].cookie,
      )
    ).status,
    200,
  );
  assert.equal(await f.rejected(users[6]), 425);
});

test("salas: mensajes y recibos sobreviven al reinicio; no se restauran asistentes ficticios", async (t) => {
  const f = await fixture(t);
  const users = [];
  for (let i = 0; i < 3; i++) {
    const u = await f.signup();
    users.push(u);
    await f.request("/api/reservations/cafe", "POST", undefined, u.cookie);
  }
  const outsider = await f.signup("fuera");
  f.advance(600_000);
  const clients = [];
  for (const u of users) clients.push(await f.socket(u));
  clients[0].send({ type: "start" });
  await clients[2].wait((c) => c.snapshot.session.phase === "question");
  const command = {
    type: "message",
    clientId: randomUUID(),
    content: { type: "text", text: "Se conserva después del reinicio" },
  };
  clients[0].send(command);
  clients[1].send({
    type: "message",
    clientId: randomUUID(),
    content: { type: "sticker", stickerId: "moka-1" },
  });
  await clients[2].wait((c) => c.snapshot.messages.length === 2);
  const roomId = clients[0].snapshot.roomKey;
  // A live backup models a process crash: persisted presence still says connected.
  const crashCopy = join(f.directory, "live-crash.sqlite");
  await backupDatabase(f.path, crashCopy);
  const crashed = createRoomServer({
    databasePath: crashCopy,
    now: () => f.startsAt,
    allowedOrigins: [origin],
  });
  crashed.server.listen(0, "127.0.0.1");
  await once(crashed.server, "listening");
  try {
    const peer = new WebSocket(
      `ws://127.0.0.1:${crashed.server.address().port}/api/rooms/cafe`,
      { headers: { Origin: origin, Cookie: users[0].cookie } },
    );
    const [raw] = await once(peer, "message");
    const restored = JSON.parse(raw.toString());
    assert.equal(
      restored.session.participants.filter((p) => p.present).length,
      1,
    );
    assert.equal(restored.session.phase, "paused");
    assert.equal(restored.messages.length, 2);
    peer.close();
  } finally {
    await crashed.close();
  }
  assert.equal(
    (
      await f.request(
        `/api/history/${roomId}`,
        "GET",
        undefined,
        outsider.cookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (await f.request("/api/history", "GET", undefined, outsider.cookie)).body
      .rooms.length,
    0,
  );
  await f.restart();
  const first = await f.socket(users[0]);
  assert.equal(
    first.snapshot.session.participants.filter((p) => p.present).length,
    1,
  );
  assert.equal(first.snapshot.session.phase, "paused");
  assert.equal(first.snapshot.messages.length, 2);
  const second = await f.socket(users[1]);
  await f.socket(users[2]);
  await first.wait((c) => c.snapshot.session.phase === "conversation");
  first.send(command);
  await first.wait((c) =>
    c.events.some((e) => e.type === "ack" && e.clientId === command.clientId),
  );
  assert.equal(first.snapshot.messages.length, 2);
  const history = await f.request(
    `/api/history/${roomId}`,
    "GET",
    undefined,
    users[1].cookie,
  );
  assert.equal(history.body.messages.length, 2);
  const closed = once(first.ws, "close");
  first.send({ type: "block", participantId: users[1].id });
  assert.equal((await closed)[0], 4003);
  await second.wait((c) => c.snapshot.session.phase === "paused");
  await f.restart();
  const otherLogin = await f.request("/api/auth/login", "POST", {
    username: users[0].username,
    password,
  });
  assert.equal(
    (
      await f.request(
        `/api/history/${roomId}`,
        "GET",
        undefined,
        otherLogin.cookie,
      )
    ).body.messages.some((m) => m.senderId === users[1].id),
    false,
  );
});

test("reservas y reloj: solo entra quien reserva y se respetan fecha, recepción y cierre", async (t) => {
  const f = await fixture(t);
  const user = await f.signup();
  assert.equal(await f.rejected(user), 403);
  await f.request("/api/reservations/cafe", "POST", undefined, user.cookie);
  assert.equal(await f.rejected(user), 425);
  f.advance(300_000);
  const client = await f.socket(user);
  client.send({ type: "start" });
  await client.wait((c) => c.events.some((e) => e.code === "too_early"));
  assert.equal(client.snapshot.session.phase, "lobby");
  f.advance(600_001);
  await client.wait((c) => c.snapshot.session.phase === "insufficient");
  assert.equal(
    (await f.request("/api/reservations/crear", "POST", undefined, user.cookie))
      .body.error,
    "reservation_closed",
  );
});

test("límites de autenticación persisten y caducan sin registrar contraseñas", async (t) => {
  const f = await fixture(t);
  const user = await f.signup();
  for (let i = 0; i < 8; i++)
    assert.equal(
      (
        await f.request("/api/auth/login", "POST", {
          username: user.username,
          password: "Una frase incorrecta 123",
        })
      ).status,
      401,
    );
  await f.restart();
  assert.equal(
    (
      await f.request("/api/auth/login", "POST", {
        username: user.username,
        password: "Otra frase incorrecta 123",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.request("/api/auth/login", "POST", {
        username: user.username,
        password,
      })
    ).status,
    429,
  );
  f.advance(15 * 60_000 + 1);
  assert.equal(
    (
      await f.request("/api/auth/login", "POST", {
        username: user.username,
        password,
      })
    ).status,
    200,
  );
});

test("copia SQLite consistente puede restaurar cuentas y reservas", async (t) => {
  const f = await fixture(t);
  const user = await f.signup();
  await f.request("/api/reservations/cafe", "POST", undefined, user.cookie);
  const source = new DatabaseSync(f.path, { readOnly: true });
  const target = join(f.directory, "backup.sqlite");
  try {
    await backupDatabase(f.path, target);
  } finally {
    source.close();
  }
  const restored = createRoomServer({ databasePath: target });
  restored.server.listen(0, "127.0.0.1");
  await once(restored.server, "listening");
  try {
    const response = await fetch(
      `http://127.0.0.1:${restored.server.address().port}/api/activities`,
      { headers: { Cookie: user.cookie } },
    );
    assert.equal(response.status, 200);
    assert.equal(
      (await response.json()).activities.find((a) => a.id === "cafe").mine,
      true,
    );
  } finally {
    await restored.close();
  }
});

test("historial: conserva solo los últimos 50 mensajes y elimina salas archivadas a los 30 días", async (t) => {
  const f = await fixture(t);
  const users = [];
  for (let i = 0; i < 3; i++) {
    const u = await f.signup();
    users.push(u);
    await f.request("/api/reservations/cafe", "POST", undefined, u.cookie);
  }
  f.advance(600_000);
  const clients = [];
  for (const u of users) clients.push(await f.socket(u));
  clients[0].send({ type: "start" });
  await clients[2].wait((c) => c.snapshot.session.phase === "question");
  for (let i = 0; i < 55; i++)
    clients[0].send({
      type: "message",
      clientId: randomUUID(),
      content: { type: "text", text: `Guardado ${i}` },
    });
  await clients[2].wait(
    (c) => c.snapshot.messages.at(-1)?.text === "Guardado 54",
  );
  const roomId = clients[0].snapshot.roomKey;
  await f.restart();
  const saved = await f.request(
    `/api/history/${roomId}`,
    "GET",
    undefined,
    users[0].cookie,
  );
  assert.equal(saved.body.messages.length, 50);
  assert.equal(saved.body.messages[0].text, "Guardado 5");
  f.advance(300_001);
  f.advance(31 * 24 * 60 * 60_000);
  await f.restart();
  const login = await f.request("/api/auth/login", "POST", {
    username: users[0].username,
    password,
  });
  assert.equal(login.status, 200);
  assert.equal(
    (await f.request("/api/history", "GET", undefined, login.cookie)).body.rooms
      .length,
    0,
  );
  assert.equal(
    (await f.request(`/api/history/${roomId}`, "GET", undefined, login.cookie))
      .status,
    404,
  );
});
