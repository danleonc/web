import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Storage } from './storage.ts';

export function readProfile(storage: Storage, userId: string) {
  const row = storage.db.prepare('SELECT interests_json,boundaries_json,availability FROM account_profiles WHERE user_id=?').get(userId);
  return row ? { interests: JSON.parse(String(row.interests_json)), boundaries: JSON.parse(String(row.boundaries_json)), availability: String(row.availability) } : null;
}

export async function handleAccountProfile(storage: Storage, req: IncomingMessage, res: ServerResponse, userId: string | null, originValid: boolean) {
  const send = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
  if (!userId) { req.resume(); send(401, { error: 'session_required' }); return; }
  if (req.method === 'GET') { send(200, { profile: readProfile(storage, userId) }); return; }
  if (req.method !== 'PUT') { req.resume(); send(405, { error: 'method_not_allowed' }); return; }
  if (!originValid) { req.resume(); send(403, { error: 'origin_rejected' }); return; }
  try {
    if (!req.headers['content-type']?.startsWith('application/json')) throw Error();
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 8192) throw Error(); chunks.push(chunk); }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const validList = (v: unknown) => Array.isArray(v) && v.length <= 30 && v.every(x => typeof x === 'string' && x.length > 0 && x.length <= 100);
    if (!data || typeof data !== 'object' || Object.keys(data).sort().join(',') !== 'availability,boundaries,interests' || !validList(data.interests) || !validList(data.boundaries) || !['Sin preferencia', 'Durante la semana', 'Fines de semana'].includes(data.availability)) throw Error();
    storage.db.prepare('INSERT INTO account_profiles(user_id,interests_json,boundaries_json,availability) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET interests_json=excluded.interests_json,boundaries_json=excluded.boundaries_json,availability=excluded.availability').run(userId, JSON.stringify(data.interests), JSON.stringify(data.boundaries), data.availability);
    send(200, { profile: readProfile(storage, userId) });
  } catch { send(422, { error: 'invalid_profile' }); }
}
