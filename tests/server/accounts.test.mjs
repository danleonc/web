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
  async function socket(person, room = "cafe") {
    const ws = new WebSocket(base.replace("http:", "ws:") + `/api/rooms/${room}`, {
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
  async function rejected(person, room = "cafe") {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        base.replace("http:", "ws:") + `/api/rooms/${room}`,
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

test("Plaza compartida exige cuenta confirmada y protege autoría y origen", async (t) => {
  const f = await fixture(t, { plazaEnabled: true });
  const ana = await f.signup("plaza_ana");
  const bea = await f.signup("plaza_bea");
  const pending = await f.request("/api/auth/register", "POST", { username: "plaza_pendiente", alias: "Pendiente", adult: true, password });
  const data = { topic: "cultura", title: "Una pregunta", body: "¿Qué opinas?" };
  assert.equal((await f.request("/api/plaza/posts", "POST", data)).status, 401);
  assert.equal((await f.request("/api/plaza/posts", "POST", data, pending.cookie)).status, 403);
  assert.equal((await f.request("/api/plaza/posts", "POST", data, ana.cookie, "https://ajeno.example")).status, 403);
  assert.equal((await f.request("/api/plaza/posts", "POST", { ...data, authorId: bea.id }, ana.cookie)).status, 422);
  const created = await f.request("/api/plaza/posts", "POST", data, ana.cookie);
  assert.equal(created.status, 201);
  const id = created.body.post.id;
  assert.equal((await f.request(`/api/plaza/posts/${id}`, "PATCH", data, bea.cookie)).status, 404);
  const reply = await f.request(`/api/plaza/posts/${id}/replies`, "POST", { body: "Hola" }, bea.cookie);
  assert.equal(reply.status, 201);
  assert.equal((await f.request(`/api/plaza/replies/${reply.body.reply.id}`, "PATCH", { body: "Suplantación" }, ana.cookie)).status, 404);
  assert.equal((await f.request(`/api/plaza/replies/${reply.body.reply.id}`, "PATCH", { body: "Hola de nuevo" }, bea.cookie)).status, 200);
  await f.restart();
  const list = await f.request("/api/plaza/posts", "GET", undefined, bea.cookie);
  assert.equal(list.body.posts[0].title, "Una pregunta");
  const replies = await f.request(`/api/plaza/posts/${id}/replies`, "GET", undefined, ana.cookie);
  assert.equal(replies.body.replies[0].body, "Hola de nuevo");
  assert.equal((await f.request(`/api/plaza/replies/${reply.body.reply.id}`, "DELETE", undefined, ana.cookie)).status, 404);
  assert.equal((await f.request(`/api/plaza/posts/${id}`, "DELETE", undefined, ana.cookie)).status, 200);
});

test("Plaza: reportes guardan evidencia del servidor y solo moderación puede revisarlos", async (t) => {
  const f = await fixture(t, { plazaEnabled: true });
  const author = await f.signup("reporte_autor");
  const reporter = await f.signup("reporte_lector");
  const moderator = await f.signup("reporte_mod");
  const db = new DatabaseSync(f.path);
  db.prepare("INSERT INTO moderators(user_id) VALUES(?)").run(moderator.id);
  db.close();
  const data = { topic: "cultura", title: "Título original", body: "Contenido original" };
  const post = (await f.request("/api/plaza/posts", "POST", data, author.cookie)).body.post;
  const reportData = { kind: "post", contentId: post.id, reason: "acoso", note: "Explicación" };
  assert.equal((await f.request("/api/plaza/reports", "POST", reportData, author.cookie)).status, 422);
  assert.equal((await f.request("/api/plaza/reports", "POST", { ...reportData, evidence: "inventado" }, reporter.cookie)).status, 422);
  assert.equal((await f.request("/api/plaza/reports", "POST", reportData, reporter.cookie, "https://ajeno.example")).status, 403);
  const sent = await f.request("/api/plaza/reports", "POST", reportData, reporter.cookie);
  assert.equal(sent.status, 201);
  const duplicate = await f.request("/api/plaza/reports", "POST", reportData, reporter.cookie);
  assert.equal(duplicate.body.id, sent.body.id);
  assert.equal((await f.request("/api/plaza/posts", "GET", undefined, reporter.cookie)).body.posts.length, 1);
  assert.equal((await f.request("/api/plaza/moderation/reports", "GET", undefined, reporter.cookie)).status, 403);
  await f.request(`/api/plaza/posts/${post.id}`, "PATCH", { ...data, body: "Contenido cambiado" }, author.cookie);
  await f.restart();
  const queue = await f.request("/api/plaza/moderation/reports", "GET", undefined, moderator.cookie);
  assert.equal(queue.status, 200);
  assert.equal(queue.body.reports[0].evidence.body, "Contenido original");
  const decision = { reportId: sent.body.id, action: "hide", reason: "Contenido revisado" };
  assert.equal((await f.request("/api/plaza/moderation/actions", "POST", decision, reporter.cookie)).status, 403);
  assert.equal((await f.request("/api/plaza/moderation/actions", "POST", decision, moderator.cookie)).status, 200);
  assert.equal((await f.request("/api/plaza/posts", "GET", undefined, reporter.cookie)).body.posts.length, 0);
  assert.equal((await f.request("/api/plaza/moderation/actions", "POST", decision, moderator.cookie)).status, 422);
  await f.restart();
  assert.equal((await f.request("/api/plaza/posts", "GET", undefined, author.cookie)).body.posts.length, 0);
  const reviewed = (await f.request("/api/plaza/moderation/reports", "GET", undefined, moderator.cookie)).body.reports[0];
  assert.equal(reviewed.status, "resolved");
  assert.equal(reviewed.evidence.body, "Contenido original");
});

test("Plaza: bloqueo persistente bidireccional y desbloqueo solo por la cuenta que bloqueó", async (t) => {
  const f = await fixture(t, { plazaEnabled: true });
  const ana = await f.signup("bloqueo_ana"); const bea = await f.signup("bloqueo_bea");
  const data = { topic: "crear", title: "Tema", body: "Una idea" };
  const postA = (await f.request("/api/plaza/posts", "POST", data, ana.cookie)).body.post;
  const postB = (await f.request("/api/plaza/posts", "POST", data, bea.cookie)).body.post;
  const target = { kind: "post", contentId: postB.id };
  assert.equal((await f.request("/api/plaza/blocks", "POST", { kind: "post", contentId: postA.id }, ana.cookie)).status, 422);
  assert.equal((await f.request("/api/plaza/blocks", "POST", target, ana.cookie, "https://ajeno.example")).status, 403);
  assert.equal((await f.request("/api/plaza/blocks", "POST", target, ana.cookie)).status, 200);
  assert.equal((await f.request("/api/plaza/posts", "GET", undefined, ana.cookie)).body.posts.length, 1);
  assert.equal((await f.request("/api/plaza/posts", "GET", undefined, bea.cookie)).body.posts.length, 1);
  assert.equal((await f.request(`/api/plaza/posts/${postA.id}/replies`, "POST", { body: "Hola" }, bea.cookie)).status, 422);
  await f.restart();
  const list = await f.request("/api/plaza/blocks", "GET", undefined, ana.cookie);
  assert.equal(list.body.blocks[0].id, bea.id);
  assert.equal((await f.request("/api/plaza/blocks", "GET", undefined, bea.cookie)).body.blocks.length, 0);
  assert.equal((await f.request(`/api/plaza/blocks/${bea.id}`, "DELETE", undefined, bea.cookie)).status, 404);
  assert.equal((await f.request(`/api/plaza/blocks/${bea.id}`, "DELETE", undefined, ana.cookie)).status, 200);
  assert.equal((await f.request("/api/plaza/posts", "GET", undefined, ana.cookie)).body.posts.length, 2);
  await f.restart();
  assert.equal((await f.request("/api/plaza/posts", "GET", undefined, bea.cookie)).body.posts.length, 2);
});

test("bloquear desde Plaza retira a quien bloquea de un encuentro compartido", async (t) => {
  const f = await fixture(t, { plazaEnabled: true });
  const ana = await f.signup("plaza_sala_ana"); const bea = await f.signup("plaza_sala_bea");
  const post = (await f.request("/api/plaza/posts", "POST", { topic: "crear", title: "Tema", body: "Idea" }, bea.cookie)).body.post;
  for (const person of [ana, bea]) assert.equal((await f.request("/api/reservations/cafe", "POST", undefined, person.cookie)).status, 200);
  f.advance(600_000);
  const first = await f.socket(ana); const second = await f.socket(bea);
  await first.wait((c) => c.snapshot.session.participants.filter((p) => p.present).length === 2);
  const closed = once(first.ws, "close");
  assert.equal((await f.request("/api/plaza/blocks", "POST", { kind: "post", contentId: post.id }, ana.cookie)).status, 200);
  await closed;
  assert.equal(await f.rejected(ana), 403);
  const secondClosed = once(second.ws, "close"); second.ws.close(); await secondClosed;
});

test("La API de Plaza permanece desactivada por defecto", async (t) => {
  const f = await fixture(t);
  const person = await f.signup("plaza_default");
  assert.equal((await f.request("/api/plaza/posts", "GET", undefined, person.cookie)).status, 404);
});

test("Plaza: reportar una respuesta conserva evidencia incluso si la autora la elimina", async (t) => {
  const f = await fixture(t, { plazaEnabled: true });
  const owner = await f.signup("plaza_duena");
  const author = await f.signup("plaza_autora");
  const moderator = await f.signup("plaza_moderadora");
  const db = new DatabaseSync(f.path);
  db.prepare("INSERT INTO moderators(user_id) VALUES(?)").run(moderator.id); db.close();
  const post = (await f.request("/api/plaza/posts", "POST", { topic: "crear", title: "Conversación", body: "Contenido" }, owner.cookie)).body.post;
  const reply = (await f.request(`/api/plaza/posts/${post.id}/replies`, "POST", { body: "Respuesta reportada" }, author.cookie)).body.reply;
  const data = { kind: "reply", contentId: reply.id, reason: "spam", note: "" };
  const sent = await f.request("/api/plaza/reports", "POST", data, owner.cookie);
  assert.equal(sent.status, 201);
  assert.equal((await f.request(`/api/plaza/replies/${reply.id}`, "DELETE", undefined, author.cookie)).status, 200);
  const queue = await f.request("/api/plaza/moderation/reports", "GET", undefined, moderator.cookie);
  assert.equal(queue.body.reports[0].evidence.body, "Respuesta reportada");
  assert.equal((await f.request("/api/plaza/moderation/actions", "POST", { reportId: sent.body.id, action: "dismiss", reason: "Caso revisado" }, moderator.cookie)).status, 200);
  const audit = new DatabaseSync(f.path);
  try {
    const action = audit.prepare("SELECT action,reason,moderator_id FROM plaza_moderation_actions WHERE report_id=?").get(sent.body.id);
    assert.equal(action.action, "dismiss"); assert.equal(action.reason, "Caso revisado"); assert.equal(action.moderator_id, moderator.id);
  } finally { audit.close(); }
});

test("Plaza: la autora puede apelar una retirada y otro moderador revisarla", async (t) => {
  const f = await fixture(t, { plazaEnabled: true });
  const author = await f.signup("apel_autora"); const reporter = await f.signup("apel_lector");
  const modA = await f.signup("apel_mod_a"); const modB = await f.signup("apel_mod_b");
  const db = new DatabaseSync(f.path);
  db.prepare("INSERT INTO moderators(user_id) VALUES(?)").run(modA.id); db.prepare("INSERT INTO moderators(user_id) VALUES(?)").run(modB.id); db.close();
  const post = (await f.request("/api/plaza/posts", "POST", { topic: "crear", title: "Mi publicación", body: "Contenido" }, author.cookie)).body.post;
  const report = (await f.request("/api/plaza/reports", "POST", { kind: "post", contentId: post.id, reason: "spam", note: "Privado" }, reporter.cookie)).body;
  assert.equal((await f.request("/api/plaza/moderation/actions", "POST", { reportId: report.id, action: "hide", reason: "Revisión inicial" }, modA.cookie)).status, 200);
  const notices = await f.request("/api/plaza/my-moderation", "GET", undefined, author.cookie);
  assert.equal(notices.status, 200); assert.equal(notices.body.actions[0].reportId, report.id);
  assert.equal(JSON.stringify(notices.body).includes("Privado"), false);
  assert.equal((await f.request("/api/plaza/appeals", "POST", { reportId: report.id, note: "Solicito revisión" }, reporter.cookie)).status, 422);
  const appeal = await f.request("/api/plaza/appeals", "POST", { reportId: report.id, note: "Solicito revisión" }, author.cookie);
  assert.equal(appeal.status, 201);
  assert.equal((await f.request("/api/plaza/appeals", "POST", { reportId: report.id, note: "Otra revisión" }, author.cookie)).status, 422);
  assert.equal((await f.request("/api/plaza/moderation/appeals", "GET", undefined, author.cookie)).status, 403);
  const decision = { id: appeal.body.id, decision: "restore", note: "Revisión independiente" };
  assert.equal((await f.request("/api/plaza/moderation/appeals", "POST", decision, modA.cookie)).status, 422);
  assert.equal((await f.request("/api/plaza/moderation/appeals", "POST", decision, modB.cookie)).status, 200);
  assert.equal((await f.request("/api/plaza/posts", "GET", undefined, reporter.cookie)).body.posts[0].id, post.id);
  await f.restart();
  const result = await f.request("/api/plaza/my-moderation", "GET", undefined, author.cookie);
  assert.equal(result.body.actions[0].appealStatus, "restored");
});

test("Plaza: una apelación restaurada no anula otra retirada vigente", async (t) => {
  const f = await fixture(t, { plazaEnabled: true });
  const owner = await f.signup("multi_owner"); const r1 = await f.signup("multi_lector1"); const r2 = await f.signup("multi_lector2");
  const m1 = await f.signup("multi_mod1"); const m2 = await f.signup("multi_mod2");
  const db = new DatabaseSync(f.path); db.prepare("INSERT INTO moderators(user_id) VALUES(?)").run(m1.id); db.prepare("INSERT INTO moderators(user_id) VALUES(?)").run(m2.id); db.close();
  const post = (await f.request("/api/plaza/posts", "POST", { topic: "crear", title: "Dos reportes", body: "Texto" }, owner.cookie)).body.post;
  const data = { kind: "post", contentId: post.id, reason: "spam", note: "" };
  const ids = [];
  for (const person of [r1, r2]) ids.push((await f.request("/api/plaza/reports", "POST", data, person.cookie)).body.id);
  for (const id of ids) assert.equal((await f.request("/api/plaza/moderation/actions", "POST", { reportId: id, action: "hide", reason: "Revisión inicial" }, m1.cookie)).status, 200);
  const one = await f.request("/api/plaza/appeals", "POST", { reportId: ids[0], note: "Revisar primera" }, owner.cookie);
  assert.equal((await f.request("/api/plaza/moderation/appeals", "POST", { id: one.body.id, decision: "restore", note: "Revisión distinta" }, m2.cookie)).status, 200);
  assert.equal((await f.request("/api/plaza/posts", "GET", undefined, r1.cookie)).body.posts.length, 0);
  const two = await f.request("/api/plaza/appeals", "POST", { reportId: ids[1], note: "Revisar segunda" }, owner.cookie);
  assert.equal((await f.request("/api/plaza/moderation/appeals", "POST", { id: two.body.id, decision: "restore", note: "Revisión distinta" }, m2.cookie)).status, 200);
  assert.equal((await f.request("/api/plaza/posts", "GET", undefined, r1.cookie)).body.posts.length, 1);
});

test("Conexiones: consentimiento explícito, chat aislado y cierre por bloqueo", async (t) => {
  const f = await fixture(t, { plazaEnabled: true });
  const ana = await f.signup("con_ana"); const bea = await f.signup("con_bea"); const cata = await f.signup("con_cata");
  const post = (await f.request("/api/plaza/posts", "POST", { topic: "crear", title: "Tema", body: "Hola" }, bea.cookie)).body.post;
  const payload = { kind: "post", contentId: post.id, note: "Me gustaría seguir conversando" };
  assert.equal((await f.request("/api/plaza/invitations", "POST", payload, ana.cookie, "https://ajeno.example")).status, 403);
  assert.equal((await f.request("/api/plaza/invitations", "POST", { ...payload, senderId: bea.id }, ana.cookie)).status, 422);
  const invitation = await f.request("/api/plaza/invitations", "POST", payload, ana.cookie);
  assert.equal(invitation.status, 201); const id = invitation.body.invitation.id;
  const retry = await f.request("/api/plaza/invitations", "POST", payload, ana.cookie);
  assert.equal(retry.body.invitation.id, id);
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "GET", undefined, ana.cookie)).status, 404);
  assert.equal((await f.request(`/api/plaza/invitations/${id}/decision`, "POST", { action: "accept" }, ana.cookie)).status, 404);
  assert.equal((await f.request(`/api/plaza/invitations/${id}/decision`, "POST", { action: "accept" }, cata.cookie)).status, 404);
  assert.equal((await f.request(`/api/plaza/invitations/${id}/decision`, "POST", { action: "accept" }, bea.cookie)).status, 200);
  const message = { clientId: "message-test-0001", body: "Un mensaje compartido" };
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "POST", message, ana.cookie)).status, 201);
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "POST", message, ana.cookie)).status, 201);
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "GET", undefined, cata.cookie)).status, 404);
  await f.restart();
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "GET", undefined, bea.cookie)).body.messages.length, 1);
  assert.equal((await f.request("/api/plaza/blocks", "POST", { kind: "post", contentId: post.id }, ana.cookie)).status, 200);
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "GET", undefined, bea.cookie)).status, 404);
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "POST", { clientId: "message-test-0002", body: "No debe enviarse" }, bea.cookie)).status, 404);
  assert.equal((await f.request(`/api/plaza/blocks/${bea.id}`, "DELETE", undefined, ana.cookie)).status, 200);
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "GET", undefined, ana.cookie)).status, 404);
});

