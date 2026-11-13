import { randomUUID } from "node:crypto";
import type { Storage } from "./storage.ts";
import { digest } from "./storage.ts";

export class PlazaImages {
  private storage: Storage; private now: () => number;
  constructor(storage: Storage, now: () => number) { this.storage = storage; this.now = now; }
  put(actor: string, kind: string, contentId: string, body: Buffer, description: string) {
    if (description.length > 180 || !["post", "reply", "private"].includes(kind)) throw Error("invalid_image");
    const db = this.storage.db;
    return this.storage.transaction(() => {
      const found = kind === "post" ? db.prepare("SELECT author_id AS owner FROM plaza_posts WHERE id=? AND hidden=0").get(contentId)
        : kind === "reply" ? db.prepare("SELECT r.author_id AS owner FROM plaza_replies r JOIN plaza_posts p ON p.id=r.post_id WHERE r.id=? AND r.hidden=0 AND p.hidden=0").get(contentId)
        : db.prepare("SELECT m.sender_id AS owner FROM plaza_private_messages m JOIN plaza_connections c ON c.id=m.connection_id WHERE m.id=? AND m.hidden=0 AND c.status='accepted' AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=c.sender_id AND b.blocked_id=c.recipient_id) OR (b.user_id=c.recipient_id AND b.blocked_id=c.sender_id))").get(contentId);
      if (!found || found.owner !== actor || db.prepare("SELECT 1 FROM plaza_reports WHERE kind=? AND content_id=? LIMIT 1").get(kind,contentId)) throw Error("unavailable");
      const counts = db.prepare("SELECT count(*) AS n,coalesce(sum(length(body)),0) AS bytes FROM plaza_images WHERE owner_id=?").get(actor)!;
      const total = db.prepare("SELECT count(*) AS n,coalesce(sum(length(body)),0) AS bytes FROM plaza_images").get()!;
      if (Number(counts.n) >= 50 || Number(counts.bytes) + body.length > 20 * 1024 * 1024 || Number(total.n) >= 5000 || Number(total.bytes) + body.length > 200 * 1024 * 1024) throw Error("quota");
      if (!this.storage.takeLimit(digest(`plaza-images:${actor}`), 30, 60 * 60_000, this.now())) throw Error("rate_limit");
      const id = randomUUID();
      db.prepare("INSERT INTO plaza_images(id,owner_id,post_id,reply_id,message_id,body,description,created_at) VALUES(?,?,?,?,?,?,?,?)").run(id,actor,kind === "post" ? contentId : null,kind === "reply" ? contentId : null,kind === "private" ? contentId : null,body,description.trim(),this.now());
      return id;
    });
  }
  get(actor: string, id: string) {
    return this.storage.db.prepare(`SELECT i.body,i.description FROM plaza_images i
      LEFT JOIN plaza_posts p ON p.id=i.post_id
      LEFT JOIN plaza_replies r ON r.id=i.reply_id
      LEFT JOIN plaza_posts rp ON rp.id=r.post_id
      LEFT JOIN plaza_private_messages m ON m.id=i.message_id
      LEFT JOIN plaza_connections c ON c.id=m.connection_id
      WHERE i.id=? AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=i.owner_id) OR (b.blocked_id=? AND b.user_id=i.owner_id))
      AND ((p.id IS NOT NULL AND p.hidden=0) OR (r.id IS NOT NULL AND r.hidden=0 AND rp.hidden=0 AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=rp.author_id) OR (b.blocked_id=? AND b.user_id=rp.author_id))) OR (m.id IS NOT NULL AND m.hidden=0 AND c.status='accepted' AND (c.sender_id=? OR c.recipient_id=?) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=c.sender_id AND b.blocked_id=c.recipient_id) OR (b.user_id=c.recipient_id AND b.blocked_id=c.sender_id))))`).get(id,actor,actor,actor,actor,actor,actor);
  }
}
