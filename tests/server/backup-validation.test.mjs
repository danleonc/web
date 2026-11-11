import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { backupDatabase } from '../../scripts/backup-db.mjs';

test('rechaza una copia con referencias inválidas y no deja el archivo fallido', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'nexafia-backup-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, 'source.sqlite'), target = join(dir, 'backup.sqlite');
  const db = new DatabaseSync(source);
  db.exec('PRAGMA foreign_keys=OFF; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(parent_id INTEGER REFERENCES parent(id)); INSERT INTO child VALUES(99)');
  db.close();
  await assert.rejects(backupDatabase(source, target), /backup validation/i);
  await assert.rejects(stat(target), { code: 'ENOENT' });
  const original = new DatabaseSync(source, { readOnly: true });
  try { assert.equal(original.prepare('SELECT count(*) AS n FROM child').get().n, 1); } finally { original.close(); }
});

test('no sobrescribe una copia existente ni conserva un archivo si la fuente no es SQLite', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'nexafia-backup-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, 'bad.sqlite'), existing = join(dir, 'existing.sqlite'), target = join(dir, 'new.sqlite');
  await writeFile(source, 'not a database');
  await writeFile(existing, 'existing backup');
  await assert.rejects(backupDatabase(source, existing), { code: 'EEXIST' });
  assert.equal(await readFile(existing, 'utf8'), 'existing backup');
  await assert.rejects(backupDatabase(source, target));
  await assert.rejects(stat(target), { code: 'ENOENT' });
});
