import { test } from "node:test";
import { crc32 } from "node:zlib";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import { fixture } from "./feature-fixture.mjs";
const origin = "http://localhost:4173";
function db(f, fn) {
  const conn = new DatabaseSync(f.path);
  try {
    return fn(conn);
  } finally {
    conn.close();
  }
}
async function group(t, n = 3) {
  const f = await fixture(t, { enforceSchedule: false }),
    users = [],
    clients = [];
  for (let i = 0; i < n; i++) {
    const u = await f.signup();
    users.push(u);
    await f.request("/api/reservations/cafe", "POST", undefined, u.cookie);
    clients.push(await f.socket(u));
  }
  clients[0].send({ type: "start" });
  await clients.at(-1).wait((c) => c.snapshot.session.phase === "question");
  return { f, users, clients, room: clients[0].snapshot.roomKey };
}
const promote = (f, u) =>
  db(f, (d) => d.prepare("INSERT INTO moderators VALUES(?)").run(u.id));
const report = async (f, room, by, target, extra = {}) =>
  f.request(
    `/api/rooms/${room}/reports`,
    "POST",
    {
      targetId: target.id,
      reason: "acoso",
      note: "Insiste después de que le pidieron parar.",
      ...extra,
    },
    by.cookie,
  );
const action = async (f, mod, id, kind) =>
  f.request(
    "/api/moderation/actions",
    "POST",
    {
      reportId: id,
      action: kind,
      reason: "Revisión del contexto y conducta reiterada.",
      hours: 1,
    },
    mod.cookie,
  );
async function upload(
  f,
  room,
  u,
  body,
  type = "image/png",
  id = randomUUID(),
  requestOrigin = origin,
) {
  const r = await f.raw(`/api/rooms/${room}/media`, {
    method: "POST",
    headers: {
      Origin: requestOrigin,
      Cookie: u.cookie,
      "Content-Type": type,
      "X-Upload-Id": id,
    },
    body,
  });
  return { status: r.status, body: await r.json() };
}
const png = () =>
  sharp({
    create: { width: 1600, height: 900, channels: 3, background: "#bb8877" },
  })
    .png()
    .toBuffer();

test("votación compartida: un voto por cuenta, privacidad, expulsión sin reingreso ni historial tras reiniciar", async (t) => {
  const { f, users, clients, room } = await group(t, 3);
  const otherTab = await f.socket(users[0]);
  clients[0].send({
    type: "open-removal",
    targetId: users[1].id,
    reason: "acoso",
  });
  await clients[2].wait((c) => !!c.snapshot.safety.ballot);
  const b = clients[2].snapshot.safety.ballot;
  assert.equal(b.threshold, 2);
  assert.equal(b.eligibleCount, 2);
  assert.equal(b.castCount, 1);
  assert.equal("votes" in b, false);
  assert.equal("eligible" in b, false);
  assert.equal(clients[1].snapshot.safety.ballot?.canVote, false);
  otherTab.send({ type: "removal-vote", ballotId: b.id, choice: "remove" });
  await otherTab.wait((c) => c.events.some((e) => e.code === "vote_rejected"));
  assert.deepEqual(otherTab.snapshot.safety.expelled, []);
  const closed = once(clients[1].ws, "close");
  clients[2].send({ type: "removal-vote", ballotId: b.id, choice: "remove" });
  assert.equal((await closed)[0], 4005);
  await clients[0].wait((c) => c.snapshot.session.phase === "paused");
  assert.deepEqual(clients[0].snapshot.safety.expelled, [users[1].id]);
  assert.equal(await f.rejected(users[1]), 403);
  assert.equal(
    (await f.request(`/api/history/${room}`, "GET", undefined, users[1].cookie))
      .status,
    404,
  );
  assert.equal(
    (await f.request("/api/session", "GET", undefined, users[1].cookie)).body
      .restriction,
    null,
  );
  await f.restart();
  assert.equal(await f.rejected(users[1]), 403);
  assert.equal(
    (await f.request(`/api/history/${room}`, "GET", undefined, users[1].cookie))
      .status,
    404,
  );
});