test("Conexiones: solo el autor retira su mensaje y se conserva evidencia de un reporte", async (t) => {
  const f = await fixture(t, { plazaEnabled: true }); const ana = await f.signup("retira_ana"); const bea = await f.signup("retira_bea"); const mod = await f.signup("retira_mod");
  const db = new DatabaseSync(f.path); db.prepare("INSERT INTO moderators(user_id) VALUES(?)").run(mod.id); db.close();
  const post = (await f.request("/api/plaza/posts", "POST", { topic: "crear", title: "Tema", body: "Idea" }, bea.cookie)).body.post;
  const id = (await f.request("/api/plaza/invitations", "POST", { kind: "post", contentId: post.id, note: "" }, ana.cookie)).body.invitation.id;
  await f.request(`/api/plaza/invitations/${id}/decision`, "POST", { action: "accept" }, bea.cookie);
  const msg = (await f.request(`/api/plaza/connections/${id}/messages`, "POST", { clientId: "remove-message-1", body: "Mensaje a retirar" }, ana.cookie)).body.message;
  const report = await f.request("/api/plaza/reports", "POST", { kind: "private", contentId: msg.id, reason: "acoso", note: "" }, bea.cookie); assert.equal(report.status, 201);
  const path = `/api/plaza/connections/${id}/messages/${msg.id}`;
  assert.equal((await f.request(path, "DELETE", undefined, bea.cookie)).status, 404);
  assert.equal((await f.request(path, "DELETE", undefined, ana.cookie, "https://ajeno.example")).status, 403);
  assert.equal((await f.request(path, "DELETE", undefined, ana.cookie)).status, 200);
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "POST", { clientId: "remove-message-1", body: "Mensaje a retirar" }, ana.cookie)).status, 422);
  await f.restart();
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "GET", undefined, bea.cookie)).body.messages.length, 0);
  const queue = await f.request("/api/plaza/moderation/reports", "GET", undefined, mod.cookie); assert.equal(queue.body.reports[0].evidence.body, "Mensaje a retirar");
  assert.equal(JSON.stringify((await f.request("/api/account/export", "GET", undefined, ana.cookie)).body.privateMessages).includes("Mensaje a retirar"), false);
});

