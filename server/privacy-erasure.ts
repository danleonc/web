import { randomUUID } from "node:crypto";
import type { Storage } from "./storage.ts";
import { digest } from "./storage.ts";

// Pinned to the v17 tables, columns and foreign keys; schema changes require review.
const supportedSchema = "5bb377a0d95093b5bf310705f67ea3e5577ca4ebee5039f3922dbddf57597dd6";
function schemaFingerprint(storage: Storage) {
  const db = storage.db;
  const names = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const schema = names.map((row) => ({ name: String(row.name), columns: db.prepare('SELECT name,type,"notnull",dflt_value,pk,hidden FROM pragma_table_xinfo(?) ORDER BY cid').all(String(row.name)), foreign: db.prepare('SELECT "table","from","to",on_update,on_delete,"match" FROM pragma_foreign_key_list(?) ORDER BY "table","from","to"').all(String(row.name)) }));
  return digest(JSON.stringify(schema));
}

// Conservative, test-only logical removal from the active database; never covers backups.
export function eraseEmptyAccount(storage: Storage, target: string, actor: string, version: number, sessionHash: string | null, now: number, isLive: (id: string) => boolean) {
  const db = storage.db;
  return storage.transaction(() => {
    const operator = db.prepare("SELECT 1 FROM privacy_operators WHERE user_id=?").get(actor);
    const restricted = db.prepare("SELECT 1 FROM restrictions WHERE user_id=? AND (until_at IS NULL OR until_at>?)").get(actor, now);
    const session = sessionHash ? storage.session(sessionHash, now) : undefined;
    if (!operator || !storage.canParticipate(actor) || restricted || !session || session.id !== actor || session.expires < now + 230 * 60_000) return { error: "recent_auth_required" } as const;
    const request = db.prepare("SELECT status,version FROM privacy_requests WHERE user_id=?").get(target);
    if (!request || request.status !== "seen" || Number(request.version) !== version) return { error: "request_changed" } as const;
    const triggers = db.prepare("SELECT 1 FROM sqlite_schema WHERE type='trigger' UNION ALL SELECT 1 FROM sqlite_temp_schema WHERE type='trigger' LIMIT 1").get();
    const attached = db.prepare("PRAGMA database_list").all().some((row) => row.name !== "main" && row.name !== "temp");
    if (Number(db.prepare("PRAGMA user_version").get()!.user_version) !== 17 || triggers || attached || schemaFingerprint(storage) !== supportedSchema) return { error: "manual_review_required" } as const;
    if (target === actor || isLive(target)) return { error: "manual_review_required" } as const;
    const account = db.prepare("SELECT a.username,a.alias,e.email FROM accounts a LEFT JOIN account_emails e ON e.user_id=a.id WHERE a.id=?").get(target);
    if (!account) return { error: "request_changed" } as const;
    if (db.prepare("SELECT 1 FROM account_google WHERE user_id=?").get(target) || db.prepare("SELECT 1 FROM google_flows WHERE expires_at>? LIMIT 1").get(now)) return { error: "manual_review_required" } as const;

    // Unknown future relations fail closed rather than being silently cascaded.
    const safe = new Set(["account_emails.user_id", "sessions.user_id", "push_subscriptions.user_id", "privacy_requests.user_id", "privacy_request_events.user_id"]);
    const known = new Set(["accounts", "sessions", "blocks", "offerings", "reservations", "rooms", "memberships", "messages", "receipts", "auth_limits", "moderators", "reports", "moderation_actions", "restrictions", "appeals", "media", "account_emails", "account_google", "google_flows", "push_subscriptions", "plaza_posts", "plaza_replies", "plaza_reports", "plaza_moderation_actions", "plaza_appeals", "plaza_appeal_actions", "plaza_connections", "plaza_private_messages", "scheduled_meetings", "push_queue", "push_private_queue", "privacy_operators", "privacy_requests", "privacy_request_events", "privacy_erasure_receipts", "privacy_erasure_events"]);
    const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    for (const row of tables) {
      const table = String(row.name); if (!known.has(table) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) return { error: "manual_review_required" } as const;
      const keys = db.prepare("SELECT \"table\",\"from\" FROM pragma_foreign_key_list(?)").all(table);
      for (const key of keys) {
        if (key.table !== "accounts") continue;
        const column = String(key.from); if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) return { error: "manual_review_required" } as const;
        if (safe.has(`${table}.${column}`)) continue;
        const sql = table === "privacy_request_events" && column === "actor_id" ? `SELECT 1 FROM "${table}" WHERE "${column}"=? AND user_id<>? LIMIT 1` : `SELECT 1 FROM "${table}" WHERE "${column}"=? LIMIT 1`;
        if (db.prepare(sql).get(...(table === "privacy_request_events" && column === "actor_id" ? [target, target] : [target]))) return { error: "manual_review_required" } as const;
      }
    }
    if (db.prepare("SELECT 1 FROM plaza_connections WHERE low_id=? OR high_id=? LIMIT 1").get(target, target)) return { error: "manual_review_required" } as const;
    const scans: [string, string[]][] = [
      ["rooms", ["session_json", "safety_json"]], ["messages", ["payload"]], ["plaza_posts", ["title", "body"]], ["plaza_replies", ["body"]], ["plaza_private_messages", ["body"]], ["reports", ["note", "evidence_json"]], ["plaza_reports", ["note", "evidence_json"]], ["appeals", ["note", "review_note"]], ["plaza_appeals", ["note"]], ["moderation_actions", ["reason"]], ["plaza_moderation_actions", ["reason"]], ["plaza_appeal_actions", ["note"]],
    ];
    const identifiers = [...new Set([target, String(account.username), String(account.alias), account.email ? String(account.email) : ""].filter(Boolean))];
    for (const [table, columns] of scans) for (const column of columns) for (const value of identifiers) {
      if (db.prepare(`SELECT 1 FROM "${table}" WHERE instr(lower("${column}"),lower(?))>0 LIMIT 1`).get(value)) return { error: "manual_review_required" } as const;
    }
    const receiptId = randomUUID();
    db.prepare("INSERT INTO privacy_erasure_receipts(id,subject_hash,operator_id,completed_at,request_version) VALUES(?,?,?,?,?)").run(receiptId, digest(`privacy-erasure:${target}`), actor, now, version);
    db.prepare("INSERT INTO privacy_erasure_events(receipt_id,version,action,actor_id,created_at) SELECT ?,version,action,CASE WHEN actor_id=? THEN NULL ELSE actor_id END,created_at FROM privacy_request_events WHERE user_id=?").run(receiptId, target, target);
    db.prepare("DELETE FROM google_flows WHERE account_id=? OR session_hash IN (SELECT token_hash FROM sessions WHERE user_id=?)").run(target, target);
    db.prepare("DELETE FROM push_queue WHERE user_id=?").run(target);
    db.prepare("DELETE FROM push_private_queue WHERE user_id=?").run(target);
    db.prepare("DELETE FROM push_subscriptions WHERE user_id=?").run(target);
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(target);
    db.prepare("DELETE FROM account_google WHERE user_id=?").run(target);
    db.prepare("DELETE FROM account_emails WHERE user_id=?").run(target);
    const limits = [digest(`user:${String(account.username)}`), digest(`mail-user:${target}`), digest(`plaza-invitations:${target}`), digest(`plaza-private:${target}`), digest(`plaza-reports:${target}`), digest(`images:${target}`), digest(`reports:${target}`), `push-sub:${target}`, `push-test:${target}`];
    const removeLimit = db.prepare("DELETE FROM auth_limits WHERE key=?"); for (const key of limits) removeLimit.run(key);
    db.prepare("DELETE FROM privacy_request_events WHERE user_id=?").run(target);
    db.prepare("DELETE FROM privacy_requests WHERE user_id=?").run(target);
    db.prepare("DELETE FROM accounts WHERE id=?").run(target);
    return { receiptId } as const;
  });
}
