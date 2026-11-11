import type { IncomingMessage, ServerResponse } from "node:http";
import type { Storage } from "./storage.ts";
import type { ModerationStore } from "./moderation.ts";
import { privacyInventory } from "./privacy-inventory.ts";
import { eraseEmptyAccount } from "./privacy-erasure.ts";

export async function handlePrivacy(storage: Storage, moderation: ModerationStore, now: () => number, validOrigin: (req: IncomingMessage) => boolean, req: IncomingMessage, res: ServerResponse, path: string, actor: { id: string } | null, erasure: { enabled: boolean; sessionHash: string | null; isLive: (id: string) => boolean; onErased: (id: string) => void }) {
  const json = (status: number, value: unknown) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(JSON.stringify(value)); };
  if (!actor) { req.resume(); json(401, { error: "session_required" }); return; }
  const db = storage.db;
  const own = () => db.prepare("SELECT status,created_at AS createdAt,updated_at AS updatedAt,version FROM privacy_requests WHERE user_id=?").get(actor.id) || null;
  const operator = () => !!db.prepare("SELECT 1 FROM privacy_operators WHERE user_id=?").get(actor.id) && storage.canParticipate(actor.id) && !moderation.restriction(actor.id);
  if (req.method === "GET" && path === "/api/privacy/request") { json(200, { request: own() }); return; }
  if (path !== "/api/privacy/request" && !operator()) { req.resume(); json(403, { error: "privacy_operator_required" }); return; }
  const inventory = path.match(/^\/api\/privacy\/inventory\/([a-f0-9-]{36})$/);
  if (req.method === "GET" && inventory) {
    if (inventory[1] === actor.id || !db.prepare("SELECT 1 FROM privacy_requests WHERE user_id=? AND status IN ('pending','seen')").get(inventory[1])) { json(404, { error: "not_found" }); return; }
    json(200, privacyInventory(storage, inventory[1])); return;
  }
  if (req.method === "GET" && path === "/api/privacy/queue") {
    const values = new URL(req.url!, "http://localhost").searchParams.getAll("page");
    if (values.length > 1 || (values.length && !/^[1-9]\d{0,5}$/.test(values[0]))) { json(422, { error: "invalid_page" }); return; }
    const page = values.length ? Number(values[0]) : 1;
    const requests = db.prepare("SELECT r.user_id AS userId,a.alias,r.status,r.created_at AS createdAt,r.updated_at AS updatedAt,r.version FROM privacy_requests r JOIN accounts a ON a.id=r.user_id WHERE r.status IN ('pending','seen') ORDER BY (r.status='pending') DESC,r.created_at,r.user_id LIMIT 51 OFFSET ?").all((page - 1) * 50);
    json(200, { requests: requests.slice(0, 50), page, hasMore: requests.length > 50 }); return;
  }
  if (req.method !== "POST" || !validOrigin(req)) { req.resume(); json(403, { error: "origin_rejected" }); return; }
  let value: Record<string, unknown>;
  try { if (!req.headers["content-type"]?.startsWith("application/json")) throw Error(); let size = 0; const chunks: Buffer[] = []; for await (const chunk of req) { size += chunk.length; if (size > 1024) throw Error(); chunks.push(chunk); } const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error(); value = parsed as Record<string, unknown>; }
  catch { req.resume(); json(422, { error: "invalid_fields" }); return; }
  if (path === "/api/privacy/erase-empty") {
    if (!erasure.enabled) { json(404, { error: "not_found" }); return; }
    if (Object.keys(value).length !== 3 || typeof value.userId !== "string" || !/^[a-f0-9-]{36}$/.test(value.userId) || !Number.isSafeInteger(value.version) || Number(value.version) < 1 || value.confirmation !== "BORRAR CUENTA") { json(422, { error: "invalid_fields" }); return; }
    if (value.userId === actor.id) { json(403, { error: "independent_operator_required" }); return; }
    const result = eraseEmptyAccount(storage, value.userId, actor.id, Number(value.version), erasure.sessionHash, now(), erasure.isLive);
    if ("error" in result) { json(result.error === "recent_auth_required" ? 403 : 409, { error: result.error }); return; }
    erasure.onErased(value.userId); json(200, { receiptId: result.receiptId }); return;
  }
  if (path === "/api/privacy/request" && Object.keys(value).length === 1 && (value.action === "submit" || value.action === "cancel")) {
    const result = storage.transaction(() => {
      const current = own(), time = now(); let changed = false;
      if (value.action === "submit") {
        if (!current) { db.prepare("INSERT INTO privacy_requests(user_id,status,created_at,updated_at,version) VALUES(?,'pending',?,?,1)").run(actor.id, time, time); changed = true; }
        else if (current.status === "cancelled") { db.prepare("UPDATE privacy_requests SET status='pending',created_at=?,updated_at=?,version=version+1,seen_by=NULL WHERE user_id=?").run(time, time, actor.id); changed = true; }
      } else {
        if (!current) return null;
        if (current.status !== "cancelled") { db.prepare("UPDATE privacy_requests SET status='cancelled',updated_at=?,version=version+1 WHERE user_id=?").run(time, actor.id); changed = true; }
      }
      const updated = own();
      if (changed && updated) db.prepare("INSERT INTO privacy_request_events(user_id,version,action,actor_id,created_at) VALUES(?,?,?,?,?)").run(actor.id, Number(updated.version), String(value.action), actor.id, time);
      return updated;
    });
    if (!result) { json(404, { error: "not_found" }); return; }
    json(200, { request: result }); return;
  }
  if (path === "/api/privacy/ack" && Object.keys(value).length === 2 && typeof value.userId === "string" && Number.isSafeInteger(value.version) && value.userId !== actor.id) {
    const changed = storage.transaction(() => {
      const time = now(); const result = db.prepare("UPDATE privacy_requests SET status='seen',updated_at=?,version=version+1,seen_by=? WHERE user_id=? AND status='pending' AND version=?").run(time, actor.id, String(value.userId), Number(value.version));
      if (result.changes) db.prepare("INSERT INTO privacy_request_events(user_id,version,action,actor_id,created_at) VALUES(?,?,?,?,?)").run(String(value.userId), Number(value.version) + 1, "acknowledge", actor.id, time);
      return !!result.changes;
    });
    json(changed ? 200 : 409, changed ? { ok: true } : { error: "request_changed" }); return;
  }
  json(422, { error: "invalid_fields" });
}