test("Conexiones: solicitudes cruzadas no se aceptan automáticamente y el rechazo permite una solicitud nueva", async (t) => {
  const f = await fixture(t, { plazaEnabled: true }); const ana = await f.signup("solicita_ana"); const bea = await f.signup("solicita_bea");
  const data = { topic: "crear", title: "Tema", body: "Idea" };
  const postA = (await f.request("/api/plaza/posts", "POST", data, ana.cookie)).body.post;
  const postB = (await f.request("/api/plaza/posts", "POST", data, bea.cookie)).body.post;
  const first = await f.request("/api/plaza/invitations", "POST", { kind: "post", contentId: postB.id, note: "Hola" }, ana.cookie);
  const crossed = await f.request("/api/plaza/invitations", "POST", { kind: "post", contentId: postA.id, note: "Hola" }, bea.cookie);
  assert.equal(crossed.status, 422);
  assert.equal((await f.request(`/api/plaza/connections/${first.body.invitation.id}/messages`, "GET", undefined, ana.cookie)).status, 404);
  assert.equal((await f.request(`/api/plaza/invitations/${first.body.invitation.id}/decision`, "POST", { action: "decline" }, bea.cookie)).status, 200);
  const next = await f.request("/api/plaza/invitations", "POST", { kind: "post", contentId: postA.id, note: "Otra ocasión" }, bea.cookie);
  assert.equal(next.status, 201); assert.notEqual(next.body.invitation.id, first.body.invitation.id);
  assert.equal((await f.request(`/api/plaza/invitations/${next.body.invitation.id}/decision`, "POST", { action: "withdraw" }, bea.cookie)).status, 200);
  assert.equal((await f.request(`/api/plaza/invitations/${next.body.invitation.id}/decision`, "POST", { action: "accept" }, ana.cookie)).status, 404);
});

