import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { createRoomServer } from "../../server/app.ts";

const origin = "http://localhost:4173";
async function setup(t) {
  let clock = Date.now();
  const app = createRoomServer({ now: () => clock });
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function identity(alias = "Prueba") {
    const response = await fetch(`${base}/api/session`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ alias, adult: true }),
    });
    assert.equal(response.status, 201);
    return {
      ...(await response.json()),
      cookie: response.headers.get("set-cookie").split(";")[0],
    };
  }
  async function connect(person, room = "cafe") {
    const ws = new WebSocket(
      `${base.replace("http:", "ws:")}/api/rooms/${room}`,
      {
        headers: { Origin: origin, Cookie: person.cookie },
      },
    );
    const events = [];
    ws.on("message", (raw) => events.push(JSON.parse(raw.toString())));
    await once(ws, "open");
    const client = {
      ws,
      events,
      person,
      send(value) {
        ws.send(JSON.stringify(value));
      },
      get snapshot() {
        return events.findLast((e) => e.type === "snapshot");
      },
      async wait(predicate) {
        const end = Date.now() + 2500;
        while (Date.now() < end) {
          if (predicate(client)) return;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.fail(
          `No llegó el estado esperado: ${JSON.stringify(events.slice(-2))}`,
        );
      },
      async disconnect() {
        const closed = once(ws, "close");
        ws.close();
        await closed;
      },
    };
    await client.wait((c) => !!c.snapshot);
    return client;
  }
  async function rejected(person, room = "cafe", requestOrigin = origin) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `${base.replace("http:", "ws:")}/api/rooms/${room}`,
        {
          headers: { Origin: requestOrigin, Cookie: person?.cookie || "" },
        },
      );
      ws.on("unexpected-response", (_req, res) => {
        res.resume();
        ws.terminate();
        resolve(res.statusCode);
      });
      ws.on("error", () => {});
      ws.on("open", () => {
        ws.close();
        reject(new Error("Se aceptó una conexión que debía rechazarse"));
      });
    });
  }
  async function trio() {
    const clients = [];
    for (const alias of ["Luz", "Sol", "Mar"])
      clients.push(await connect(await identity(alias)));
    await clients[0].wait((c) => c.snapshot.session.participants.length === 3);
    clients[0].send({ type: "start" });
    await Promise.all(
      clients.map((c) =>
        c.wait((x) => x.snapshot.session.phase === "question"),
      ),
    );
    return clients;
  }
  return {
    base,
    identity,
    connect,
    rejected,
    trio,
    advance(ms) {
      clock += ms;
      app.tick();
    },
  };
}

