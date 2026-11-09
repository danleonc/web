import { randomUUID } from "node:crypto";
import type { Storage } from "./storage.ts";
import { digest } from "./storage.ts";
import { ModerationStore } from "./moderation.ts";
import { validReason } from "../src/safety/rules.ts";

export class PlazaModeration {
  readonly storage: Storage;
  readonly now: () => number;
  readonly moderation: ModerationStore;
  constructor(storage: Storage, now: () => number) {
    this.storage = storage; this.now = now; this.moderation = new ModerationStore(storage, now);
  }
  canReview(userId: string) { return this.moderation.moderator(userId) && !this.moderation.restriction(userId); }
  report(reporter: string, kind: string, contentId: string, reason: string, note: string) {
    if (!["post", "reply"].includes(kind) || !/^[a-f0-9-]{36}$/.test(contentId) || !validReason(reason) || note.length > 500) throw Error("invalid_report");
    const db = this.storage.db;
    const content = kind === "post"
      ? db.prepare("SELECT id,author_id AS authorId,title,body,author_id AS postAuthor FROM plaza_posts WHERE id=? AND hidden=0").get(contentId)
      : db.prepare("SELECT r.id,r.author_id AS authorId,r.body,p.title,p.author_id AS postAuthor FROM plaza_replies r JOIN plaza_posts p ON p.id=r.post_id WHERE r.id=? AND r.hidden=0 AND p.hidden=0").get(contentId);
    if (!content || content.authorId === reporter) throw Error("content_unavailable");
    if (db.prepare("SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id IN (?,?)) OR (blocked_id=? AND user_id IN (?,?))").get(reporter, content.authorId, content.postAuthor, reporter, content.authorId, content.postAuthor)) throw Error("content_unavailable");
    const old = db.prepare("SELECT id FROM plaza_reports WHERE reporter_id=? AND kind=? AND content_id=? AND reason=?").get(reporter, kind, contentId, reason);
    if (old) return old.id as string;
    if (!this.storage.takeLimit(digest(`plaza-reports:${reporter}`), 5, 60 * 60_000, this.now())) throw Error("rate_limit");
    if (Number(db.prepare("SELECT COUNT(*) AS n FROM plaza_reports").get()!.n) >= 5000) throw Error("queue_full");
    const id = randomUUID();
    db.prepare("INSERT INTO plaza_reports(id,reporter_id,target_id,kind,content_id,reason,note,evidence_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(id, reporter, content.authorId, kind, contentId, reason, note.trim(), JSON.stringify({ title: content.title, body: content.body }), this.now());
    return id;
  }
  reports(userId: string) {
    if (!this.canReview(userId)) throw Error("moderator_required");
    return this.storage.db.prepare(`SELECT r.id,r.kind,r.content_id AS contentId,r.reason,r.note,r.status,r.evidence_json AS evidence,r.created_at AS createdAt,a.alias AS target
      FROM plaza_reports r JOIN accounts a ON a.id=r.target_id ORDER BY (r.status='open') DESC,r.created_at DESC LIMIT 50`).all()
      .map((row) => ({ ...row, evidence: JSON.parse(String(row.evidence)) }));
  }
  decide(userId: string, reportId: string, action: string, reason: string) {
    if (!this.canReview(userId) || !["hide", "dismiss"].includes(action) || reason.trim().length < 5 || reason.length > 500) throw Error("invalid_decision");
    const db = this.storage.db;
    this.storage.transaction(() => {
      const report = db.prepare("SELECT * FROM plaza_reports WHERE id=? AND status='open'").get(reportId);
      if (!report || report.target_id === userId || this.moderation.moderator(String(report.target_id))) throw Error("report_unavailable");
      if (action === "hide") {
        const table = report.kind === "post" ? "plaza_posts" : "plaza_replies";
        db.prepare(`UPDATE ${table} SET hidden=1 WHERE id=?`).run(report.content_id);
      }
      db.prepare("INSERT INTO plaza_moderation_actions VALUES(?,?,?,?,?,?)").run(randomUUID(), reportId, userId, action, reason.trim(), this.now());
      db.prepare("UPDATE plaza_reports SET status='resolved' WHERE id=?").run(reportId);
    });
  }
}