test("Conexiones: el historial muestra los mensajes más recientes en orden de envío", async (t) => {
  const f = await fixture(t, { plazaEnabled: true }); const ana = await f.signup("hist_ana"); const bea = await f.signup("hist_bea");
  const post = (await f.request("/api/plaza/posts", "POST", { topic: "crear", title: "Tema", body: "Idea" }, bea.cookie)).body.post;
  const id = (await f.request("/api/plaza/invitations", "POST", { kind: "post", contentId: post.id, note: "" }, ana.cookie)).body.invitation.id;
  await f.request(`/api/plaza/invitations/${id}/decision`, "POST", { action: "accept" }, bea.cookie);
  for (let i = 0; i < 101; i++) assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "POST", { clientId: `message-${String(i).padStart(4, "0")}`, body: `Mensaje ${i}` }, ana.cookie)).status, 201);
  const messages = (await f.request(`/api/plaza/connections/${id}/messages`, "GET", undefined, bea.cookie)).body.messages;
  assert.equal(messages.length, 100); assert.equal(messages[0].body, "Mensaje 1"); assert.equal(messages[99].body, "Mensaje 100");
});

test("Conexiones: reportar un mensaje privado y bloquear desde la conversación", async (t) => {
  const f = await fixture(t, { plazaEnabled: true }); const ana = await f.signup("priv_ana"); const bea = await f.signup("priv_bea");
  const cata = await f.signup("priv_cata"); const mod = await f.signup("priv_mod");
  const db = new DatabaseSync(f.path); db.prepare("INSERT INTO moderators(user_id) VALUES(?)").run(mod.id); db.close();
  const post = (await f.request("/api/plaza/posts", "POST", { topic: "crear", title: "Tema", body: "Idea" }, bea.cookie)).body.post;
  const id = (await f.request("/api/plaza/invitations", "POST", { kind: "post", contentId: post.id, note: "" }, ana.cookie)).body.invitation.id;
  await f.request(`/api/plaza/invitations/${id}/decision`, "POST", { action: "accept" }, bea.cookie);
  const msg = (await f.request(`/api/plaza/connections/${id}/messages`, "POST", { clientId: "private-message-1", body: "Mensaje señalado" }, bea.cookie)).body.message;
  const report = { kind: "private", contentId: msg.id, reason: "acoso", note: "" };
  assert.equal((await f.request("/api/plaza/reports", "POST", report, cata.cookie)).status, 422);
  assert.equal((await f.request("/api/plaza/reports", "POST", report, bea.cookie)).status, 422);
  const sent = await f.request("/api/plaza/reports", "POST", report, ana.cookie); assert.equal(sent.status, 201);
  const queue = await f.request("/api/plaza/moderation/reports", "GET", undefined, mod.cookie);
  assert.equal(queue.body.reports[0].evidence.body, "Mensaje señalado");
  assert.equal((await f.request("/api/plaza/moderation/actions", "POST", { reportId: sent.body.id, action: "hide", reason: "Revisión de mensaje" }, mod.cookie)).status, 200);
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "GET", undefined, ana.cookie)).body.messages.length, 0);
  assert.equal((await f.request(`/api/plaza/connections/${id}/block`, "POST", {}, cata.cookie)).status, 404);
  assert.equal((await f.request(`/api/plaza/connections/${id}/block`, "POST", {}, ana.cookie)).status, 200);
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "GET", undefined, bea.cookie)).status, 404);
});

