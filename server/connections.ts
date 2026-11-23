import { randomUUID } from "node:crypto";
import type { Storage } from "./storage.ts";
import { digest } from "./storage.ts";
import { PlazaStore } from "./plaza.ts";
import { Notifications } from "./notifications.ts";
import { validSticker } from "./stickers.ts";
import { advancePhotoChallenge } from "./photo-challenge.ts";

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
  invite(actor: string, kind: string, contentId: string, note: string, challengeAccepted = false) {
    const recipient = new PlazaStore(this.storage).blockTarget(actor, kind, contentId);
    return this.inviteRecipient(actor, recipient, kind, contentId, note, challengeAccepted);
  }
  inviteFromRoom(actor: string, roomId: string, recipient: string, note: string, challengeAccepted = false) {
    if (!/^[a-f0-9-]{36}$/.test(roomId) || !/^[a-f0-9-]{36}$/.test(recipient) || actor === recipient) throw Error('invalid_target');
    if (!this.roomPeople(actor,roomId)?.some(person => person.id === recipient)) throw Error('invalid_target');
    return this.inviteRecipient(actor, recipient, 'room', roomId, note, challengeAccepted);
  }
  roomPeople(actor: string, roomId: string) {
    const db=this.storage.db;
    const room=db.prepare('SELECT session_json FROM rooms WHERE id=?').get(roomId);
    let session: {phase?:unknown;sessionUntil?:unknown};
    try { session=JSON.parse(String(room?.session_json)); } catch { return null; }
    if (session?.phase!=='closed' || typeof session.sessionUntil!=='number' || !Number.isFinite(session.sessionUntil) || session.sessionUntil<=0 || !db.prepare('SELECT 1 FROM memberships WHERE room_id=? AND user_id=?').get(roomId,actor) || db.prepare('SELECT 1 FROM room_history_dismissals WHERE room_id=? AND user_id=?').get(roomId,actor)) return null;
    return db.prepare(`SELECT a.id,a.alias AS name FROM memberships m JOIN accounts a ON a.id=m.user_id WHERE m.room_id=? AND m.user_id<>? AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=m.user_id) OR (b.blocked_id=? AND b.user_id=m.user_id)) AND NOT EXISTS (SELECT 1 FROM room_history_dismissals d WHERE d.room_id=m.room_id AND d.user_id=m.user_id) ORDER BY a.alias,a.id`).all(roomId,actor,actor,actor);
  }
  private inviteRecipient(actor: string, recipient: string, kind: string, contentId: string, note: string, challengeAccepted: boolean) {
    if (typeof note !== "string" || note.length > 500) throw Error("invalid_note");
    const [low, high] = [actor, recipient].sort();
    const db = this.storage.db;
    const existing = db.prepare("SELECT id,sender_id,status FROM plaza_connections WHERE low_id=? AND high_id=? AND status IN ('pending','accepted')").get(low, high);
    if (existing) {
      if (existing.status === "pending" && existing.sender_id !== actor) throw Error("incoming_request_exists");
      if (existing.status === "pending" && existing.sender_id === actor && challengeAccepted) {
        const photo = db.prepare("SELECT id FROM account_profile_photos WHERE user_id=? AND hidden=0").get(actor);
        if (photo) db.prepare("INSERT INTO connection_photo_challenges(connection_id,sender_photo) VALUES(?,?) ON CONFLICT(connection_id) DO UPDATE SET sender_photo=excluded.sender_photo").run(existing.id,photo.id);
      }
      return { id: String(existing.id), status: String(existing.status) };
    }
    if (!this.storage.takeLimit(digest(`plaza-invitations:${actor}`), 10, 60 * 60_000, this.now())) throw Error("rate_limited");
    const id = randomUUID(), time = this.now();
    this.storage.transaction(() => {
      db.prepare("INSERT INTO plaza_connections VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(id, actor, recipient, low, high, note.trim(), kind, contentId, "pending", time, time);
      if (challengeAccepted) {
        const photo=db.prepare("SELECT id FROM account_profile_photos WHERE user_id=? AND hidden=0").get(actor);
        if (photo) db.prepare("INSERT INTO connection_photo_challenges(connection_id,sender_photo) VALUES(?,?)").run(id,photo.id);
      }
      new Notifications(this.storage, this.now).connectionEvent(id, actor, "invitation");
    });
    return { id, status: "pending" };
  }
  list(actor: string, cursor?: string) {
    let time = Number.MAX_SAFE_INTEGER, id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    if (cursor) {
      if (!/^[A-Za-z0-9_-]{1,120}$/.test(cursor)) throw Error('invalid_cursor');
      let value: unknown;
      try { value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); } catch { throw Error('invalid_cursor'); }
      if (!Array.isArray(value) || value.length !== 2 || !Number.isSafeInteger(value[0]) || value[0] < 0 || typeof value[1] !== 'string' || !/^[a-f0-9-]{36}$/.test(value[1])) throw Error('invalid_cursor');
      [time,id] = value;
    }
    const paginated = cursor !== undefined;
    const rows = this.storage.db.prepare(`SELECT c.id,c.sender_id AS senderId,c.recipient_id AS recipientId,c.note,c.origin_kind AS originKind,c.origin_id AS originId,c.status,c.created_at AS createdAt,c.updated_at AS updatedAt,a.id AS personId,a.alias AS person
      FROM plaza_connections c JOIN accounts a ON a.id=CASE WHEN c.sender_id=? THEN c.recipient_id ELSE c.sender_id END
      WHERE (c.sender_id=? OR c.recipient_id=?) AND NOT EXISTS (SELECT 1 FROM connection_dismissals d WHERE d.user_id=? AND d.connection_id=c.id) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=c.sender_id AND b.blocked_id=c.recipient_id) OR (b.user_id=c.recipient_id AND b.blocked_id=c.sender_id))
      ${paginated ? 'AND (c.updated_at<? OR (c.updated_at=? AND c.id<?))' : ''} ORDER BY c.updated_at DESC,c.id DESC LIMIT ${paginated ? 51 : 100}`).all(actor, actor, actor, actor, ...(paginated ? [time,time,id] : []));
    const connections = paginated ? rows.slice(0,50) : rows;
    const last = connections.at(-1);
    return { connections, ...(paginated ? { nextCursor: rows.length > 50 && last ? Buffer.from(JSON.stringify([last.updatedAt,last.id])).toString('base64url') : null } : {}) };
  }
  dismiss(actor: string, id: string) {
    const row = this.visible(id,actor);
    if (!row) return "not_found";
    if (!["closed","declined"].includes(String(row.status))) return "active";
    this.storage.db.prepare("INSERT OR IGNORE INTO connection_dismissals(user_id,connection_id,created_at) VALUES(?,?,?)").run(actor,id,this.now());
    return "ok";
  }
  get(actor: string, id: string) {
    return this.storage.db.prepare(`SELECT c.id,c.sender_id AS senderId,c.recipient_id AS recipientId,c.note,c.origin_kind AS originKind,c.origin_id AS originId,c.status,c.created_at AS createdAt,a.id AS personId,a.alias AS person
      FROM plaza_connections c JOIN accounts a ON a.id=CASE WHEN c.sender_id=? THEN c.recipient_id ELSE c.sender_id END
      WHERE c.id=? AND (c.sender_id=? OR c.recipient_id=?) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=c.sender_id AND b.blocked_id=c.recipient_id) OR (b.user_id=c.recipient_id AND b.blocked_id=c.sender_id))`).get(actor,id,actor,actor);
  }
  decide(actor: string, id: string, action: string, challengeAccepted = false) {
    const row = this.visible(id, actor);
    if (!row) return false;
    const next = action === "accept" && row.status === "pending" && row.recipient_id === actor ? "accepted"
      : action === "decline" && row.status === "pending" && row.recipient_id === actor ? "declined"
      : action === "withdraw" && ((row.status === "pending" && row.sender_id === actor) || row.status === "accepted") ? "closed" : null;
    if (!next) return false;
    return this.storage.transaction(() => {
      const changed = this.storage.db.prepare("UPDATE plaza_connections SET status=?,updated_at=? WHERE id=? AND status=?").run(next, this.now(), id, row.status).changes === 1;
      if (changed && next === "accepted") {
        if (challengeAccepted && this.storage.db.prepare("SELECT 1 FROM account_profile_photos WHERE user_id=? AND hidden=0").get(actor)) this.joinChallenge(actor,id,false);
        new Notifications(this.storage, this.now).connectionEvent(id, actor, "acceptance");
      }
      return changed;
    });
  }
  peer(actor: string, id: string) {
    const row = this.visible(id, actor);
    if (!row || row.status !== "accepted") return null;
    return String(row.sender_id === actor ? row.recipient_id : row.sender_id);
  }
  messages(actor: string, id: string, cursor?: string) {
    const connection = this.visible(id, actor);
    if (!connection || connection.status !== "accepted") return null;
    if (cursor && (!/^[1-9][0-9]{0,15}$/.test(cursor) || !Number.isSafeInteger(Number(cursor)))) throw Error('invalid_cursor');
    const paginated = cursor !== undefined;
    const rows = this.storage.db.prepare(`SELECT m.rowid AS position,m.id,m.sender_id AS senderId,m.body,m.sticker_id AS stickerId,CASE WHEN EXISTS (SELECT 1 FROM plaza_private_messages q WHERE q.id=m.reply_to AND q.connection_id=m.connection_id AND q.hidden=0) THEN m.reply_to ELSE NULL END AS replyTo,(SELECT id FROM plaza_images i WHERE i.message_id=m.id) AS imageId,(SELECT description FROM plaza_images i WHERE i.message_id=m.id) AS imageDescription,m.created_at AS createdAt FROM plaza_private_messages m WHERE m.connection_id=? AND m.hidden=0 AND (m.body<>'' OR m.sticker_id IS NOT NULL OR EXISTS (SELECT 1 FROM plaza_images i WHERE i.message_id=m.id)) ${paginated ? 'AND m.rowid<?' : ''} ORDER BY m.rowid DESC LIMIT ${paginated ? 51 : 100}`).all(id, ...(paginated ? [cursor ? Number(cursor) : Number.MAX_SAFE_INTEGER] : []));
    const page = paginated ? rows.slice(0,50) : rows;
    const nextCursor = paginated && rows.length > 50 ? String(page.at(-1)!.position) : null;
    const ids = [...new Set(page.map(row => row.replyTo).filter((value): value is string => typeof value === 'string'))];
    const targets = ids.length ? this.storage.db.prepare(`SELECT q.id,q.body,q.sender_id AS senderId,q.sticker_id AS stickerId,a.alias AS author,EXISTS(SELECT 1 FROM plaza_images i WHERE i.message_id=q.id) AS hasImage FROM plaza_private_messages q JOIN accounts a ON a.id=q.sender_id WHERE q.connection_id=? AND q.hidden=0 AND q.id IN (${ids.map(() => '?').join(',')})`).all(id,...ids) : [];
    const messages = page.reverse().map(({position: _position, ...message}) => { const target=targets.find(item => item.id===message.replyTo); return {...message,quote:target ? {id:target.id,name:target.senderId===actor ? 'Tú' : target.author,summary:String(target.body).slice(0,160) || (target.hasImage ? 'Imagen' : 'Sticker')} : null}; });
    return { messages, ...(paginated ? { nextCursor } : {}) };
  }
  remove(actor: string, connectionId: string, messageId: string) {
    const connection = this.visible(connectionId, actor);
    if (!connection || connection.status !== "accepted") return false;
    return this.storage.transaction(() => {
      const result = this.storage.db.prepare("UPDATE plaza_private_messages SET body='',sticker_id=NULL,hidden=1 WHERE id=? AND connection_id=? AND sender_id=? AND hidden=0").run(messageId, connectionId, actor);
      if (result.changes) {
        this.storage.db.prepare("DELETE FROM push_private_queue WHERE connection_id=? AND message_id=?").run(connectionId, messageId);
        this.storage.db.prepare("DELETE FROM plaza_images WHERE message_id=?").run(messageId);
      }
      return result.changes === 1;
    });
  }
  seen(actor: string, connectionId: string, messageId: string) {
    const connection = this.visible(connectionId, actor);
    if (!connection || connection.status !== "accepted") return false;
    const db = this.storage.db;
    if (!db.prepare("SELECT 1 FROM plaza_private_messages WHERE id=? AND connection_id=? AND sender_id<>? AND hidden=0 AND (body<>'' OR sticker_id IS NOT NULL)").get(messageId, connectionId, actor)) return false;
    db.prepare("DELETE FROM push_private_queue WHERE connection_id=? AND user_id=? AND message_id=?").run(connectionId, actor, messageId);
    db.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE recipient_id=? AND kind='message' AND target_id=? AND event_id IN (SELECT id FROM plaza_private_messages WHERE connection_id=? AND rowid <= (SELECT rowid FROM plaza_private_messages WHERE id=?))").run(this.now(), actor, connectionId, connectionId, messageId);
    return true;
  }
  challenge(actor: string, id: string) {
    const connection = this.visible(id, actor);
    if (!connection || connection.status !== "accepted") return null;
    const row = this.storage.db.prepare("SELECT * FROM connection_photo_challenges WHERE connection_id=?").get(id);
    const mine = connection.sender_id === actor ? row?.sender_photo : row?.recipient_photo;
    const theirs = connection.sender_id === actor ? row?.recipient_photo : row?.sender_photo;
    return { mine: !!mine, theirs: !!theirs, ready: !!mine && !!theirs, started: !!row?.requested_by, rounds: Number(row?.rounds || 0), unlocked: row?.unlocked === 1 };
  }
  joinChallenge(actor: string, id: string, request = true) {
    const connection = this.visible(id, actor);
    if (!connection || connection.status !== "accepted") return false;
    const photo = this.storage.db.prepare("SELECT id FROM account_profile_photos WHERE user_id=? AND hidden=0").get(actor);
    if (!photo) throw Error("profile_photo_required");
    const field = connection.sender_id === actor ? "sender_photo" : "recipient_photo";
    this.storage.db.prepare("INSERT OR IGNORE INTO connection_photo_challenges(connection_id) VALUES(?)").run(id);
    this.storage.db.prepare(`UPDATE connection_photo_challenges SET ${field}=?, requested_by=CASE WHEN ? THEN COALESCE(requested_by,?) ELSE requested_by END WHERE connection_id=?`).run(photo.id,request ? 1 : 0,actor,id);
    return true;
  }
  startChallenge(actor: string, id: string) {
    const connection = this.visible(id,actor); if (!connection || connection.status !== "accepted") return false;
    const row = this.storage.db.prepare("SELECT sender_photo,recipient_photo FROM connection_photo_challenges WHERE connection_id=?").get(id);
    if (!row || !(connection.sender_id === actor ? row.sender_photo : row.recipient_photo)) throw Error("agreement_required");
    this.storage.db.prepare("UPDATE connection_photo_challenges SET requested_by=COALESCE(requested_by,?) WHERE connection_id=?").run(actor,id); return true;
  }
  advanceChallenge(id: string, actor: string) {
    const db = this.storage.db;
    const row = db.prepare(`SELECT q.*,c.sender_id,c.recipient_id FROM connection_photo_challenges q JOIN plaza_connections c ON c.id=q.connection_id WHERE q.connection_id=? AND c.status='accepted'`).get(id);
    if (!row || !row.sender_photo || !row.recipient_photo || !row.requested_by || row.unlocked) return;
    if (!db.prepare("SELECT 1 FROM account_profile_photos WHERE user_id=? AND id=? AND hidden=0").get(row.sender_id,row.sender_photo) || !db.prepare("SELECT 1 FROM account_profile_photos WHERE user_id=? AND id=? AND hidden=0").get(row.recipient_id,row.recipient_photo)) return;
    const progress = advancePhotoChallenge({rounds:Number(row.rounds),first:row.first_sender ? String(row.first_sender) : null,unlocked:false},actor,String(row.sender_id),String(row.recipient_id));
    db.prepare("UPDATE connection_photo_challenges SET rounds=?,first_sender=?,unlocked=? WHERE connection_id=?").run(progress.rounds,progress.first,progress.unlocked ? 1 : 0,id);
    if (progress.unlocked) {
      const share=db.prepare("INSERT OR IGNORE INTO profile_photo_shares(owner_id,connection_id) VALUES(?,?)");
      share.run(row.sender_id,id); share.run(row.recipient_id,id);
    }
  }
  send(actor: string, id: string, clientId: string, value: string, stickerId = "", replyTo = "") {
    const connection = this.visible(id, actor);
    if (!connection || connection.status !== "accepted") return null;
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(clientId) || typeof value !== "string" || (!value.trim() && !stickerId) || value.length > 2000 || (stickerId && !validSticker(stickerId))) throw Error("invalid_message");
    const body = value.trim(); const db = this.storage.db;
    const old = db.prepare("SELECT id,body,sticker_id,reply_to FROM plaza_private_messages WHERE connection_id=? AND sender_id=? AND client_id=?").get(id, actor, clientId);
    if (old) { if (old.body !== body || (old.sticker_id || "") !== stickerId || (old.reply_to || "") !== replyTo) throw Error("client_id_conflict"); return { id: String(old.id) }; }
    if (replyTo && !db.prepare("SELECT 1 FROM plaza_private_messages WHERE id=? AND connection_id=? AND hidden=0").get(replyTo,id)) throw Error("invalid_reply");
    if (!this.storage.takeLimit(digest(`plaza-private:${actor}`), 120, 60 * 60_000, this.now())) throw Error("rate_limited");
    const messageId = randomUUID(), time = this.now();
    const recipient = String(connection.sender_id === actor ? connection.recipient_id : connection.sender_id);
    this.storage.transaction(() => {
      db.prepare("INSERT INTO plaza_private_messages(id,connection_id,sender_id,client_id,body,created_at,sticker_id,reply_to) VALUES(?,?,?,?,?,?,?,?)").run(messageId, id, actor, clientId, body, time, stickerId || null, replyTo || null);
      this.advanceChallenge(id, actor);
      new Notifications(this.storage, this.now).privateMessage(id, messageId, actor);
      db.prepare("INSERT INTO push_private_queue(connection_id,endpoint_hash,user_id,message_id,created_at,next_at) SELECT ?,endpoint_hash,user_id,?,?,? FROM push_subscriptions WHERE user_id=? AND NOT EXISTS (SELECT 1 FROM notification_mutes WHERE user_id=? AND kind='connection' AND target_id=?) ON CONFLICT(connection_id,endpoint_hash) DO UPDATE SET message_id=excluded.message_id,created_at=excluded.created_at,next_at=excluded.next_at,attempts=0").run(id, messageId, time, time, recipient, recipient, id);
    });
    return { id: messageId };
  }
}
