import { DatabaseSync, backup } from "node:sqlite";
import { mkdir, open, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
export async function backupDatabase(source, destination) {
  if (resolve(source) === resolve(destination))
    throw new Error("Backup destination must differ from source");
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  const file = await open(destination, "wx", 0o600);
  await file.close();
  let db;
  try {
    db = new DatabaseSync(source, { readOnly: true });
    await backup(db, destination);
    const copy = new DatabaseSync(destination, { readOnly: true });
    try {
      const integrity = copy.prepare('PRAGMA integrity_check').all();
      const violations = copy.prepare('PRAGMA foreign_key_check').iterate().next();
      if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok' || !violations.done)
        throw new Error('Backup validation failed: integrity or foreign keys');
    } finally {
      copy.close();
    }
  } catch (e) {
    await rm(destination, { force: true });
    throw e;
  } finally {
    db?.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [, , source, destination] = process.argv;
  if (!source || !destination)
    throw new Error(
      "Usage: node scripts/backup-db.mjs SOURCE.sqlite NEW-BACKUP.sqlite",
    );
  await backupDatabase(source, destination);
  console.log("Consistent database backup created and checked. Keep it private.");
}
