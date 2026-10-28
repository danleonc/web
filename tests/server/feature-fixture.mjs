import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { createRoomServer } from "../../server/app.ts";
const origin = "http://localhost:4173";
const password = "Una frase larga para pruebas 123";
export async function fixture(t, extra = {}) {
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
    raw: (path, options) => fetch(base + path, options),
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
