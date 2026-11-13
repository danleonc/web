import { randomUUID } from 'node:crypto';
import type { Storage } from './storage.ts';

export class Notifications {
  private storage: Storage;
  private now: () => number;
  constructor(storage: Storage, now: () => number) { this.storage = storage; this.now = now; }
  reply(post: string, reply: string, actor: string) {
    const db = this.storage.db;
    const recipients = db.prepare(`SELECT author_id AS id FROM plaza_posts WHERE id=? AND hidden=0
      UNION SELECT author_id AS id FROM plaza_replies WHERE post_id=? AND hidden=0`).all(post, post);
    const insert = db.prepare(`INSERT OR IGNORE INTO notifications(id,recipient_id,actor_id,kind,target_id,event_id,created_at)
      SELECT ?,?,?, 'reply',?,?,? WHERE ?<>? AND NOT EXISTS
      (SELECT 1 FROM notification_mutes WHERE user_id=? AND kind='post' AND target_id=?) AND NOT EXISTS
      (SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?))`);
    for (const recipient of recipients) {
      const id = String(recipient.id);
      insert.run(randomUUID(), id, actor, post, reply, this.now(), id, actor, id, post, id, actor, actor, id);
    }
  }
  private peer(actor: string, id: string) {
    const row = this.storage.db.prepare(`SELECT sender_id,recipient_id FROM plaza_connections c WHERE c.id=? AND c.status='accepted' AND (c.sender_id=? OR c.recipient_id=?) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=c.sender_id AND b.blocked_id=c.recipient_id) OR (b.user_id=c.recipient_id AND b.blocked_id=c.sender_id))`).get(id,actor,actor);
    return row ? String(row.sender_id === actor ? row.recipient_id : row.sender_id) : null;
  }
  privateMessage(connection: string, message: string, actor: string) {
    const peer = this.peer(actor, connection);
    if (!peer) return;
    this.storage.db.prepare(`INSERT OR IGNORE INTO notifications(id,recipient_id,actor_id,kind,target_id,event_id,created_at)
      SELECT ?,?,?,'message',?,?,? WHERE NOT EXISTS
      (SELECT 1 FROM notification_mutes WHERE user_id=? AND kind='connection' AND target_id=?)`)
      .run(randomUUID(), peer, actor, connection, message, this.now(), peer, connection);
  }
  list(actor: string) {
    const db = this.storage.db;
    const visible = `n.recipient_id=? AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=n.recipient_id AND b.blocked_id=n.actor_id) OR (b.blocked_id=n.recipient_id AND b.user_id=n.actor_id)) AND ((n.kind='reply' AND EXISTS (SELECT 1 FROM plaza_posts p JOIN plaza_replies r ON r.id=n.event_id AND r.post_id=p.id WHERE p.id=n.target_id AND p.hidden=0 AND r.hidden=0 AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=n.recipient_id AND b.blocked_id=p.author_id) OR (b.blocked_id=n.recipient_id AND b.user_id=p.author_id)))) OR (n.kind='message' AND EXISTS (SELECT 1 FROM plaza_connections c JOIN plaza_private_messages m ON m.id=n.event_id AND m.connection_id=c.id WHERE c.id=n.target_id AND c.status='accepted' AND (c.sender_id=n.recipient_id OR c.recipient_id=n.recipient_id) AND m.hidden=0)))`;
    const items = db.prepare(`SELECT n.id,n.kind,n.target_id AS targetId,n.created_at AS createdAt,n.read_at AS readAt,a.alias AS actor,COALESCE(p.title,'Conversación privada') AS title FROM notifications n JOIN accounts a ON a.id=n.actor_id LEFT JOIN plaza_posts p ON n.kind='reply' AND p.id=n.target_id WHERE ${visible} ORDER BY n.created_at DESC,n.rowid DESC LIMIT 100`).all(actor);
    const unread = Number(db.prepare(`SELECT count(*) AS n FROM notifications n WHERE ${visible} AND n.read_at IS NULL`).get(actor)!.n);
    const mutes = db.prepare('SELECT kind,target_id AS targetId FROM notification_mutes WHERE user_id=?').all(actor);
    return { items, unread, mutes };
  }
  read(actor: string, id: string) {
    return this.storage.db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND recipient_id=?').run(this.now(), id, actor).changes === 1;
  }
  mute(actor: string, kind: string, target: string, muted: boolean) {
    const db = this.storage.db;
    if (kind === 'post') {
      if (!db.prepare(`SELECT 1 FROM plaza_posts p WHERE p.id=? AND p.hidden=0 AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=p.author_id) OR (b.blocked_id=? AND b.user_id=p.author_id))`).get(target, actor, actor)) return false;
    } else if (kind === 'connection') {
      if (!this.peer(actor, target)) return false;
    } else return false;
    if (muted) {
      db.prepare('INSERT OR IGNORE INTO notification_mutes(user_id,kind,target_id) VALUES(?,?,?)').run(actor,kind,target);
      if (kind === 'connection') db.prepare('DELETE FROM push_private_queue WHERE user_id=? AND connection_id=?').run(actor,target);
    }
    else db.prepare('DELETE FROM notification_mutes WHERE user_id=? AND kind=? AND target_id=?').run(actor,kind,target);
    return true;
  }
}
