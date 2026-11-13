import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Storage } from './storage.ts';
import { normalizeUpload } from './images.ts';
import { digest } from './storage.ts';
import { randomUUID } from 'node:crypto';

export async function handleAccountPhoto(storage: Storage, req: IncomingMessage, res: ServerResponse, userId: string | null, originValid: boolean, now: number) {
  const send = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
  if (!userId) { req.resume(); send(401, { error: 'session_required' }); return; }
  if (req.method === 'GET') {
    const row = storage.db.prepare('SELECT body FROM account_profile_photos WHERE user_id=?').get(userId);
    if (!row) { send(404, { error: 'not_found' }); return; }
    res.writeHead(200, { 'Content-Type':'image/webp', 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' }); res.end(row.body as Uint8Array); return;
  }
  if (!originValid) { req.resume(); send(403, { error: 'origin_rejected' }); return; }
  if (req.method === 'DELETE') { req.resume(); storage.db.prepare('DELETE FROM account_profile_photos WHERE user_id=?').run(userId); send(200, {ok:true}); return; }
  if (req.method !== 'POST') { req.resume(); send(405, {error:'method_not_allowed'}); return; }
  if (req.headers['x-photo-declaration'] !== 'yes') { req.resume(); send(422, {error:'declaration_required'}); return; }
  if (!storage.takeLimit(digest(`profile-photos:${userId}`), 20, 60 * 60_000, now)) { req.resume(); send(429, {error:'rate_limited'}); return; }
  try {
    const image = await normalizeUpload(req);
    const previouslyHidden = storage.db.prepare("SELECT 1 FROM plaza_reports r JOIN plaza_moderation_actions a ON a.report_id=r.id AND a.action='hide' LEFT JOIN plaza_appeals p ON p.report_id=r.id WHERE r.target_id=? AND r.kind='profile_photo' AND r.evidence_image=? AND (p.status IS NULL OR p.status<>'restored') LIMIT 1").get(userId,image);
    if (previouslyHidden) { send(422,{error:'photo_previously_hidden'}); return; }
    storage.transaction(() => {
      storage.db.prepare('DELETE FROM profile_photo_shares WHERE owner_id=?').run(userId);
      storage.db.prepare('INSERT INTO account_profile_photos(user_id,id,body,declared_at,hidden) VALUES(?,?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET id=excluded.id,body=excluded.body,declared_at=excluded.declared_at,hidden=0').run(userId,randomUUID(),image,now);
    });
    send(201,{ok:true});
  } catch { req.resume(); send(422,{error:'invalid_image'}); }
}