test("Conexiones: bloquear en un encuentro también cierra la conversación privada", async (t) => {
  const f = await fixture(t, { plazaEnabled: true }); const ana = await f.signup("ws_bloq_ana"); const bea = await f.signup("ws_bloq_bea");
  const post = (await f.request("/api/plaza/posts", "POST", { topic: "crear", title: "Tema", body: "Idea" }, bea.cookie)).body.post;
  const id = (await f.request("/api/plaza/invitations", "POST", { kind: "post", contentId: post.id, note: "" }, ana.cookie)).body.invitation.id;
  await f.request(`/api/plaza/invitations/${id}/decision`, "POST", { action: "accept" }, bea.cookie);
  for (const person of [ana, bea]) await f.request("/api/reservations/cafe", "POST", undefined, person.cookie);
  f.advance(600_000); const a = await f.socket(ana); const b = await f.socket(bea);
  await a.wait((c) => c.snapshot.session.participants.filter((p) => p.present).length === 2);
  const closed = once(a.ws, "close"); a.send({ type: "block", participantId: bea.id }); await closed;
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, "GET", undefined, bea.cookie)).status, 404);
  const bClosed = once(b.ws, "close"); b.ws.close(); await bClosed;
});

test("Encuentros: moderación programa varias convocatorias y las reservas permanecen separadas", async (t) => {
  const f = await fixture(t, { meetingsEnabled: true });
  const moderator = await f.signup("agenda_moderadora"); const user = await f.signup("agenda_persona");
  const db = new DatabaseSync(f.path); db.prepare("INSERT INTO moderators(user_id) VALUES(?)").run(moderator.id); db.close();
  const data = { themeId: "cafe", startsAt: f.startsAt + 3600_000, capacity: 4 };
  assert.equal((await f.request("/api/reservations/cafe", "POST", undefined, user.cookie)).status, 404);
  assert.equal((await f.request("/api/meetings", "POST", data, user.cookie)).status, 403);
  assert.equal((await f.request("/api/meetings", "POST", data, moderator.cookie, "https://ajeno.example")).status, 403);
  assert.equal((await f.request("/api/meetings", "POST", { ...data, capacity: 2 }, moderator.cookie)).status, 422);
  assert.equal((await f.request("/api/meetings", "POST", { ...data, startsAt: 1 }, moderator.cookie)).status, 422);
  const first = await f.request("/api/meetings", "POST", data, moderator.cookie); assert.equal(first.status, 201);
  assert.equal((await f.request("/api/meetings", "POST", data, moderator.cookie)).status, 422);
  const second = await f.request("/api/meetings", "POST", { ...data, startsAt: data.startsAt + 4800_000 }, moderator.cookie); assert.equal(second.status, 201);
  assert.notEqual(first.body.meeting.id, second.body.meeting.id);
  assert.equal((await f.request(`/api/reservations/${first.body.meeting.id}`, "POST", undefined, user.cookie)).status, 200);
  const overlap = await f.request("/api/meetings", "POST", { ...data, themeId: "crear", startsAt: data.startsAt + 1200_000 }, moderator.cookie);
  assert.equal((await f.request(`/api/reservations/${overlap.body.meeting.id}`, "POST", undefined, user.cookie)).status, 409);
  const adjacent = await f.request("/api/meetings", "POST", { ...data, themeId: "crear", startsAt: data.startsAt + 2400_000 }, moderator.cookie);
  assert.equal((await f.request(`/api/reservations/${adjacent.body.meeting.id}`, "POST", undefined, user.cookie)).status, 200);
  assert.equal((await f.request(`/api/reservations/${second.body.meeting.id}`, "POST", undefined, user.cookie)).status, 200);
  await f.restart();
  const list = await f.request("/api/activities", "GET", undefined, user.cookie);
  assert.equal(list.body.activities.filter((a) => [first.body.meeting.id, second.body.meeting.id].includes(a.id) && a.mine).length, 2);
  assert.equal(list.body.activities.find((a) => a.id === first.body.meeting.id).maximum, 4);
  assert.equal(await f.rejected(user, first.body.meeting.id), 425);
  assert.equal(await f.rejected(moderator, first.body.meeting.id), 403);
  f.advance(4200_000);
  const client = await f.socket(user, first.body.meeting.id);
  assert.equal(client.snapshot.session.participants.filter((p) => p.present).length, 1);
  const closed = once(client.ws, "close"); client.ws.close(); await closed;
});