test("requiere sesión, origen permitido y un perfil de desarrollo válido", async (t) => {
  const f = await setup(t);
  assert.equal((await fetch(`${f.base}/api/session`)).status, 401);
  assert.equal(await f.rejected(null), 401);
  const person = await f.identity();
  assert.equal(await f.rejected(person, "cafe", "https://otro.example"), 403);
  assert.equal(await f.rejected(person, "desconocida"), 404);
  for (const body of [
    { alias: "Prueba", adult: false },
    { alias: "Prueba", adult: true, id: "forged" },
  ]) {
    const res = await fetch(`${f.base}/api/session`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 422);
  }
  const foreign = await fetch(`${f.base}/api/session`, {
    method: "POST",
    headers: {
      Origin: "https://otro.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(foreign.status, 403);
});

test("varias pestañas cuentan una vez; quórum y cupo máximo los decide el servidor", async (t) => {
  const f = await setup(t);
  const person = await f.identity();
  const a = await f.connect(person);
  const tab = await f.connect(person);
  assert.equal(tab.snapshot.session.participants.length, 1);
  a.send({ type: "start" });
  a.send({
    type: "message",
    clientId: randomUUID(),
    content: { type: "text", text: "No puede enviarse" },
  });
  await a.wait((c) => c.events.some((e) => e.code === "room_not_ready"));
  assert.equal(a.snapshot.session.phase, "lobby");
  await tab.disconnect();
  assert.equal(
    a.snapshot.session.participants.filter((p) => p.present).length,
    1,
  );
  for (let i = 0; i < 5; i++) await f.connect(await f.identity(`Persona ${i}`));
  await a.wait((c) => c.snapshot.session.participants.length === 6);
  assert.equal(await f.rejected(await f.identity("Séptima")), 409);
});

test("texto y stickers se entregan una vez con identidad del servidor", async (t) => {
  const f = await setup(t);
  const [a, b, c] = await f.trio();
  const command = {
    type: "message",
    clientId: randomUUID(),
    content: { type: "text", text: "<script>prueba</script>" },
  };
  a.send(command);
  a.send(command);
  await c.wait((x) => x.snapshot.messages.length === 1);
  const message = c.snapshot.messages[0];
  assert.equal(message.senderId, a.person.id);
  assert.equal(message.name, "Luz");
  assert.equal(message.text, command.content.text);
  assert.equal(
    a.events.filter((e) => e.type === "ack" && e.clientId === command.clientId)
      .length,
    2,
  );
  b.send({
    type: "message",
    clientId: randomUUID(),
    content: { type: "sticker", stickerId: "conversar-1" },
  });
  await c.wait((x) => x.snapshot.messages.length === 2);
  assert.equal(c.snapshot.messages[1].stickerId, "conversar-1");
  assert.equal(c.snapshot.messages[1].senderId, b.person.id);
});

test("rechaza suplantación, relojes del cliente y acciones fuera del protocolo", async (t) => {
  const f = await setup(t);
  const [a, b] = await f.trio();
  const invalid = [
    { type: "respond", status: "ready", id: b.person.id },
    { type: "start", now: Number.MAX_SAFE_INTEGER },
    { type: "presence", id: b.person.id, present: false },
    { type: "close" },
    {
      type: "message",
      clientId: randomUUID(),
      content: { type: "sticker", stickerId: "../../secret" },
    },
    {
      type: "message",
      clientId: randomUUID(),
      content: { type: "text", text: "x".repeat(1001) },
    },
    {
      type: "message",
      clientId: randomUUID(),
      senderId: b.person.id,
      content: { type: "text", text: "Suplantación" },
    },
  ];
  for (const command of invalid) a.send(command);
  await a.wait(
    (c) => c.events.filter((e) => e.type === "error").length === invalid.length,
  );
  assert.equal(a.snapshot.messages.length, 0);
  assert.equal(
    a.snapshot.session.participants.find((p) => p.id === b.person.id).status,
    "pending",
  );
});

test("plazos, escritura, extensión única y mayoría se comparten sin depender del reloj del navegador", async (t) => {
  const f = await setup(t);
  const [a, b] = await f.trio();
  const tab = await f.connect(a.person);
  a.send({ type: "typing", active: true });
  await b.wait(
    (c) =>
      c.snapshot.session.participants.find((p) => p.id === a.person.id)
        .typingUntil > 0,
  );
  const deadline = a.snapshot.session.roundUntil;
  a.send({ type: "extend" });
  tab.send({ type: "extend" });
  await b.wait((c) => c.snapshot.session.extended);
  assert.equal(b.snapshot.session.roundUntil, deadline + 30_000);
  f.advance(120_001);
  await a.wait((c) => c.snapshot.session.phase === "conversation");
  a.send({ type: "next-question" });
  tab.send({ type: "next-question" });
  await b.wait((c) => c.snapshot.session.votes.length === 1);
  assert.equal(b.snapshot.session.phase, "conversation");
  b.send({ type: "next-question" });
  await a.wait((c) => c.snapshot.session.question === 1);
  assert.equal(a.snapshot.session.phase, "question");
});

test("la salida pausa por falta de quórum, permite reconectar y cierra al vencer la gracia", async (t) => {
  const f = await setup(t);
  const [a, b, c] = await f.trio();
  await c.disconnect();
  await a.wait((x) => x.snapshot.session.phase === "paused");
  b.send({
    type: "message",
    clientId: randomUUID(),
    content: { type: "text", text: "No pasa durante la pausa" },
  });
  await b.wait((x) => x.events.some((e) => e.code === "room_not_ready"));
  const returned = await f.connect(c.person);
  await a.wait((x) => x.snapshot.session.phase === "conversation");
  await returned.disconnect();
  await a.wait((x) => x.snapshot.session.phase === "paused");
  f.advance(60_001);
  await a.wait((x) => x.snapshot.session.phase === "insufficient");
  assert.equal(await f.rejected(c.person), 410);
});

test("una sesión no puede entrar en dos salas ni recibir el historial de otra temática", async (t) => {
  const f = await setup(t);
  const [a, b] = await f.trio();
  a.send({
    type: "message",
    clientId: randomUUID(),
    content: { type: "text", text: "Solo café" },
  });
  await b.wait((x) => x.snapshot.messages.length === 1);
  assert.equal(await f.rejected(a.person, "crear"), 409);
  const other = await f.connect(await f.identity("Otro grupo"), "crear");
  assert.equal(other.snapshot.messages.length, 0);
  assert.equal(other.snapshot.session.participants.length, 1);
});

test("bloquear desconecta todas las pestañas propias y evita volver a coincidir", async (t) => {
  const f = await setup(t);
  const [a, b] = await f.trio();
  const tab = await f.connect(a.person);
  const closed = once(a.ws, "close");
  const tabClosed = once(tab.ws, "close");
  a.send({ type: "block", participantId: b.person.id });
  assert.equal((await closed)[0], 4003);
  assert.equal((await tabClosed)[0], 4003);
  await b.wait((c) => c.snapshot.session.phase === "paused");
  assert.equal(await f.rejected(a.person), 403);
});

test("el historial se limita a 50 y una sesión vencida pierde acceso", async (t) => {
  const f = await setup(t);
  const [a, b] = await f.trio();
  for (let i = 0; i < 55; i++)
    a.send({
      type: "message",
      clientId: randomUUID(),
      content: { type: "text", text: `Mensaje ${i}` },
    });
  await b.wait((c) => c.snapshot.messages.at(-1)?.text === "Mensaje 54");
  assert.equal(b.snapshot.messages.length, 50);
  assert.equal(b.snapshot.messages[0].text, "Mensaje 5");
  const closed = once(a.ws, "close");
  f.advance(4 * 60 * 60_000 + 1);
  assert.equal((await closed)[0], 4001);
  assert.equal(await f.rejected(a.person), 401);
});
