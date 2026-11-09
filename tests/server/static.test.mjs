import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRoomServer } from "../../server/app.ts";

test("serves the public build without exposing files outside its root", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "nexafia-static-"));
  const root = join(temporary, "public");
  await mkdir(join(root, "assets"), { recursive: true });
  await writeFile(join(root, "index.html"), "<h1>Nexafia</h1>");
  await writeFile(join(root, "assets", "app.js"), "export const ok = true;");
  await writeFile(join(root, "assets", "image.webp"), "sample");
  await writeFile(join(temporary, "secret.txt"), "private");
  const app = createRoomServer({ staticRoot: root });
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  t.after(async () => {
    await app.close();
    await rm(temporary, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.equal(await index.text(), "<h1>Nexafia</h1>");
  const asset = await fetch(`${base}/assets/app.js`);
  assert.equal(asset.status, 200);
  assert.equal(await asset.text(), "export const ok = true;");
  const image = await fetch(`${base}/assets/image.webp`);
  assert.equal(image.headers.get("content-type"), "image/webp");
  const secret = await fetch(`${base}/..%2fsecret.txt`);
  assert.equal(secret.status, 404);
  assert.doesNotMatch(await secret.text(), /private/);
});
