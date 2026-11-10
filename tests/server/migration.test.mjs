import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Storage, digest } from "../../server/storage.ts";
import { ModerationStore } from "../../server/moderation.ts";
import { createSession } from "../../src/room/engine.ts";
import { PlazaStore } from "../../server/plaza.ts";
test("actualizar v5 conserva cuentas y permite guardar contenido de Plaza", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexafia-v5-"));
  const path = join(dir, "old.sqlite");
  try {
    const previous = new Storage(path);
    previous.createAccount({ id: "legacy", username: "legacy", alias: "Persona", passwordHash: "test", recoveryHash: "test" }, 1);
    previous.db.exec("DROP TABLE scheduled_meetings; DROP TABLE plaza_private_messages; DROP TABLE plaza_connections; DROP TABLE plaza_appeal_actions; DROP TABLE plaza_appeals; DROP TABLE plaza_moderation_actions; DROP TABLE plaza_reports; DROP TABLE plaza_replies; DROP TABLE plaza_posts; PRAGMA user_version=5;");
    previous.close();
    const upgraded = new Storage(path);
    try {
      assert.equal(upgraded.account("legacy").alias, "Persona");
      const plaza = new PlazaStore(upgraded);
      plaza.createPost("legacy", { topic: "crear", title: "Ideas", body: "Primera conversación" }, 2);
      assert.equal(plaza.listPosts("legacy")[0].body, "Primera conversación");
    } finally { upgraded.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("actualizar v6 preserva publicaciones y respuestas y habilita reportes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexafia-v6-"));
  const path = join(dir, "old.sqlite");
  try {
    const original = new Storage(path);
    original.createAccount({ id: "legacy", username: "legacy", alias: "Persona", passwordHash: "test", recoveryHash: "test" }, 1);
    const plaza = new PlazaStore(original);
    const post = plaza.createPost("legacy", { topic: "crear", title: "Idea", body: "Anterior" }, 2);
    plaza.createReply("legacy", post.id, "Respuesta anterior", 3);
    original.db.exec("DROP TABLE scheduled_meetings; DROP TABLE plaza_private_messages; DROP TABLE plaza_connections; DROP TABLE plaza_appeal_actions; DROP TABLE plaza_appeals; DROP TABLE plaza_moderation_actions; DROP TABLE plaza_reports; ALTER TABLE plaza_posts DROP COLUMN hidden; ALTER TABLE plaza_replies DROP COLUMN hidden; PRAGMA user_version=6;");
    original.close();
    const upgraded = new Storage(path);
    try {
      assert.equal(new PlazaStore(upgraded).listPosts("legacy")[0].body, "Anterior");
      assert.equal(new PlazaStore(upgraded).listReplies("legacy", post.id)[0].body, "Respuesta anterior");
      assert.equal(upgraded.db.prepare("SELECT COUNT(*) AS n FROM plaza_reports").get().n, 0);
    } finally { upgraded.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("actualizar v7 conserva reportes y habilita apelaciones", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexafia-v7-")); const path = join(dir, "old.sqlite");
  try {
    const original = new Storage(path);
    original.createAccount({ id: "a", username: "a", alias: "A", passwordHash: "test", recoveryHash: "test" }, 1);
    original.createAccount({ id: "b", username: "b", alias: "B", passwordHash: "test", recoveryHash: "test" }, 1);
    original.db.prepare("INSERT INTO plaza_reports(id,reporter_id,target_id,kind,content_id,reason,note,evidence_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run("report", "a", "b", "post", "old", "spam", "", '{"title":"Anterior","body":"Contenido"}', 1);
    original.db.exec("DROP TABLE scheduled_meetings; DROP TABLE plaza_private_messages; DROP TABLE plaza_connections; DROP TABLE plaza_appeal_actions; DROP TABLE plaza_appeals; PRAGMA user_version=7;"); original.close();
    const updated = new Storage(path);
    try { assert.equal(updated.db.prepare("SELECT count(*) AS n FROM plaza_reports").get().n, 1); assert.equal(updated.db.prepare("SELECT count(*) AS n FROM plaza_appeals").get().n, 0); }
    finally { updated.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("actualizar v9 conserva conexiones y mensajes privados", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexafia-v9-")); const path = join(dir, "old.sqlite");
  try {
    const original = new Storage(path);
    for (const id of ["a", "b"]) original.createAccount({ id, username: id, alias: id, passwordHash: "test", recoveryHash: "test" }, 1);
    original.db.prepare("INSERT INTO plaza_connections VALUES(?,?,?,?,?,?,?,?,?,?,?)").run("c", "a", "b", "a", "b", "", "post", "origin", "accepted", 1, 1);
    original.db.prepare("INSERT INTO plaza_private_messages(id,connection_id,sender_id,client_id,body,created_at) VALUES(?,?,?,?,?,?)").run("m", "c", "a", "client-test", "Mensaje previo", 2);
    original.db.exec("DROP TABLE scheduled_meetings; ALTER TABLE plaza_private_messages DROP COLUMN hidden; PRAGMA user_version=9;"); original.close();
    const upgraded = new Storage(path);
    try { const message = upgraded.db.prepare("SELECT body,hidden FROM plaza_private_messages WHERE id='m'").get(); assert.equal(message.body, "Mensaje previo"); assert.equal(message.hidden, 0); }
    finally { upgraded.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("actualizar v11 conserva convocatorias y agrega estado de cancelación", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexafia-v11-")); const path = join(dir, "old.sqlite");
  try {
    const old = new Storage(path);
    old.createAccount({ id: "a", username: "a", alias: "A", passwordHash: "test", recoveryHash: "test" }, 1);
    old.db.prepare("INSERT INTO offerings VALUES(?,?)").run("meeting", 100000);
    old.db.prepare("INSERT INTO scheduled_meetings(id,theme_id,capacity,duration,created_at,created_by) VALUES(?,?,?,?,?,?)").run("meeting", "cafe", 4, 40, 1, "a");
    old.db.exec("ALTER TABLE scheduled_meetings DROP COLUMN cancellation_reason; ALTER TABLE scheduled_meetings DROP COLUMN cancelled_at; PRAGMA user_version=11;"); old.close();
    const updated = new Storage(path);
    try { const row = updated.db.prepare("SELECT theme_id,cancelled_at,cancellation_reason FROM scheduled_meetings WHERE id='meeting'").get(); assert.equal(row.theme_id, "cafe"); assert.equal(row.cancelled_at, null); assert.equal(row.cancellation_reason, null); }
    finally { updated.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("migración v1 a v12 conserva cuenta, reserva, sesión e historial con seguridad inicial vacía", async () => {
  const dir = await mkdtemp(join(tmpdir(), "afinia-upgrade-")),
    path = join(dir, "old.sqlite");
  try {
    const old = new DatabaseSync(path);
    old.exec(
      await readFile(
        new URL("./fixtures/schema-v1.sql", import.meta.url),
        "utf8",
      ),
    );
    const id = "test-account",
      room = "test-room";
    old
      .prepare("INSERT INTO accounts VALUES(?,?,?,?,?,?)")
      .run(id, "legado", "Legado", "test-only", "test-only", 1);
    old.prepare("INSERT INTO offerings VALUES(?,?)").run("cafe", 100000);
    old.prepare("INSERT INTO reservations VALUES(?,?,?)").run(id, "cafe", 2);
    old
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(digest("token-test"), id, 100000);
    old
      .prepare("INSERT INTO rooms VALUES(?,?,?,?,?,?)")
      .run(
        room,
        "cafe",
        JSON.stringify(createSession([], "Legado", 3, 6, 40, 3, 10)),
        1,
        0,
        null,
      );
    old.prepare("INSERT INTO memberships VALUES(?,?)").run(room, id);
    old
      .prepare("INSERT INTO messages VALUES(?,?,?,?,?)")
      .run(
        room,
        "test-message",
        id,
        "test-client",
        JSON.stringify({
          id: "test-message",
          senderId: id,
          name: "Legado",
          clientId: "test-client",
          type: "text",
          text: "Mensaje anterior a la migración",
        }),
      );
    old.close();
    const after = new Storage(path);
    try {
      assert.equal(after.account("legado").id, id);
      assert.equal(after.canParticipate(id), false);
      assert.equal(after.reserved(id, "cafe"), true);
      assert.equal(after.session(digest("token-test"), 10).id, id);
      assert.equal(after.member(id, room), true);
      assert.equal(
        after.messages(room)[0].text,
        "Mensaje anterior a la migración",
      );
      assert.deepEqual(after.loadRooms()[0].safety.expelled, []);
      assert.equal(
        after.db.prepare("PRAGMA user_version").get().user_version,
        12,
      );
      assert.equal(new ModerationStore(after, Date.now).restriction(id), null);
      assert.equal(new ModerationStore(after, Date.now).hasModerators(), false);
    } finally {
      after.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
