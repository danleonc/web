import { randomUUID } from "node:crypto";
import type { Storage } from "./storage.ts";
import { digest } from "./storage.ts";
import { PlazaStore } from "./plaza.ts";

export class ConnectionsStore {
  readonly storage: Storage;
  readonly now: () => number;
  constructor(storage: Storage, now: () => number) { this.storage = storage; this.now = now; }
  private blocked(a: string, b: string) {
    return !!this.storage.db.prepare("SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?)").get(a, b, b, a);
  }
  private visible(id: string, actor: string) {
    const row = this.storage.db.prepare("SELECT * FROM plaza_connections WHERE id=? AND (sender_id=? OR recipient_id=?)").get(id, actor, actor);
    if (!row || this.blocked(String(row.sender_id), String(row.recipient_id))) return null;
    return row;
  }
  invite(actor: string, kind: string, contentId: string, note: string) {
    if (typeof note !== "string" || note.length > 500) throw Error("invalid_note");
    const recipient = new PlazaStore(this.storage).blockTarget(actor, kind, contentId);
    const [low, high] = [actor, recipient].sort();
    const db = this.storage.db;
    const existing = db.prepare("SELECT id,sender_id,status FROM plaza_connections WHERE low_id=? AND high_id=? AND status IN ('pending','accepted')").get(low, high);
    if (existing) {
      if (existing.status === "pending" && existing.sender_id !== actor) throw Error("incoming_request_exists");
      return { id: String(existing.id), status: String(existing.status) };
    }
    if (!this.storage.takeLimit(digest(`plaza-invitations:${actor}`), 10, 60 * 60_000, this.now())) throw Error("rate_limited");
    const id = randomUUID(), time = this.now();
    db.prepare("INSERT INTO plaza_connections VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(id, actor, recipient, low, high, note.trim(), kind, contentId, "pending", time, time);
    return { id, status: "pending" };
  }
  list(actor: string) {
    return this.storage.db.prepare(`SELECT c.id,c.sender_id AS senderId,c.recipient_id AS recipientId,c.note,c.origin_kind AS originKind,c.origin_id AS originId,c.status,c.created_at AS createdAt,a.id AS personId,a.alias AS person
      FROM plaza_connections c JOIN accounts a ON a.id=CASE WHEN c.sender_id=? THEN c.recipient_id ELSE c.sender_id END
      WHERE (c.sender_id=? OR c.recipient_id=?) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=c.sender_id AND b.blocked_id=c.recipient_id) OR (b.user_id=c.recipient_id AND b.blocked_id=c.sender_id))
      ORDER BY c.updated_at DESC,c.id DESC LIMIT 100`).all(actor, actor, actor);
  }
  decide(actor: string, id: string, action: string) {
    const row = this.visible(id, actor);
    if (!row) return false;
    const next = action === "accept" && row.status === "pending" && row.recipient_id === actor ? "accepted"
      : action === "decline" && row.status === "pending" && row.recipient_id === actor ? "declined"
      : action === "withdraw" && ((row.status === "pending" && row.sender_id === actor) || row.status === "accepted") ? "closed" : null;
    if (!next) return false;
    return this.storage.db.prepare("UPDATE plaza_connections SET status=?,updated_at=? WHERE id=? AND status=?").run(next, this.now(), id, row.status).changes === 1;
  }
  peer(actor: string, id: string) {
    const row = this.visible(id, actor);
    if (!row || row.status !== "accepted") return null;
    return String(row.sender_id === actor ? row.recipient_id : row.sender_id);
  }
  messages(actor: string, id: string) {
    const connection = this.visible(id, actor);
    if (!connection || connection.status !== "accepted") return null;
    return this.storage.db.prepare("SELECT id,sender_id AS senderId,body,created_at AS createdAt FROM plaza_private_messages WHERE connection_id=? AND hidden=0 ORDER BY rowid DESC LIMIT 100").all(id).reverse();
  }
  send(actor: string, id: string, clientId: string, value: string) {
    const connection = this.visible(id, actor);
    if (!connection || connection.status !== "accepted") return null;
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(clientId) || typeof value !== "string" || !value.trim() || value.length > 2000) throw Error("invalid_message");
    const body = value.trim(); const db = this.storage.db;
    const old = db.prepare("SELECT id,body FROM plaza_private_messages WHERE connection_id=? AND sender_id=? AND client_id=?").get(id, actor, clientId);
    if (old) { if (old.body !== body) throw Error("client_id_conflict"); return { id: String(old.id) }; }
    if (!this.storage.takeLimit(digest(`plaza-private:${actor}`), 120, 60 * 60_000, this.now())) throw Error("rate_limited");
    const messageId = randomUUID(), time = this.now();
    const recipient = String(connection.sender_id === actor ? connection.recipient_id : connection.sender_id);
    this.storage.transaction(() => {
      db.prepare("INSERT INTO plaza_private_messages(id,connection_id,sender_id,client_id,body,created_at) VALUES(?,?,?,?,?,?)").run(messageId, id, actor, clientId, body, time);
      db.prepare("INSERT INTO push_private_queue(connection_id,endpoint_hash,user_id,message_id,created_at,next_at) SELECT ?,endpoint_hash,user_id,?,?,? FROM push_subscriptions WHERE user_id=? ON CONFLICT(connection_id,endpoint_hash) DO UPDATE SET message_id=excluded.message_id,created_at=excluded.created_at,next_at=excluded.next_at,attempts=0").run(id, messageId, time, time, recipient);
    });
    return { id: messageId };
  }
}