test("votación compartida: plazo y votos no se reinician al reconectar o reiniciar servidor", async (t) => {
  const { f, users, clients } = await group(t, 4);
  clients[0].send({
    type: "open-removal",
    targetId: users[1].id,
    reason: "spam",
  });
  await clients[2].wait((c) => !!c.snapshot.safety.ballot);
  const initial = clients[2].snapshot.safety.ballot;
  f.advance(30000);
  await f.restart();
  const restored = await f.socket(users[0]);
  assert.equal(restored.snapshot.safety.ballot.until, initial.until);
  assert.equal(restored.snapshot.safety.ballot.castCount, 1);
  f.advance(30001);
  await restored.wait((c) => !c.snapshot.safety.ballot);
  assert.deepEqual(restored.snapshot.safety.expelled, []);
});

test("reportes: evidencia del servidor, deduplicación, permisos y rechazo de suplantación u otro origen", async (t) => {
  const { f, users, clients, room } = await group(t);
  const mod = await f.signup("moderacion");
  promote(f, mod);
  const outsider = await f.signup("fuera");
  clients[1].send({
    type: "message",
    clientId: randomUUID(),
    content: { type: "text", text: "Mensaje señalado para revisión" },
  });
  await clients[0].wait((c) => c.snapshot.messages.length === 1);
  const message = clients[0].snapshot.messages[0];
  assert.equal((await report(f, room, outsider, users[1])).status, 404);
  assert.equal((await report(f, room, users[0], users[0])).status, 422);
  assert.equal(
    (await report(f, room, users[0], users[2], { messageId: message.id }))
      .status,
    422,
  );
  assert.equal(
    (await report(f, room, users[0], users[1], { reporterId: mod.id })).status,
    422,
  );
  const r = await report(f, room, users[0], users[1], {
    messageId: message.id,
  });
  assert.equal(r.status, 201);
  assert.equal(
    (await report(f, room, users[0], users[1], { messageId: message.id })).body
      .id,
    r.body.id,
  );
  assert.equal(
    (
      await f.request(
        "/api/moderation/reports",
        "GET",
        undefined,
        users[0].cookie,
      )
    ).status,
    403,
  );
  assert.equal((await action(f, users[0], r.body.id, "ban")).status, 403);
  const queue = await f.request(
    "/api/moderation/reports",
    "GET",
    undefined,
    mod.cookie,
  );
  assert.equal(queue.body.reports.length, 1);
  assert.equal(queue.body.reports[0].evidence.text, message.text);
  assert.equal("reporterId" in queue.body.reports[0], false);
  assert.equal(
    (
      await f.request(
        `/api/rooms/${room}/reports`,
        "POST",
        { targetId: users[1].id, reason: "spam", note: "" },
        users[0].cookie,
        "https://otro.example",
      )
    ).status,
    403,
  );
  assert.equal((await action(f, mod, r.body.id, "dismiss")).status, 200);
  assert.equal((await action(f, mod, r.body.id, "ban")).status, 422);
});

