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
  connectionEvent(connection: string, actor: string, kind: "invitation" | "acceptance") {
    const db = this.storage.db;
    const row = db.prepare(`SELECT sender_id,recipient_id,status FROM plaza_connections WHERE id=?`).get(connection);
    if (!row || (kind === "invitation" && (row.status !== "pending" || row.sender_id !== actor)) || (kind === "acceptance" && (row.status !== "accepted" || row.recipient_id !== actor))) return;
    const recipient = String(kind === "invitation" ? row.recipient_id : row.sender_id);
    db.prepare(`INSERT OR IGNORE INTO notifications(id,recipient_id,actor_id,kind,target_id,event_id,created_at) VALUES(?,?,?,?,?,?,?)`)
      .run(randomUUID(),recipient,actor,kind,connection,connection,this.now());
  }
  groupEvent(reunion:string,actor:string,kind:'group_invitation'|'group_confirmed') {
    const db=this.storage.db;
    const members=db.prepare('SELECT user_id FROM group_reunion_members WHERE reunion_id=? AND user_id<>?').all(reunion,actor);
    const insert=db.prepare('INSERT OR IGNORE INTO notifications(id,recipient_id,actor_id,kind,target_id,event_id,created_at) VALUES(?,?,?,?,?,?,?)');
    for(const member of members) insert.run(randomUUID(),member.user_id,actor,kind,reunion,reunion,this.now());
  }
  groupCancelled(reunion:string) {
    const db=this.storage.db;
    const members=db.prepare('SELECT user_id FROM group_reunion_members WHERE reunion_id=? UNION SELECT user_id FROM private_meeting_members WHERE meeting_id=?').all(reunion,reunion);
    const insert=db.prepare("INSERT OR IGNORE INTO notifications(id,recipient_id,actor_id,kind,target_id,event_id,created_at) VALUES(?,?,?,'group_cancelled',?,?,?)");
    const dismissed=db.prepare('SELECT 1 FROM group_reunions g JOIN room_history_dismissals d ON d.room_id=g.room_id WHERE g.id=? AND d.user_id=?');
    for(const member of members) if(!dismissed.get(reunion,member.user_id)) insert.run(randomUUID(),member.user_id,member.user_id,reunion,reunion,this.now());
  }
  groupExpired(reunion:string) {
    const db=this.storage.db;
    const members=db.prepare('SELECT recipient_id FROM group_reunion_expirations WHERE reunion_id=?').all(reunion);
    const insert=db.prepare("INSERT OR IGNORE INTO notifications(id,recipient_id,actor_id,kind,target_id,event_id,created_at) VALUES(?,?,?,'group_expired',?,?,?)");
    for(const member of members) insert.run(randomUUID(),member.recipient_id,member.recipient_id,reunion,reunion,this.now());
  }
  setReunionReminder(actor:string,meeting:string,minutes:number) {
    const db=this.storage.db;
    if(this.storage.privateMeetingAccess(meeting,actor)===false || !this.storage.reserved(actor,meeting)) return 'not_found';
    if(minutes===0){db.prepare("DELETE FROM notifications WHERE recipient_id=? AND kind='meeting_reminder' AND target_id=?").run(actor,meeting);return 'ok';}
    const row=db.prepare('SELECT o.starts_at FROM scheduled_meetings m JOIN offerings o ON o.activity_id=m.id WHERE m.id=? AND m.cancelled_at IS NULL').get(meeting);
    if(!row) return 'not_found';
    const due=Number(row.starts_at)-minutes*60_000;
    if(due<=this.now()) return 'too_late';
    db.prepare("INSERT INTO notifications(id,recipient_id,actor_id,kind,target_id,event_id,created_at) VALUES(?,?,?,'meeting_reminder',?,?,?) ON CONFLICT(recipient_id,kind,event_id) DO UPDATE SET created_at=excluded.created_at,read_at=NULL").run(randomUUID(),actor,actor,meeting,meeting,due);
    return 'ok';
  }
  reunionReminder(actor:string,meeting:string,startsAt:number) {
    const row=this.storage.db.prepare("SELECT created_at FROM notifications WHERE recipient_id=? AND kind='meeting_reminder' AND target_id=?").get(actor,meeting);
    if(!row)return 0;
    const minutes=(startsAt-Number(row.created_at))/60_000;
    return minutes===15||minutes===60?minutes:0;
  }
  private visibility() { const current=Math.trunc(this.now());if(!Number.isSafeInteger(current)) throw Error('Invalid notification time'); return `n.recipient_id=? AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=n.recipient_id AND b.blocked_id=n.actor_id) OR (b.blocked_id=n.recipient_id AND b.user_id=n.actor_id)) AND ((n.kind='meeting_reminder' AND n.created_at<=${current} AND n.actor_id=n.recipient_id AND EXISTS (SELECT 1 FROM scheduled_meetings m JOIN offerings o ON o.activity_id=m.id JOIN reservations r ON r.activity_id=m.id AND r.user_id=n.recipient_id WHERE m.id=n.target_id AND m.cancelled_at IS NULL AND o.starts_at>${current} AND (NOT EXISTS (SELECT 1 FROM private_meeting_members pm WHERE pm.meeting_id=m.id) OR EXISTS (SELECT 1 FROM private_meeting_members pm WHERE pm.meeting_id=m.id AND pm.user_id=n.recipient_id)) AND NOT EXISTS (SELECT 1 FROM private_meeting_members other JOIN blocks b ON (b.user_id=n.recipient_id AND b.blocked_id=other.user_id) OR (b.blocked_id=n.recipient_id AND b.user_id=other.user_id) WHERE other.meeting_id=m.id))) OR (n.kind='group_cancelled' AND (EXISTS (SELECT 1 FROM group_reunions g JOIN group_reunion_members gm ON gm.reunion_id=g.id AND gm.user_id=n.recipient_id WHERE g.id=n.target_id AND g.status='cancelled' AND EXISTS (SELECT 1 FROM memberships rm WHERE rm.room_id=g.room_id AND rm.user_id=n.recipient_id) AND NOT EXISTS (SELECT 1 FROM room_history_dismissals hd WHERE hd.room_id=g.room_id AND hd.user_id=n.recipient_id)) OR EXISTS (SELECT 1 FROM scheduled_meetings s JOIN private_meeting_members pm ON pm.meeting_id=s.id AND pm.user_id=n.recipient_id WHERE s.id=n.target_id AND s.cancelled_at IS NOT NULL))) OR (n.kind='group_expired' AND n.actor_id=n.recipient_id AND EXISTS (SELECT 1 FROM group_reunion_expirations e WHERE e.reunion_id=n.target_id AND e.recipient_id=n.recipient_id) AND NOT EXISTS (SELECT 1 FROM group_reunions g JOIN room_history_dismissals d ON d.room_id=g.room_id AND d.user_id=n.recipient_id WHERE g.id=n.target_id)) OR (n.kind IN ('group_invitation','group_confirmed') AND EXISTS (SELECT 1 FROM group_reunions g JOIN group_reunion_members gm ON gm.reunion_id=g.id AND gm.user_id=n.recipient_id WHERE g.id=n.target_id AND EXISTS (SELECT 1 FROM memberships rm WHERE rm.room_id=g.room_id AND rm.user_id=n.recipient_id) AND NOT EXISTS (SELECT 1 FROM room_history_dismissals hd WHERE hd.room_id=g.room_id AND hd.user_id=n.recipient_id) AND ((n.kind='group_invitation' AND g.status='pending' AND gm.response='pending') OR (n.kind='group_confirmed' AND g.status='confirmed')) AND NOT EXISTS (SELECT 1 FROM group_reunion_members other JOIN blocks b ON (b.user_id=n.recipient_id AND b.blocked_id=other.user_id) OR (b.blocked_id=n.recipient_id AND b.user_id=other.user_id) WHERE other.reunion_id=g.id))) OR (n.kind='reply' AND EXISTS (SELECT 1 FROM plaza_posts p JOIN plaza_replies r ON r.id=n.event_id AND r.post_id=p.id WHERE p.id=n.target_id AND p.hidden=0 AND r.hidden=0 AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=n.recipient_id AND b.blocked_id=p.author_id) OR (b.blocked_id=n.recipient_id AND b.user_id=p.author_id)))) OR (n.kind='message' AND EXISTS (SELECT 1 FROM plaza_connections c JOIN plaza_private_messages m ON m.id=n.event_id AND m.connection_id=c.id WHERE c.id=n.target_id AND c.status='accepted' AND (c.sender_id=n.recipient_id OR c.recipient_id=n.recipient_id) AND m.hidden=0)) OR (n.kind='invitation' AND EXISTS (SELECT 1 FROM plaza_connections c WHERE c.id=n.target_id AND c.status='pending' AND c.recipient_id=n.recipient_id AND c.sender_id=n.actor_id)) OR (n.kind='acceptance' AND EXISTS (SELECT 1 FROM plaza_connections c WHERE c.id=n.target_id AND c.status='accepted' AND c.sender_id=n.recipient_id AND c.recipient_id=n.actor_id)))`; }
  list(actor: string) {
    const db = this.storage.db;
    const visible = this.visibility();
    const items = db.prepare(`SELECT n.id,n.kind,n.target_id AS targetId,n.created_at AS createdAt,n.read_at AS readAt,a.alias AS actor,COALESCE(p.title,'Conversación privada') AS title FROM notifications n JOIN accounts a ON a.id=n.actor_id LEFT JOIN plaza_posts p ON n.kind='reply' AND p.id=n.target_id WHERE ${visible} ORDER BY n.created_at DESC,n.rowid DESC LIMIT 100`).all(actor);
    const unread = Number(db.prepare(`SELECT count(*) AS n FROM notifications n WHERE ${visible} AND n.read_at IS NULL`).get(actor)!.n);
    const mutes = db.prepare('SELECT kind,target_id AS targetId FROM notification_mutes WHERE user_id=?').all(actor);
    return { items, unread, mutes };
  }
  read(actor: string, id: string) {
    const now=this.now();
    return this.storage.db.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND recipient_id=? AND (kind<>'meeting_reminder' OR created_at<=?)").run(now, id, actor, now).changes === 1;
  }
  readAll(actor: string) {
    this.storage.db.prepare(`UPDATE notifications AS n SET read_at=? WHERE ${this.visibility()} AND n.read_at IS NULL`).run(this.now(), actor);
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