test("Encuentros programados respetan cupos y reúnen tres cuentas reales", async (t) => {
  const f = await fixture(t, { meetingsEnabled: true });
  const moderator = await f.signup("reunion_mod"); const people = [];
  for (let i = 0; i < 4; i++) people.push(await f.signup(`reunion_${i}`));
  const db = new DatabaseSync(f.path); db.prepare("INSERT INTO moderators(user_id) VALUES(?)").run(moderator.id); db.close();
  const result = await f.request("/api/meetings", "POST", { themeId: "crear", startsAt: f.startsAt + 3600_000, capacity: 3 }, moderator.cookie);
  const id = result.body.meeting.id;
  for (const person of people.slice(0, 3)) assert.equal((await f.request(`/api/reservations/${id}`, "POST", undefined, person.cookie)).status, 200);
  assert.equal((await f.request(`/api/reservations/${id}`, "POST", undefined, people[3].cookie)).status, 409);
  f.advance(4200_000);
  const clients = [];
  for (const person of people.slice(0, 3)) clients.push(await f.socket(person, id));
  await clients[0].wait((c) => c.snapshot.session.participants.filter((p) => p.present).length === 3);
  clients[0].send({ type: "start" });
  await clients[2].wait((c) => c.snapshot.session.phase === "question");
  f.advance(301_000);
  const listing = await f.request("/api/activities", "GET", undefined, people[2].cookie);
  const current = listing.body.activities.find((a) => a.id === id);
  assert.equal(current.accessible, true); assert.equal(current.ended, false);
  const disconnected = once(clients[2].ws, "close"); clients[2].ws.close(); await disconnected;
  clients[2] = await f.socket(people[2], id);
  for (const client of clients) { const closed = once(client.ws, "close"); client.ws.close(); await closed; }
  f.advance(41 * 60_000);
  const later = await f.request("/api/activities", "GET", undefined, people[0].cookie);
  assert.equal(later.body.activities.some((a) => a.id === id), false);
});

