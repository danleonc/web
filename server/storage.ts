import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import type { Session } from "../src/room/engine.ts";
import type { SharedMessage } from "../src/shared/protocol.ts";

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
    if (version !== 0 && version !== 1)
      throw new Error("Unsupported database version");
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
    this.db.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash);
  }
  recover(id: string, passwordHash: string, recoveryHash: string) {
    this.transaction(() => {
      this.db
        .prepare(
          "UPDATE accounts SET password_hash=?,recovery_hash=? WHERE id=?",
        )
        .run(passwordHash, recoveryHash, id);
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
    this.db
      .prepare("INSERT OR IGNORE INTO blocks VALUES(?,?)")
      .run(userId, blockedId);
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
  ): "ok" | "full" | "conflict" | "closed" {
    return this.transaction(() => {
      if (this.reserved(userId, activityId)) return "ok";
      if (now >= this.startsAt(activityId)) return "closed";
      if (
        this.db
          .prepare(
            "SELECT 1 FROM reservations r JOIN offerings a ON a.activity_id=r.activity_id WHERE r.user_id=? AND a.starts_at=?",
          )
          .get(userId, this.startsAt(activityId))
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
          "INSERT INTO rooms VALUES(?,?,?,?,?,NULL) ON CONFLICT(id) DO UPDATE SET session_json=excluded.session_json,revision=excluded.revision,idle_at=excluded.idle_at",
        )
        .run(
          room.key,
          room.activityId,
          JSON.stringify(room.session),
          room.revision,
          room.idleAt,
        );
      // A visitor who leaves reception must not retain access to the later group.
      // After a meeting starts, disconnected members remain in its roster.
      this.db.prepare("DELETE FROM memberships WHERE room_id=?").run(room.key);
      const member = this.db.prepare(
        "INSERT OR IGNORE INTO memberships VALUES(?,?)",
      );
      for (const p of room.session.participants) member.run(room.key, p.id);
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
    this.db.prepare("DELETE FROM auth_limits WHERE until_at<=?").run(now);
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
