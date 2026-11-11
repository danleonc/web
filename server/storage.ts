import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import type { Session } from "../src/room/engine.ts";
import type { SharedMessage } from "../src/shared/protocol.ts";
import type { RoomSafety } from "../src/safety/rules.ts";

export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type Account = {
  id: string;
  username: string;
  alias: string;
  passwordHash: string;
  recoveryHash: string;
};
export type StoredRoom = {
  key: string;
  activityId: string;
  session: Session;
  messages: SharedMessage[];
  seen: Map<string, string>;
  revision: number;
  idleAt: number;
  safety: RoomSafety;
};
export class Storage {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    const version = this.db.prepare("PRAGMA user_version").get()!.user_version;
    if (
      version !== 0 &&
      version !== 1 &&
      version !== 2 &&
      version !== 3 &&
      version !== 4 &&
      version !== 5 &&
      version !== 6 &&
      version !== 7 &&
      version !== 8 &&
      version !== 9 &&
      version !== 10 &&
      version !== 11 &&
      version !== 12 &&
      version !== 13 &&
      version !== 14 &&
      version !== 15 &&
      version !== 16 &&
      version !== 17
    )
      throw new Error("Unsupported database version");
    if (version === 0)
      this.db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, alias TEXT NOT NULL, password_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS blocks(user_id TEXT NOT NULL REFERENCES accounts(id), blocked_id TEXT NOT NULL REFERENCES accounts(id), PRIMARY KEY(user_id,blocked_id), CHECK(user_id<>blocked_id));
      CREATE TABLE IF NOT EXISTS offerings(activity_id TEXT PRIMARY KEY, starts_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS reservations(user_id TEXT NOT NULL REFERENCES accounts(id), activity_id TEXT NOT NULL REFERENCES offerings(activity_id), created_at INTEGER NOT NULL, PRIMARY KEY(user_id,activity_id));
      CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY, activity_id TEXT NOT NULL REFERENCES offerings(activity_id), session_json TEXT NOT NULL, revision INTEGER NOT NULL, idle_at INTEGER NOT NULL, archived_at INTEGER);
      CREATE UNIQUE INDEX IF NOT EXISTS active_room ON rooms(activity_id) WHERE archived_at IS NULL;
      CREATE TABLE IF NOT EXISTS memberships(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES accounts(id), PRIMARY KEY(room_id,user_id));
      CREATE TABLE IF NOT EXISTS messages(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, id TEXT NOT NULL, sender_id TEXT NOT NULL REFERENCES accounts(id), client_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(room_id,id), UNIQUE(room_id,sender_id,client_id));
      CREATE TABLE IF NOT EXISTS receipts(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, request_id TEXT NOT NULL, message_id TEXT NOT NULL, PRIMARY KEY(room_id,request_id));
      CREATE TABLE IF NOT EXISTS auth_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, until_at INTEGER NOT NULL);
      PRAGMA user_version=1;
      COMMIT;
    `);
    if (version < 2)
      this.db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE rooms ADD COLUMN safety_json TEXT NOT NULL DEFAULT '{"ballot":null,"expelled":[],"cooldownUntil":0,"notice":""}';
      CREATE TABLE moderators(user_id TEXT PRIMARY KEY REFERENCES accounts(id));
      CREATE TABLE reports(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,reporter_id TEXT NOT NULL REFERENCES accounts(id),target_id TEXT NOT NULL REFERENCES accounts(id),reason TEXT NOT NULL,note TEXT NOT NULL,message_id TEXT NOT NULL,evidence_json TEXT NOT NULL,image_id TEXT,created_at INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'open',resolution TEXT NOT NULL DEFAULT '',UNIQUE(reporter_id,room_id,target_id,reason,message_id));
      CREATE TABLE moderation_actions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES accounts(id),moderator_id TEXT NOT NULL REFERENCES accounts(id),report_id TEXT,kind TEXT NOT NULL,reason TEXT NOT NULL,until_at INTEGER,created_at INTEGER NOT NULL);
      CREATE TABLE restrictions(user_id TEXT PRIMARY KEY REFERENCES accounts(id),kind TEXT NOT NULL,reason TEXT NOT NULL,until_at INTEGER,action_id TEXT NOT NULL);
      CREATE TABLE appeals(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES accounts(id),action_id TEXT NOT NULL,note TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',review_note TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,UNIQUE(user_id,action_id));
      CREATE TABLE media(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,owner_id TEXT NOT NULL REFERENCES accounts(id),client_id TEXT NOT NULL,body BLOB NOT NULL,created_at INTEGER NOT NULL,hidden INTEGER NOT NULL DEFAULT 0,UNIQUE(room_id,owner_id,client_id));
      PRAGMA user_version=2;COMMIT;`);
    if (version < 3)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE account_emails(
        user_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        verified_at INTEGER,
        adult_declared_at INTEGER NOT NULL,
        code_hash TEXT,
        code_until INTEGER NOT NULL DEFAULT 0,
        last_sent INTEGER NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX confirmed_email ON account_emails(email) WHERE verified_at IS NOT NULL;
      PRAGMA user_version=3; COMMIT;`);
    if (version < 4)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE account_google(user_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE, subject TEXT NOT NULL UNIQUE, profile_complete INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
      CREATE TABLE google_flows(state_hash TEXT PRIMARY KEY, browser_hash TEXT NOT NULL, verifier TEXT NOT NULL, nonce_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, intent TEXT NOT NULL, session_hash TEXT, account_id TEXT, return_to TEXT NOT NULL);
      PRAGMA user_version=4; COMMIT;`);
    if (version < 5)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE push_subscriptions(endpoint_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,session_hash TEXT NOT NULL,subscription_json TEXT NOT NULL,created_at INTEGER NOT NULL);
      CREATE INDEX push_user ON push_subscriptions(user_id);
      PRAGMA user_version=5; COMMIT;`);
    if (version < 6)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE plaza_posts(id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES accounts(id), topic TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE plaza_replies(id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES plaza_posts(id) ON DELETE CASCADE, author_id TEXT NOT NULL REFERENCES accounts(id), body TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE INDEX plaza_replies_post ON plaza_replies(post_id, created_at, id);
      PRAGMA user_version=6; COMMIT;`);
    if (version < 7)
      this.db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE plaza_posts ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE plaza_replies ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE plaza_reports(id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES accounts(id), target_id TEXT NOT NULL REFERENCES accounts(id), kind TEXT NOT NULL, content_id TEXT NOT NULL, reason TEXT NOT NULL, note TEXT NOT NULL, evidence_json TEXT NOT NULL, created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', UNIQUE(reporter_id,kind,content_id,reason));
      CREATE TABLE plaza_moderation_actions(id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES plaza_reports(id), moderator_id TEXT NOT NULL REFERENCES accounts(id), action TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL);
      PRAGMA user_version=7; COMMIT;`);
    if (version < 8)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE plaza_appeals(id TEXT PRIMARY KEY, report_id TEXT NOT NULL UNIQUE REFERENCES plaza_reports(id), user_id TEXT NOT NULL REFERENCES accounts(id), note TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL);
      CREATE TABLE plaza_appeal_actions(id TEXT PRIMARY KEY, appeal_id TEXT NOT NULL UNIQUE REFERENCES plaza_appeals(id), moderator_id TEXT NOT NULL REFERENCES accounts(id), decision TEXT NOT NULL, note TEXT NOT NULL, created_at INTEGER NOT NULL);
      PRAGMA user_version=8; COMMIT;`);
    if (version < 9)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE plaza_connections(id TEXT PRIMARY KEY, sender_id TEXT NOT NULL REFERENCES accounts(id), recipient_id TEXT NOT NULL REFERENCES accounts(id), low_id TEXT NOT NULL REFERENCES accounts(id), high_id TEXT NOT NULL REFERENCES accounts(id), note TEXT NOT NULL, origin_kind TEXT NOT NULL, origin_id TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, CHECK(sender_id<>recipient_id));
      CREATE UNIQUE INDEX plaza_connections_active ON plaza_connections(low_id,high_id) WHERE status IN ('pending','accepted');
      CREATE TABLE plaza_private_messages(id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES plaza_connections(id) ON DELETE CASCADE, sender_id TEXT NOT NULL REFERENCES accounts(id), client_id TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(connection_id,sender_id,client_id));
      CREATE INDEX plaza_private_messages_connection ON plaza_private_messages(connection_id,created_at,id);
      PRAGMA user_version=9; COMMIT;`);
    if (version < 10)
      this.db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE plaza_private_messages ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
      PRAGMA user_version=10; COMMIT;`);
    if (version < 11)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE scheduled_meetings(id TEXT PRIMARY KEY REFERENCES offerings(activity_id), theme_id TEXT NOT NULL, capacity INTEGER NOT NULL, duration INTEGER NOT NULL, created_at INTEGER NOT NULL, created_by TEXT NOT NULL REFERENCES accounts(id));
      PRAGMA user_version=11; COMMIT;`);
    if (version < 12)
      this.db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE scheduled_meetings ADD COLUMN cancelled_at INTEGER;
      ALTER TABLE scheduled_meetings ADD COLUMN cancellation_reason TEXT;
      PRAGMA user_version=12; COMMIT;`);
    if (version < 13)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS push_queue(meeting_id TEXT NOT NULL, endpoint_hash TEXT NOT NULL, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, next_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(meeting_id,endpoint_hash));
      CREATE INDEX IF NOT EXISTS push_queue_due ON push_queue(next_at);
      PRAGMA user_version=13; COMMIT;`);
    if (version < 14)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS push_private_queue(connection_id TEXT NOT NULL,endpoint_hash TEXT NOT NULL,user_id TEXT NOT NULL,message_id TEXT NOT NULL,created_at INTEGER NOT NULL,next_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(connection_id,endpoint_hash));
      CREATE INDEX IF NOT EXISTS push_private_due ON push_private_queue(next_at);
      PRAGMA user_version=14; COMMIT;`);
    if (version < 15)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS privacy_operators(user_id TEXT PRIMARY KEY REFERENCES accounts(id));
      CREATE TABLE IF NOT EXISTS privacy_requests(user_id TEXT PRIMARY KEY REFERENCES accounts(id),status TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,version INTEGER NOT NULL,seen_by TEXT REFERENCES accounts(id));
      PRAGMA user_version=15; COMMIT;`);
    if (version < 16)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS privacy_request_events(user_id TEXT NOT NULL REFERENCES accounts(id),version INTEGER NOT NULL,action TEXT NOT NULL,actor_id TEXT REFERENCES accounts(id),created_at INTEGER NOT NULL,PRIMARY KEY(user_id,version));
      INSERT OR IGNORE INTO privacy_request_events(user_id,version,action,actor_id,created_at) SELECT user_id,version,'legacy_snapshot',NULL,updated_at FROM privacy_requests;
      PRAGMA user_version=16; COMMIT;`);
    if (version < 17)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS privacy_erasure_receipts(id TEXT PRIMARY KEY,subject_hash TEXT NOT NULL UNIQUE,operator_id TEXT NOT NULL REFERENCES accounts(id),completed_at INTEGER NOT NULL,request_version INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS privacy_erasure_events(receipt_id TEXT NOT NULL REFERENCES privacy_erasure_receipts(id),version INTEGER NOT NULL,action TEXT NOT NULL,actor_id TEXT REFERENCES accounts(id),created_at INTEGER NOT NULL,PRIMARY KEY(receipt_id,version));
      PRAGMA user_version=17; COMMIT;`);
  }
  transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  account(username: string): Account | undefined {
    return this.db
      .prepare(
        "SELECT id,username,alias,password_hash AS passwordHash,recovery_hash AS recoveryHash FROM accounts WHERE username=?",
      )
      .get(username) as Account | undefined;
  }
  publicAccounts() {
    return this.db.prepare("SELECT id,alias FROM accounts").all() as {
      id: string;
      alias: string;
    }[];
  }
  createAccount(a: Account, now: number) {
    this.db
      .prepare("INSERT INTO accounts VALUES(?,?,?,?,?,?)")
      .run(a.id, a.username, a.alias, a.passwordHash, a.recoveryHash, now);
  }
  createSession(token: string, userId: string, expires: number) {
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(digest(token), userId, expires);
    this.db
      .prepare(
        "DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY expires_at DESC,rowid DESC LIMIT 5)",
      )
      .run(userId, userId);
  }
  session(tokenHash: string, now: number) {
    return this.db
      .prepare(
        "SELECT a.id,a.alias,s.expires_at AS expires FROM sessions s JOIN accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
      )
      .get(tokenHash, now) as
      | { id: string; alias: string; expires: number }
      | undefined;
  }
  revoke(tokenHash: string) {
    this.db.prepare("DELETE FROM push_subscriptions WHERE session_hash=?").run(tokenHash);
    this.db.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash);
  }
  recover(id: string, passwordHash: string, recoveryHash: string) {
    this.transaction(() => {
      this.db
        .prepare(
          "UPDATE accounts SET password_hash=?,recovery_hash=? WHERE id=?",
        )
        .run(passwordHash, recoveryHash, id);
      this.db.prepare("DELETE FROM push_subscriptions WHERE user_id=?").run(id);
      this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
    });
  }
  takeLimit(key: string, maximum: number, duration: number, now: number) {
    const row = this.db
      .prepare("SELECT count,until_at AS untilAt FROM auth_limits WHERE key=?")
      .get(key) as { count: number; untilAt: number } | undefined;
    if (row && row.untilAt > now && row.count >= maximum) return false;
    this.db
      .prepare("INSERT OR REPLACE INTO auth_limits VALUES(?,?,?)")
      .run(
        key,
        row && row.untilAt > now ? row.count + 1 : 1,
        row && row.untilAt > now ? row.untilAt : now + duration,
      );
    return true;
  }
  block(userId: string, blockedId: string) {
    this.transaction(() => {
      this.db.prepare("INSERT OR IGNORE INTO blocks VALUES(?,?)").run(userId, blockedId);
      this.db.prepare("UPDATE plaza_connections SET status='closed' WHERE status IN ('pending','accepted') AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))").run(userId, blockedId, blockedId, userId);
    });
  }
  unblock(userId: string, blockedId: string) {
    return this.db.prepare("DELETE FROM blocks WHERE user_id=? AND blocked_id=?").run(userId, blockedId).changes === 1;
  }
  blockedAccounts(userId: string) {
    return this.db.prepare("SELECT a.id,a.alias FROM blocks b JOIN accounts a ON a.id=b.blocked_id WHERE b.user_id=? ORDER BY a.alias,a.id").all(userId);
  }
  blocks(userId: string) {
    return new Set(
      (
        this.db
          .prepare("SELECT blocked_id AS id FROM blocks WHERE user_id=?")
          .all(userId) as { id: string }[]
      ).map((r) => r.id),
    );
  }
  accountById(id: string) {
    return this.db
      .prepare(
        "SELECT id,username,alias,password_hash AS passwordHash,recovery_hash AS recoveryHash FROM accounts WHERE id=?",
      )
      .get(id) as Account | undefined;
  }
  googleIdentity(id: string) {
    return this.db
      .prepare(
        "SELECT subject,profile_complete AS profileComplete FROM account_google WHERE user_id=?",
      )
      .get(id) as { subject: string; profileComplete: number } | undefined;
  }
  emailStatus(id: string) {
    return this.db
      .prepare(
        "SELECT email, verified_at AS verifiedAt, adult_declared_at AS adultDeclaredAt, code_hash AS codeHash, code_until AS codeUntil, last_sent AS lastSent, attempts FROM account_emails WHERE user_id=?",
      )
      .get(id) as
      | {
          email: string;
          verifiedAt: number | null;
          adultDeclaredAt: number;
          codeHash: string | null;
          codeUntil: number;
          lastSent: number;
          attempts: number;
        }
      | undefined;
  }
  canParticipate(id: string) {
    const status = this.emailStatus(id);
    return (
      status?.verifiedAt != null &&
      status.adultDeclaredAt > 0 &&
      this.googleIdentity(id)?.profileComplete !== 0
    );
  }
  offering(id: string, startsAt: number) {
    this.db
      .prepare("INSERT OR IGNORE INTO offerings VALUES(?,?)")
      .run(id, startsAt);
  }
  startsAt(id: string) {
    return this.db
      .prepare(
        "SELECT starts_at AS startsAt FROM offerings WHERE activity_id=?",
      )
      .get(id)!.startsAt as number;
  }
  reservations(userId: string) {
    return (
      this.db
        .prepare("SELECT activity_id AS id FROM reservations WHERE user_id=?")
        .all(userId) as { id: string }[]
    ).map((r) => r.id);
  }
  reserved(userId: string, activityId: string) {
    return this.reservations(userId).includes(activityId);
  }
  countReservations(activityId: string) {
    return this.db
      .prepare("SELECT COUNT(*) AS count FROM reservations WHERE activity_id=?")
      .get(activityId)!.count as number;
  }
  reserve(
    userId: string,
    activityId: string,
    maximum: number,
    now: number,
    duration = 40,
  ): "ok" | "full" | "conflict" | "closed" {
    return this.transaction(() => {
      if (this.reserved(userId, activityId)) return "ok";
      if (now >= this.startsAt(activityId)) return "closed";
      if (
        this.db
          .prepare(
            "SELECT 1 FROM reservations r JOIN offerings a ON a.activity_id=r.activity_id LEFT JOIN scheduled_meetings m ON m.id=a.activity_id WHERE r.user_id=? AND a.starts_at<? AND a.starts_at+COALESCE(m.duration,40)*60000>?",
          )
          .get(userId, this.startsAt(activityId) + duration * 60_000, this.startsAt(activityId))
      )
        return "conflict";
      if (this.countReservations(activityId) >= maximum) return "full";
      this.db
        .prepare("INSERT INTO reservations VALUES(?,?,?)")
        .run(userId, activityId, now);
      return "ok";
    });
  }
  cancel(userId: string, activityId: string) {
    this.db
      .prepare("DELETE FROM reservations WHERE user_id=? AND activity_id=?")
      .run(userId, activityId);
  }
  saveRoom(room: StoredRoom) {
    this.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO rooms(id,activity_id,session_json,revision,idle_at,archived_at,safety_json) VALUES(?,?,?,?,?,NULL,?) ON CONFLICT(id) DO UPDATE SET session_json=excluded.session_json,revision=excluded.revision,idle_at=excluded.idle_at,safety_json=excluded.safety_json",
        )
        .run(
          room.key,
          room.activityId,
          JSON.stringify(room.session),
          room.revision,
          room.idleAt,
          JSON.stringify(room.safety),
        );
      // A visitor who leaves reception must not retain access to the later group.
      // After a meeting starts, disconnected members remain in its roster.
      this.db.prepare("DELETE FROM memberships WHERE room_id=?").run(room.key);
      const member = this.db.prepare(
        "INSERT OR IGNORE INTO memberships VALUES(?,?)",
      );
      for (const p of room.session.participants)
        if (!room.safety.expelled.includes(p.id)) member.run(room.key, p.id);
      // Only the most recent 50 messages and 200 receipts are retained, as advertised.
      this.db.prepare("DELETE FROM messages WHERE room_id=?").run(room.key);
      const message = this.db.prepare("INSERT INTO messages VALUES(?,?,?,?,?)");
      for (const m of room.messages)
        message.run(room.key, m.id, m.senderId, m.clientId, JSON.stringify(m));
      this.db.prepare("DELETE FROM receipts WHERE room_id=?").run(room.key);
      const receipt = this.db.prepare("INSERT INTO receipts VALUES(?,?,?)");
      for (const [id, messageId] of room.seen)
        receipt.run(room.key, id, messageId);
    });
  }
  loadRooms(): StoredRoom[] {
    return this.db
      .prepare("SELECT * FROM rooms WHERE archived_at IS NULL")
      .all()
      .map((r) => ({
        key: r.id as string,
        activityId: r.activity_id as string,
        session: JSON.parse(r.session_json as string),
        revision: r.revision as number,
        idleAt: r.idle_at as number,
        safety: JSON.parse(r.safety_json as string),
        messages: this.messages(r.id as string),
        seen: new Map(
          (
            this.db
              .prepare(
                "SELECT request_id,message_id FROM receipts WHERE room_id=? ORDER BY rowid",
              )
              .all(r.id) as { request_id: string; message_id: string }[]
          ).map((x) => [x.request_id, x.message_id]),
        ),
      }));
  }
  messages(roomId: string) {
    return this.db
      .prepare("SELECT payload FROM messages WHERE room_id=? ORDER BY rowid")
      .all(roomId)
      .map((r) => JSON.parse(r.payload as string) as SharedMessage);
  }
  archive(roomId: string, now: number) {
    this.db
      .prepare("UPDATE rooms SET archived_at=? WHERE id=?")
      .run(now, roomId);
  }
  history(userId: string) {
    return this.db
      .prepare(
        "SELECT r.id,r.activity_id AS activityId,r.session_json AS session FROM rooms r JOIN memberships m ON m.room_id=r.id WHERE m.user_id=? ORDER BY r.rowid DESC LIMIT 20",
      )
      .all(userId)
      .map((r) => ({
        id: r.id,
        activityId: r.activityId,
        phase: (JSON.parse(r.session as string) as Session).phase,
      }));
  }
  member(userId: string, roomId: string) {
    return !!this.db
      .prepare("SELECT 1 FROM memberships WHERE user_id=? AND room_id=?")
      .get(userId, roomId);
  }
  prune(now: number) {
    this.db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now);
    this.db.prepare("DELETE FROM google_flows WHERE expires_at<=?").run(now);
    this.db.prepare("DELETE FROM auth_limits WHERE until_at<=?").run(now);
    this.db
      .prepare(
        "UPDATE account_emails SET code_hash=NULL, code_until=0 WHERE code_until<=? AND code_hash IS NOT NULL",
      )
      .run(now);
    this.db
      .prepare(
        "DELETE FROM rooms WHERE archived_at IS NOT NULL AND archived_at<?",
      )
      .run(now - 30 * 24 * 60 * 60_000);
  }
  close() {
    this.db.close();
  }
}