test("Encuentros: cancelar conserva un aviso para quienes reservaron y bloquea nuevos ingresos", async (t) => {
  const f = await fixture(t, { meetingsEnabled: true });
  const mod = await f.signup("cancel_mod"); const person = await f.signup("cancel_persona"); const other = await f.signup("cancel_otra");
  const db = new DatabaseSync(f.path); db.prepare("INSERT INTO moderators(user_id) VALUES(?)").run(mod.id); db.close();
  const meeting = await f.request("/api/meetings", "POST", { themeId: "cafe", startsAt: f.startsAt + 3600_000, capacity: 4 }, mod.cookie);
  const id = meeting.body.meeting.id;
  assert.equal((await f.request(`/api/reservations/${id}`, "POST", undefined, person.cookie)).status, 200);
  const payload = { reason: "No estará disponible la persona anfitriona" };
  assert.equal((await f.request(`/api/meetings/${id}/cancel`, "POST", payload, person.cookie)).status, 403);
  assert.equal((await f.request(`/api/meetings/${id}/cancel`, "POST", payload, mod.cookie, "https://ajeno.example")).status, 403);
  assert.equal((await f.request(`/api/meetings/${id}/cancel`, "POST", payload, mod.cookie)).status, 200);
  assert.equal((await f.request(`/api/reservations/${id}`, "POST", undefined, other.cookie)).status, 409);
  assert.equal(await f.rejected(person, id), 410);
  await f.restart();
  const mine = (await f.request("/api/activities", "GET", undefined, person.cookie)).body.activities.find((a) => a.id === id);
  assert.equal(mine.cancelled, true); assert.equal(mine.cancellationReason, payload.reason); assert.equal(mine.mine, true);
  assert.equal((await f.request("/api/activities", "GET", undefined, other.cookie)).body.activities.some((a) => a.id === id), false);
  f.advance(2 * 3600_000);
  assert.equal((await f.request("/api/activities", "GET", undefined, person.cookie)).body.activities.some((a) => a.id === id), true);
  assert.equal((await f.request(`/api/reservations/${id}`, "DELETE", undefined, person.cookie)).status, 200);
  assert.equal((await f.request("/api/activities", "GET", undefined, person.cookie)).body.activities.some((a) => a.id === id), false);
});

