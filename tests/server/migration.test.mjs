import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Storage, digest } from "../../server/storage.ts";
import { ModerationStore } from "../../server/moderation.ts";
import { createSession } from "../../src/room/engine.ts";
test("migración v1 a v4 conserva cuenta, reserva, sesión e historial con seguridad inicial vacía", async () => {
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
        4,
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
