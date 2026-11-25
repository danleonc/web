import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import type { Session } from "../src/room/engine.ts";
import type { SharedMessage } from "../src/shared/protocol.ts";
import type { RoomSafety } from "../src/safety/rules.ts";
import { installGroupReunionSchema } from './group-reunion-store.ts';
import { Notifications } from './notifications.ts';

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
    try {
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
      version !== 17 &&
      version !== 18 &&
      version !== 19 &&
      version !== 20 &&
      version !== 21 &&
      version !== 22 &&
      version !== 23 &&
      version !== 24 &&
      version !== 25 &&
      version !== 26 &&
      version !== 27 &&
      version !== 28 &&
      version !== 29
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
    if (version < 18)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE notifications(id TEXT PRIMARY KEY,recipient_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,actor_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,kind TEXT NOT NULL,target_id TEXT NOT NULL,event_id TEXT NOT NULL,created_at INTEGER NOT NULL,read_at INTEGER,UNIQUE(recipient_id,kind,event_id));
      CREATE INDEX notifications_recipient ON notifications(recipient_id,created_at DESC);
      CREATE TABLE notification_mutes(user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,kind TEXT NOT NULL,target_id TEXT NOT NULL,PRIMARY KEY(user_id,kind,target_id));
      PRAGMA user_version=18; COMMIT;`);
    if (version < 19)
      this.db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE plaza_posts ADD COLUMN sticker_id TEXT;
      ALTER TABLE plaza_replies ADD COLUMN sticker_id TEXT;
      ALTER TABLE plaza_private_messages ADD COLUMN sticker_id TEXT;
      PRAGMA user_version=19; COMMIT;`);
    if (version < 20)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE plaza_images(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES accounts(id),post_id TEXT UNIQUE REFERENCES plaza_posts(id) ON DELETE CASCADE,reply_id TEXT UNIQUE REFERENCES plaza_replies(id) ON DELETE CASCADE,message_id TEXT UNIQUE REFERENCES plaza_private_messages(id) ON DELETE CASCADE,body BLOB NOT NULL,description TEXT NOT NULL,created_at INTEGER NOT NULL,CHECK((post_id IS NOT NULL)+(reply_id IS NOT NULL)+(message_id IS NOT NULL)=1));
      ALTER TABLE plaza_reports ADD COLUMN evidence_image BLOB;
      PRAGMA user_version=20; COMMIT;`);
    if (version < 21)
      this.db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE plaza_replies ADD COLUMN reply_to TEXT REFERENCES plaza_replies(id) ON DELETE SET NULL;
      PRAGMA user_version=21; COMMIT;`);
    if (version < 22)
      this.db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE plaza_private_messages ADD COLUMN reply_to TEXT REFERENCES plaza_private_messages(id) ON DELETE SET NULL;
      PRAGMA user_version=22; COMMIT;`);
    if (version < 23)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE account_profiles(user_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE, interests_json TEXT NOT NULL, boundaries_json TEXT NOT NULL, availability TEXT NOT NULL);
      CREATE TABLE account_profile_photos(user_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE, id TEXT NOT NULL UNIQUE, body BLOB NOT NULL, declared_at INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE profile_photo_shares(owner_id TEXT NOT NULL REFERENCES account_profile_photos(user_id) ON DELETE CASCADE, connection_id TEXT NOT NULL REFERENCES plaza_connections(id) ON DELETE CASCADE, PRIMARY KEY(owner_id,connection_id));
      PRAGMA user_version=23; COMMIT;`);
    if (version < 24)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS connection_photo_challenges(connection_id TEXT PRIMARY KEY REFERENCES plaza_connections(id) ON DELETE CASCADE, sender_photo TEXT, recipient_photo TEXT, rounds INTEGER NOT NULL DEFAULT 0, first_sender TEXT, unlocked INTEGER NOT NULL DEFAULT 0);
      PRAGMA user_version=24; COMMIT;`);
    if (version < 25) {
      const columns = this.db.prepare("PRAGMA table_info(connection_photo_challenges)").all();
      if (!columns.some(column => column.name === "requested_by")) this.db.exec(`BEGIN IMMEDIATE;
        ALTER TABLE connection_photo_challenges ADD COLUMN requested_by TEXT;
        UPDATE connection_photo_challenges SET requested_by=(SELECT sender_id FROM plaza_connections c WHERE c.id=connection_id);
        PRAGMA user_version=25; COMMIT;`);
      else this.db.exec("PRAGMA user_version=25");
    }
    if (version < 26) this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS connection_dismissals(user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,connection_id TEXT NOT NULL REFERENCES plaza_connections(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,connection_id));
      CREATE TABLE IF NOT EXISTS room_history_dismissals(user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,room_id));
      PRAGMA user_version=26; COMMIT;`);
    if (version < 27) this.transaction(() => {
      installGroupReunionSchema(this.db);
      this.db.exec('PRAGMA user_version=27');
    });
    if (version < 28) this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS private_meetings(meeting_id TEXT PRIMARY KEY REFERENCES scheduled_meetings(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS private_meeting_members(meeting_id TEXT NOT NULL REFERENCES private_meetings(meeting_id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES accounts(id),PRIMARY KEY(meeting_id,user_id));
      PRAGMA user_version=28; COMMIT;`);
    if (version < 29) this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS group_reunion_expirations(reunion_id TEXT NOT NULL,recipient_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expired_at INTEGER NOT NULL,PRIMARY KEY(reunion_id,recipient_id));
      PRAGMA user_version=29; COMMIT;`);
    } catch (error) { this.db.close(); throw error; }
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
  takePrivateLimit(rawKey: string, maximum: number, duration: number, now: number) {
    return this.transaction(() => {
      const key = digest(rawKey);
      const read = this.db.prepare("SELECT count,until_at AS untilAt FROM auth_limits WHERE key=?");
      const old = read.get(rawKey) as {count:number;untilAt:number} | undefined;
      if (old) {
        const current = read.get(key) as {count:number;untilAt:number} | undefined;
        const active = [old,current].filter((row): row is {count:number;untilAt:number} => !!row && row.untilAt > now);
        if (active.length) this.db.prepare("INSERT OR REPLACE INTO auth_limits VALUES(?,?,?)").run(key,active.reduce((n,row)=>n+row.count,0),Math.max(...active.map(row=>row.untilAt)));
        this.db.prepare("DELETE FROM auth_limits WHERE key=?").run(rawKey);
      }
      return this.takeLimit(key,maximum,duration,now);
    });
  }
  block(userId: string, blockedId: string, now=Date.now()) {
    this.transaction(() => {
      const affected=this.db.prepare(`SELECT id FROM group_reunions WHERE status IN ('pending','confirmed') AND id IN (SELECT reunion_id FROM group_reunion_members WHERE user_id=?) AND id IN (SELECT reunion_id FROM group_reunion_members WHERE user_id=?) UNION SELECT m.id FROM scheduled_meetings m JOIN private_meetings p ON p.meeting_id=m.id WHERE m.cancelled_at IS NULL AND m.id IN (SELECT meeting_id FROM private_meeting_members WHERE user_id=?) AND m.id IN (SELECT meeting_id FROM private_meeting_members WHERE user_id=?)`).all(userId,blockedId,userId,blockedId);
      this.db.prepare("INSERT OR IGNORE INTO blocks VALUES(?,?)").run(userId, blockedId);
      this.db.prepare("UPDATE plaza_connections SET status='closed' WHERE status IN ('pending','accepted') AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))").run(userId, blockedId, blockedId, userId);
      this.db.prepare("UPDATE scheduled_meetings SET cancelled_at=?,cancellation_reason='El reencuentro ya no está disponible.' WHERE cancelled_at IS NULL AND id IN (SELECT meeting_id FROM private_meeting_members WHERE user_id=?) AND id IN (SELECT meeting_id FROM private_meeting_members WHERE user_id=?)").run(now,userId,blockedId);
      this.db.prepare("UPDATE group_reunions SET status='cancelled' WHERE status IN ('pending','confirmed') AND id IN (SELECT reunion_id FROM group_reunion_members WHERE user_id=?) AND id IN (SELECT reunion_id FROM group_reunion_members WHERE user_id=?)").run(userId,blockedId);
      for(const row of affected) new Notifications(this,()=>now).groupCancelled(String(row.id));
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
  privateMeetingAccess(activityId:string,userId:string): boolean | null {
    if (!this.db.prepare('SELECT 1 FROM private_meetings WHERE meeting_id=?').get(activityId)) return null;
    return !!this.db.prepare(`SELECT 1 FROM private_meeting_members m WHERE m.meeting_id=? AND m.user_id=? AND NOT EXISTS (SELECT 1 FROM private_meeting_members other JOIN blocks b ON (b.user_id=? AND b.blocked_id=other.user_id) OR (b.blocked_id=? AND b.user_id=other.user_id) WHERE other.meeting_id=m.meeting_id)`).get(activityId,userId,userId,userId);
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
  cancelPrivateMeeting(activityId:string, now:number) {
    const changed=this.db.prepare("UPDATE scheduled_meetings SET cancelled_at=?,cancellation_reason=COALESCE(cancellation_reason,'El reencuentro ya no está disponible.') WHERE id=? AND cancelled_at IS NULL AND EXISTS (SELECT 1 FROM private_meetings WHERE meeting_id=?)").run(now,activityId,activityId);
    this.db.prepare("UPDATE group_reunions SET status='cancelled' WHERE id=? AND status IN ('pending','confirmed')").run(activityId);
    if(changed.changes) new Notifications(this,()=>now).groupCancelled(activityId);
  }
  cancel(userId: string, activityId: string, now=Date.now()) {
    this.transaction(()=>{
      if(this.privateMeetingAccess(activityId,userId)===true) this.cancelPrivateMeeting(activityId,now);
      this.db.prepare("DELETE FROM reservations WHERE user_id=? AND activity_id=?").run(userId, activityId);
    });
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
        "SELECT r.id,r.activity_id AS activityId,r.session_json AS session,r.archived_at AS archivedAt FROM rooms r JOIN memberships m ON m.room_id=r.id WHERE m.user_id=? AND NOT EXISTS (SELECT 1 FROM room_history_dismissals d WHERE d.user_id=m.user_id AND d.room_id=r.id) ORDER BY r.rowid DESC LIMIT 20",
      )
      .all(userId)
      .map((r) => ({
        id: r.id,
        activityId: r.activityId,
        phase: (JSON.parse(r.session as string) as Session).phase,
        archived: r.archivedAt !== null,
      }));
  }
  dismissHistory(userId: string, roomId: string, now: number) {
    return this.transaction(() => {
      const row=this.db.prepare("SELECT r.archived_at FROM rooms r JOIN memberships m ON m.room_id=r.id WHERE r.id=? AND m.user_id=?").get(roomId,userId);
      if (!row) return "not_found";
      if (row.archived_at === null) return "active";
      const affected=this.db.prepare("SELECT r.id FROM group_reunions r JOIN group_reunion_members m ON m.reunion_id=r.id WHERE r.room_id=? AND m.user_id=? AND r.status IN ('pending','confirmed')").all(roomId,userId);
      this.db.prepare("INSERT OR IGNORE INTO room_history_dismissals(user_id,room_id,created_at) VALUES(?,?,?)").run(userId,roomId,now);
      this.db.prepare("DELETE FROM notifications WHERE kind IN ('group_expired','group_cancelled') AND recipient_id=? AND target_id IN (SELECT id FROM group_reunions WHERE room_id=?)").run(userId,roomId);
      this.db.prepare("DELETE FROM group_reunion_expirations WHERE recipient_id=? AND reunion_id IN (SELECT id FROM group_reunions WHERE room_id=?)").run(userId,roomId);
      this.db.prepare("UPDATE scheduled_meetings SET cancelled_at=COALESCE(cancelled_at,?),cancellation_reason=COALESCE(cancellation_reason,'El reencuentro ya no está disponible.') WHERE id IN (SELECT r.id FROM group_reunions r JOIN group_reunion_members m ON m.reunion_id=r.id WHERE r.room_id=? AND m.user_id=?)").run(now,roomId,userId);
      this.db.prepare("UPDATE group_reunions SET status='cancelled' WHERE room_id=? AND status IN ('pending','confirmed') AND id IN (SELECT reunion_id FROM group_reunion_members WHERE user_id=?)").run(roomId,userId);
      for(const affectedRow of affected) new Notifications(this,()=>now).groupCancelled(String(affectedRow.id));
      return "ok";
    });
  }
  historyVisible(userId: string, roomId: string) {
    return this.member(userId,roomId) && !this.db.prepare("SELECT 1 FROM room_history_dismissals WHERE user_id=? AND room_id=?").get(userId,roomId);
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
    this.transaction(()=>{
      const cutoff=now-30*24*60*60_000;
      const pending=this.db.prepare("SELECT g.id FROM group_reunions g JOIN rooms r ON r.id=g.room_id WHERE g.status='pending' AND ((r.archived_at IS NOT NULL AND r.archived_at<?) OR g.starts_at<=?)").all(cutoff,now+5*60_000);
      const expired=this.db.prepare(`INSERT OR IGNORE INTO group_reunion_expirations(reunion_id,recipient_id,expired_at) SELECT g.id,m.user_id,? FROM group_reunions g JOIN group_reunion_members m ON m.reunion_id=g.id WHERE g.id=? AND EXISTS (SELECT 1 FROM memberships p WHERE p.room_id=g.room_id AND p.user_id=m.user_id) AND NOT EXISTS (SELECT 1 FROM room_history_dismissals d WHERE d.room_id=g.room_id AND d.user_id=m.user_id)`);
      for(const row of pending){const id=String(row.id);expired.run(now,id);this.db.prepare("UPDATE group_reunions SET status='cancelled' WHERE id=? AND status='pending'").run(id);new Notifications(this,()=>now).groupExpired(id);}
      this.db.prepare('DELETE FROM rooms WHERE archived_at IS NOT NULL AND archived_at<?').run(cutoff);
      this.db.prepare("DELETE FROM notifications WHERE kind='group_expired' AND EXISTS (SELECT 1 FROM group_reunion_expirations e WHERE e.reunion_id=notifications.target_id AND e.recipient_id=notifications.recipient_id AND e.expired_at<?)").run(cutoff);
      this.db.prepare('DELETE FROM group_reunion_expirations WHERE expired_at<?').run(cutoff);
    });
  }
  close() {
    this.db.close();
  }
}
