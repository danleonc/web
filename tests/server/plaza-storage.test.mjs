import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Storage } from "../../server/storage.ts";
import { PlazaStore } from "../../server/plaza.ts";

test('Plaza acepta temas de interés y conserva las categorías anteriores', () => {
  const storage = new Storage(':memory:');
  try {
    storage.createAccount({id:'a',username:'a',alias:'A',passwordHash:'x',recoveryHash:'x'},1);
    const plaza = new PlazaStore(storage);
    for (const topic of ['cultura','crear','cotidiano','cocina','musica','anime','deporte','cine','lectura','juegos','naturaleza','viajes','mascotas','tecnologia','bienestar']) {
      const post=plaza.createPost('a',{topic,title:'Un tema',body:'Compartamos ideas'},1);
      assert.ok(plaza.listPosts('a').some(p=>p.id===post.id && p.topic===topic));
    }
  } finally {storage.close();}
});

test("Plaza persists posts and replies, enforces ownership and respects blocks", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "nexafia-plaza-"));
  const path = join(directory, "data.sqlite");
  let storage = new Storage(path);
  t.after(async () => { storage.close(); await rm(directory, { recursive: true, force: true }); });
  for (const id of ["ana", "bea", "cata"]) storage.createAccount({ id, username: id, alias: id, passwordHash: "x", recoveryHash: "x" }, 1);
  let plaza = new PlazaStore(storage);
  const post = plaza.createPost("ana", { topic: "cultura", title: "Hola", body: "Una conversación" }, 10);
  const reply = plaza.createReply("bea", post.id, "Hola Ana", 11);
  assert.equal(plaza.listPosts("bea")[0].title, "Hola");
  assert.equal(plaza.listReplies("ana", post.id)[0].body, "Hola Ana");
  assert.equal(plaza.editPost("bea", post.id, { topic: "crear", title: "Cambio", body: "Ajeno" }), false);
  assert.equal(plaza.deleteReply("ana", reply.id), false);
  storage.close();
  storage = new Storage(path);
  plaza = new PlazaStore(storage);
  assert.equal(plaza.listPosts("bea")[0].body, "Una conversación");
  assert.equal(plaza.listReplies("ana", post.id)[0].body, "Hola Ana");
  storage.block("ana", "bea");
  assert.equal(plaza.listPosts("bea").length, 0);
  assert.equal(plaza.listReplies("ana", post.id).length, 0);
  assert.throws(() => plaza.createReply("bea", post.id, "No debería pasar", 12));
  assert.equal(plaza.deletePost("ana", post.id), true);
  assert.equal(plaza.listPosts("cata").length, 0);
});

test("Plaza rejects invalid or oversized content", () => {
  const storage = new Storage(":memory:");
  try {
    storage.createAccount({ id: "ana", username: "ana", alias: "ana", passwordHash: "x", recoveryHash: "x" }, 1);
    const plaza = new PlazaStore(storage);
    assert.throws(() => plaza.createPost("ana", { topic: "inexistente", title: "Hola", body: "Texto" }, 1));
    assert.throws(() => plaza.createPost("ana", { topic: "cultura", title: " ", body: "Texto" }, 1));
    assert.throws(() => plaza.createPost("ana", { topic: "cultura", title: "Hola", body: "x".repeat(5001) }, 1));
  } finally { storage.close(); }
});
