import type { IncomingMessage, ServerResponse } from "node:http";
import type { Storage } from "./storage.ts";
import type { ModerationStore } from "./moderation.ts";

export async function handlePrivacy(storage: Storage, moderation: ModerationStore, now: () => number, validOrigin: (req: IncomingMessage) => boolean, req: IncomingMessage, res: ServerResponse, path: string, actor: { id: string } | null) {
  const json = (status: number, value: unknown) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(JSON.stringify(value)); };
  if (!actor) { req.resume(); json(401, { error: "session_required" }); return; }
  const db = storage.db;
  const own = () => db.prepare("SELECT status,created_at AS createdAt,updated_at AS updatedAt,version FROM privacy_requests WHERE user_id=?").get(actor.id) || null;
  const operator = () => !!db.prepare("SELECT 1 FROM privacy_operators WHERE user_id=?").get(actor.id) && storage.canParticipate(actor.id) && !moderation.restriction(actor.id);
  if (req.method === "GET" && path === "/api/privacy/request") { json(200, { request: own() }); return; }
  if (path !== "/api/privacy/request" && !operator()) { req.resume(); json(403, { error: "privacy_operator_required" }); return; }
  if (req.method === "GET" && path === "/api/privacy/queue") {
    const requests = db.prepare("SELECT r.user_id AS userId,a.alias,r.status,r.created_at AS createdAt,r.updated_at AS updatedAt,r.version FROM privacy_requests r JOIN accounts a ON a.id=r.user_id WHERE r.status IN ('pending','seen') ORDER BY (r.status='pending') DESC,r.created_at,r.user_id LIMIT 100").all();
    json(200, { requests }); return;
  }
  if (req.method !== "POST" || !validOrigin(req)) { req.resume(); json(403, { error: "origin_rejected" }); return; }
  let value: Record<string, unknown>;
  try { if (!req.headers["content-type"]?.startsWith("application/json")) throw Error(); let size = 0; const chunks: Buffer[] = []; for await (const chunk of req) { size += chunk.length; if (size > 1024) throw Error(); chunks.push(chunk); } const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error(); value = parsed as Record<string, unknown>; }
  catch { req.resume(); json(422, { error: "invalid_fields" }); return; }
  if (path === "/api/privacy/request" && Object.keys(value).length === 1 && (value.action === "submit" || value.action === "cancel")) {
    const current = own();
    if (value.action === "submit") {
      if (!current) db.prepare("INSERT INTO privacy_requests(user_id,status,created_at,updated_at,version) VALUES(?,'pending',?,?,1)").run(actor.id, now(), now());
      else if (current.status === "cancelled") db.prepare("UPDATE privacy_requests SET status='pending',created_at=?,updated_at=?,version=version+1,seen_by=NULL WHERE user_id=?").run(now(), now(), actor.id);
    } else {
      if (!current) { json(404, { error: "not_found" }); return; }
      if (current.status !== "cancelled") db.prepare("UPDATE privacy_requests SET status='cancelled',updated_at=?,version=version+1 WHERE user_id=?").run(now(), actor.id);
    }
    json(200, { request: own() }); return;
  }
  if (path === "/api/privacy/ack" && Object.keys(value).length === 2 && typeof value.userId === "string" && Number.isSafeInteger(value.version) && value.userId !== actor.id) {
    const changed = db.prepare("UPDATE privacy_requests SET status='seen',updated_at=?,version=version+1,seen_by=? WHERE user_id=? AND status='pending' AND version=?").run(now(), actor.id, value.userId, Number(value.version));
    json(changed.changes ? 200 : 409, changed.changes ? { ok: true } : { error: "request_changed" }); return;
  }
  json(422, { error: "invalid_fields" });
}