test("Plaza limita reportes nuevos y no consume cuota en duplicados", async (t) => {
  const f = await fixture(t, { plazaEnabled: true });
  const author = await f.signup("limite_autor"); const reporter = await f.signup("limite_lector");
  let first;
  for (let i = 0; i < 6; i++) {
    const post = (await f.request("/api/plaza/posts", "POST", { topic: "crear", title: `Caso ${i}`, body: "Contenido" }, author.cookie)).body.post;
    const report = { kind: "post", contentId: post.id, reason: "spam", note: "" };
    const result = await f.request("/api/plaza/reports", "POST", report, reporter.cookie);
    assert.equal(result.status, i < 5 ? 201 : 422);
    if (i === 0) { first = result.body.id; assert.equal((await f.request("/api/plaza/reports", "POST", report, reporter.cookie)).body.id, first); }
  }
  assert.ok(first);
});

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
  for (let i = 0; i < 55; i++) {
    const clientId = randomUUID();
    clients[0].send({
      type: "message",
      clientId,
      content: { type: "text", text: `Guardado ${i}` },
    });
    await clients[0].wait((c) => c.events.some((e) => e.type === "ack" && e.clientId === clientId));
    await clients[2].wait((c) => c.snapshot.messages.at(-1)?.text === `Guardado ${i}`);
  }
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
