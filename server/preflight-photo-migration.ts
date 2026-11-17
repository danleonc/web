import { DatabaseSync } from 'node:sqlite';
import { access, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
// The backup helper is an existing JavaScript module.
// @ts-expect-error No declaration is shipped for this local module.
import { backupDatabase } from '../scripts/backup-db.mjs';
import { Storage } from './storage.ts';

/** Make a consistent private backup and rehearse the v24 migration before changing live data. */
export async function preflightPhotoMigration(path: string): Promise<{backup:string} | null> {
  if (path === ':memory:') return null;
  try { await access(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  const source = new DatabaseSync(path, {readOnly:true});
  let version: number;
  try { version = Number(source.prepare('PRAGMA user_version').get()!.user_version); } finally { source.close(); }
  if (version > 0 && version < 23) throw Error("Automatic migration requires an explicitly rehearsed v23 database");
  if (version !== 23) return null;
  const suffix = `${Date.now()}-${randomUUID()}`;
  const backup = `${path}.pre-v24-${suffix}.sqlite`, rehearsal = `${path}.rehearsal-${suffix}.sqlite`;
  await backupDatabase(path,backup);
  try {
    await backupDatabase(backup,rehearsal);
    const test = new Storage(rehearsal);
    try {
      const ok=test.db.prepare('PRAGMA integrity_check').get();
      if (ok?.integrity_check !== 'ok' || test.db.prepare('PRAGMA foreign_key_check').all().length || test.db.prepare('PRAGMA user_version').get()?.user_version !== 24) throw Error('Migration rehearsal failed');
      const original=new DatabaseSync(backup,{readOnly:true});
      try { for (const table of ['accounts','plaza_connections','profile_photo_shares','account_profile_photos']) { const sql=`SELECT count(*) AS n FROM ${table}`; if (original.prepare(sql).get()?.n !== test.db.prepare(sql).get()?.n) throw Error('Migration changed existing records'); } }
      finally { original.close(); }
    } finally { test.close(); }
  } finally { for (const file of [rehearsal,`${rehearsal}-wal`,`${rehearsal}-shm`]) await unlink(file).catch(e=>{if(e.code!=='ENOENT') throw e;}); }
  return {backup};
}