test("moderación: baneo auditado, cierre de todas las sesiones, apelación y restauración; no es un resultado de votos", async (t) => {
  const { f, users, clients, room } = await group(t);
  const mod = await f.signup("responsable");
  promote(f, mod);
  const second = await f.socket(users[1]);
  const r = await report(f, room, users[0], users[1]);
  const closed = once(clients[1].ws, "close"),
    closed2 = once(second.ws, "close");
  assert.equal((await action(f, mod, r.body.id, "ban")).status, 200);
  assert.equal((await closed)[0], 4004);
  assert.equal((await closed2)[0], 4004);
  assert.equal(
    (await f.request("/api/activities", "GET", undefined, users[1].cookie))
      .status,
    403,
  );
  assert.equal(await f.rejected(users[1]), 403);
  const session = await f.request(
    "/api/session",
    "GET",
    undefined,
    users[1].cookie,
  );
  assert.equal(session.body.restriction.kind, "ban");
  assert.equal(session.body.moderator, false);
  await f.restart();
  const login = await f.request("/api/auth/login", "POST", {
    username: users[1].username,
    password: "Una frase larga para pruebas 123",
  });
  assert.equal(login.status, 200);
  assert.equal(
    (await f.request("/api/session", "GET", undefined, login.cookie)).body
      .restriction.kind,
    "ban",
  );
  const appeal = await f.request(
    "/api/appeals",
    "POST",
    { note: "Solicito revisar el contexto de la conversación." },
    login.cookie,
  );
  assert.equal(appeal.status, 200);
  assert.equal(
    (
      await f.request(
        "/api/appeals",
        "POST",
        { note: "Amplío el mismo recurso." },
        login.cookie,
      )
    ).body.id,
    appeal.body.id,
  );
  assert.equal(
    (
      await f.request(
        "/api/moderation/appeals",
        "POST",
        {
          id: appeal.body.id,
          decision: "restore",
          note: "Se revisaron los antecedentes y no justifican la sanción.",
        },
        mod.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await f.request("/api/session", "GET", undefined, login.cookie)).body
      .restriction,
    null,
  );
  assert.equal(
    (await f.request("/api/activities", "GET", undefined, login.cookie)).status,
    200,
  );
  assert.equal(
    db(
      f,
      (d) => d.prepare("SELECT COUNT(*) AS n FROM moderation_actions").get().n,
    ),
    2,
  );
});

test("imágenes: habilitación con responsable, normalización sin EXIF, acceso aislado, idempotencia y retiro tras revisión", async (t) => {
  const { f, users, clients, room } = await group(t);
  const image = await png();
  assert.equal((await upload(f, room, users[0], image)).status, 503);
  const mod = await f.signup("mod_imagen");
  promote(f, mod);
  assert.equal(
    (await f.request("/api/session", "GET", undefined, users[0].cookie)).body
      .imagesEnabled,
    true,
  );
  const source = await sharp(image)
    .jpeg()
    .withExif({ IFD0: { Copyright: "metadata que no debe conservarse" } })
    .toBuffer();
  const clientId = randomUUID(),
    r = await upload(f, room, users[0], source, "image/jpeg", clientId);
  assert.equal(r.status, 201);
  assert.equal(
    (await upload(f, room, users[0], source, "image/jpeg", clientId)).body.id,
    r.body.id,
  );
  const asset = await f.raw(`/api/media/${r.body.id}`, {
    headers: { Cookie: users[1].cookie },
  });
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get("Cache-Control"), "no-store");
  assert.equal(asset.headers.get("Content-Type"), "image/webp");
  const body = Buffer.from(await asset.arrayBuffer()),
    meta = await sharp(body).metadata();
  assert.equal(meta.width, 1280);
  assert.equal(meta.height, 720);
  assert.equal(meta.exif, undefined);
  assert.ok(body.length <= 350 * 1024);
  const outsider = await f.signup("sin_acceso");
  assert.equal(
    (
      await f.raw(`/api/media/${r.body.id}`, {
        headers: { Cookie: outsider.cookie },
      })
    ).status,
    404,
  );
  assert.equal((await f.raw(`/api/media/${r.body.id}`)).status, 401);
  clients[1].send({
    type: "message",
    clientId: randomUUID(),
    content: {
      type: "image",
      image: { id: r.body.id, description: "No es mía" },
    },
  });
  await clients[1].wait((c) =>
    c.events.some((e) => e.code === "invalid_message"),
  );
  clients[0].send({
    type: "message",
    clientId: randomUUID(),
    content: {
      type: "image",
      image: { id: r.body.id, description: "Una imagen para conversar" },
    },
  });
  await clients[1].wait((c) => c.snapshot.messages.length === 1);
  const message = clients[1].snapshot.messages[0];
  assert.equal(message.type, "image");
  const reported = await report(f, room, users[1], users[0], {
    reason: "contenido",
    messageId: message.id,
  });
  assert.equal(reported.status, 201);
  assert.equal(
    (await action(f, mod, reported.body.id, "hide-image")).status,
    200,
  );
  await clients[1].wait((c) => c.snapshot.hiddenImages.includes(r.body.id));
  assert.equal(
    (
      await f.raw(`/api/media/${r.body.id}`, {
        headers: { Cookie: users[1].cookie },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await f.raw(`/api/media/${r.body.id}`, {
        headers: { Cookie: mod.cookie },
      })
    ).status,
    200,
  );
  await f.restart();
  assert.equal(
    (
      await f.raw(`/api/media/${r.body.id}`, {
        headers: { Cookie: users[1].cookie },
      })
    ).status,
    404,
  );
});

test("imágenes: archivos inválidos, SVG, animación, tamaño, origen, cuenta ajena y archivos de otra sala se rechazan", async (t) => {
  const { f, users, clients, room } = await group(t);
  const mod = await f.signup("mod_archivos");
  promote(f, mod);
  const image = await png();
  for (const [body, type] of [
    [Buffer.from('<svg onload="alert(1)"/>'), "image/svg+xml"],
    [Buffer.from("esto no es una foto"), "image/png"],
    [image, "image/jpeg"],
    [Buffer.alloc(2 * 1024 * 1024 + 1), "image/png"],
  ])
    assert.equal((await upload(f, room, users[0], body, type)).status, 422);
  const control = Buffer.alloc(20);
  control.writeUInt32BE(8, 0);
  control.write("acTL", 4);
  control.writeUInt32BE(2, 8);
  control.writeUInt32BE(crc32(control.subarray(4, 16)), 16);
  const apng = Buffer.concat([
    image.subarray(0, 33),
    control,
    image.subarray(33),
  ]);
  assert.equal((await upload(f, room, users[0], apng)).status, 422);
  const giant = await sharp({
    create: { width: 5000, height: 4000, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  assert.equal((await upload(f, room, users[0], giant)).status, 422);
  const frames = Buffer.alloc(4 * 8 * 3);
  for (let i = 0; i < 32; i++) frames[i * 3 + (i < 16 ? 0 : 2)] = 255;
  const animation = await sharp(frames, {
    raw: { width: 4, height: 8, channels: 3, pageHeight: 4 },
  })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
  assert.equal((await sharp(animation).metadata()).pages, 2);
  assert.equal(
    (await upload(f, room, users[0], animation, "image/webp")).status,
    422,
  );
  assert.equal(
    (
      await upload(
        f,
        room,
        users[0],
        image,
        "image/png",
        randomUUID(),
        "https://otro.example",
      )
    ).status,
    403,
  );
  const outsider = await f.signup("otra_sala");
  assert.equal((await upload(f, room, outsider, image)).status, 404);
  clients[0].send({
    type: "message",
    clientId: randomUUID(),
    content: {
      type: "image",
      image: { id: randomUUID(), description: "referencia falsa" },
    },
  });
  await clients[0].wait((c) =>
    c.events.some((e) => e.code === "invalid_message"),
  );
});

test("suspensión: caduca y una apelación antigua no puede levantar una sanción posterior", async (t) => {
  const { f, users, room } = await group(t);
  const mod = await f.signup("mod_recurso");
  promote(f, mod);
  const r = await report(f, room, users[0], users[1]);
  assert.equal((await action(f, mod, r.body.id, "suspend")).status, 200);
  const appeal = await f.request(
    "/api/appeals",
    "POST",
    { note: "Solicito una revisión de esta sanción." },
    users[1].cookie,
  );
  assert.equal(appeal.status, 200);
  const next = await report(f, room, users[2], users[1], {
    reason: "amenazas",
  });
  assert.equal((await action(f, mod, next.body.id, "ban")).status, 200);
  assert.equal(
    (
      await f.request(
        "/api/moderation/appeals",
        "POST",
        {
          id: appeal.body.id,
          decision: "restore",
          note: "Revisión anterior, no afecta al nuevo hecho.",
        },
        mod.cookie,
      )
    ).status,
    422,
  );
  assert.equal(
    (await f.request("/api/session", "GET", undefined, users[1].cookie)).body
      .restriction.kind,
    "ban",
  );
  const suspension = await report(f, room, users[0], users[2], {
    reason: "spam",
  });
  await action(f, mod, suspension.body.id, "suspend");
  f.advance(60 * 60_000 + 1);
  assert.equal(
    (await f.request("/api/session", "GET", undefined, users[2].cookie)).body
      .restriction,
    null,
  );
  assert.equal(
    (await f.request("/api/activities", "GET", undefined, users[2].cookie))
      .status,
    200,
  );
});

test("moderador: retirar sin votación persiste y el rol solo se concede fuera de la API", async (t) => {
  const { f, users, clients, room } = await group(t);
  const mod = await f.signup("mod_retiro");
  promote(f, mod);
  assert.equal(
    (
      await f.request("/api/auth/register", "POST", {
        username: "falso_mod",
        alias: "Falso",
        password: "Una frase larga para pruebas 123",
        adult: true,
        moderator: true,
      })
    ).status,
    422,
  );
  const r = await report(f, room, users[0], users[1]);
  const closed = once(clients[1].ws, "close");
  assert.equal((await action(f, mod, r.body.id, "remove-room")).status, 200);
  assert.equal((await closed)[0], 4005);
  assert.equal(
    (await f.request(`/api/history/${room}`, "GET", undefined, users[1].cookie))
      .status,
    404,
  );
  await f.restart();
  assert.equal(await f.rejected(users[1]), 403);
});

test("imágenes: cuotas concurrentes son acotadas y salir con bloqueo impide nuevas cargas", async (t) => {
  const { f, users, clients, room } = await group(t);
  const mod = await f.signup("mod_cuotas");
  promote(f, mod);
  const image = await png();
  // Fill to the last place with synthetic assets in this private test database.
  db(f, (d) => {
    const q = d.prepare(
      "INSERT INTO media(id,room_id,owner_id,client_id,body,created_at) VALUES(?,?,?,?,?,?)",
    );
    for (let i = 0; i < 19; i++)
      q.run(
        randomUUID(),
        room,
        users[0].id,
        randomUUID(),
        Buffer.from("fixture"),
        Date.now(),
      );
  });
  const uploads = await Promise.all([
    upload(f, room, users[0], image),
    upload(f, room, users[1], image),
  ]);
  assert.equal(uploads.filter((r) => r.status === 201).length, 1);
  assert.equal(uploads.filter((r) => r.status === 422).length, 1);
  assert.equal(
    db(
      f,
      (d) =>
        d.prepare("SELECT COUNT(*) AS n FROM media WHERE room_id=?").get(room)
          .n,
    ),
    20,
  );
  const closed = once(clients[0].ws, "close");
  clients[0].send({ type: "block", participantId: users[1].id });
  await closed;
  assert.equal((await upload(f, room, users[0], image)).status, 422);
});

test("cerrar el encuentro cancela en el mismo estado una votación y rechaza el voto tardío", async (t) => {
  const { f, users, clients } = await group(t);
  f.advance(40 * 60_000 - 30_000);
  clients[0].send({
    type: "open-removal",
    targetId: users[1].id,
    reason: "spam",
  });
  await clients[2].wait((c) => !!c.snapshot.safety.ballot);
  const id = clients[2].snapshot.safety.ballot.id;
  f.advance(30001);
  await clients[2].wait((c) => c.snapshot.session.phase === "closed");
  assert.equal(clients[2].snapshot.safety.ballot, null);
  clients[2].send({ type: "removal-vote", ballotId: id, choice: "remove" });
  await clients[2].wait((c) =>
    c.events.some((e) => e.code === "vote_rejected"),
  );
  assert.deepEqual(clients[2].snapshot.safety.expelled, []);
});
