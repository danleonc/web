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
    if (!["post", "reply", "private", "profile_photo"].includes(kind) || !/^[a-f0-9-]{36}$/.test(contentId) || !validReason(reason) || note.length > 500) throw Error("invalid_report");
    const db = this.storage.db;
    const content = kind === "post"
      ? db.prepare("SELECT id,author_id AS authorId,title,body,sticker_id AS stickerId,author_id AS postAuthor FROM plaza_posts WHERE id=? AND hidden=0").get(contentId)
      : kind === "reply"
        ? db.prepare("SELECT r.id,r.author_id AS authorId,r.body,r.sticker_id AS stickerId,p.title,p.author_id AS postAuthor FROM plaza_replies r JOIN plaza_posts p ON p.id=r.post_id WHERE r.id=? AND r.hidden=0 AND p.hidden=0").get(contentId)
        : kind === 'profile_photo'
          ? db.prepare("SELECT p.id,p.user_id AS authorId,'' AS body,'' AS stickerId,'Foto de perfil' AS title,p.user_id AS postAuthor FROM account_profile_photos p JOIN profile_photo_shares s ON s.owner_id=p.user_id JOIN plaza_connections c ON c.id=s.connection_id WHERE p.id=? AND p.hidden=0 AND c.status='accepted' AND (c.sender_id=? OR c.recipient_id=?) AND p.user_id<>?").get(contentId,reporter,reporter,reporter)
          : db.prepare("SELECT m.id,m.sender_id AS authorId,m.body,m.sticker_id AS stickerId,'Mensaje privado' AS title,m.sender_id AS postAuthor FROM plaza_private_messages m JOIN plaza_connections c ON c.id=m.connection_id WHERE m.id=? AND m.hidden=0 AND c.status='accepted' AND (c.sender_id=? OR c.recipient_id=?)").get(contentId, reporter, reporter);
    if (!content || content.authorId === reporter) throw Error("content_unavailable");
    if (db.prepare("SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id IN (?,?)) OR (blocked_id=? AND user_id IN (?,?))").get(reporter, content.authorId, content.postAuthor, reporter, content.authorId, content.postAuthor)) throw Error("content_unavailable");
    const old = db.prepare("SELECT id FROM plaza_reports WHERE reporter_id=? AND kind=? AND content_id=? AND reason=?").get(reporter, kind, contentId, reason);
    if (old) return old.id as string;
    if (!this.storage.takeLimit(digest(`plaza-reports:${reporter}`), 5, 60 * 60_000, this.now())) throw Error("rate_limit");
    if (Number(db.prepare("SELECT COUNT(*) AS n FROM plaza_reports").get()!.n) >= 5000) throw Error("queue_full");
    const id = randomUUID();
    const image = kind === 'profile_photo' ? db.prepare('SELECT body FROM account_profile_photos WHERE id=?').get(contentId) : db.prepare(`SELECT body FROM plaza_images WHERE ${kind === "post" ? "post_id" : kind === "reply" ? "reply_id" : "message_id"}=?`).get(contentId);
    db.prepare("INSERT INTO plaza_reports(id,reporter_id,target_id,kind,content_id,reason,note,evidence_json,created_at,evidence_image) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(id, reporter, content.authorId, kind, contentId, reason, note.trim(), JSON.stringify({ title: content.title, body: content.body, stickerId: content.stickerId }), this.now(), image?.body || null);
    return id;
  }
  reports(userId: string) {
    if (!this.canReview(userId)) throw Error("moderator_required");
    return this.storage.db.prepare(`SELECT r.id,r.kind,r.content_id AS contentId,r.reason,r.note,r.status,r.evidence_json AS evidence,(r.evidence_image IS NOT NULL) AS hasImage,r.created_at AS createdAt,a.alias AS target
      FROM plaza_reports r JOIN accounts a ON a.id=r.target_id ORDER BY (r.status='open') DESC,r.created_at DESC LIMIT 50`).all()
      .map((row) => ({ ...row, evidence: JSON.parse(String(row.evidence)) }));
  }
  myActions(userId: string) {
    return this.storage.db.prepare(`SELECT r.id AS reportId,r.kind,r.content_id AS contentId,r.evidence_json AS evidence,a.reason AS decisionReason,a.created_at AS decidedAt,p.id AS appealId,p.status AS appealStatus
      FROM plaza_reports r JOIN plaza_moderation_actions a ON a.report_id=r.id LEFT JOIN plaza_appeals p ON p.report_id=r.id
      WHERE r.target_id=? AND a.action='hide' ORDER BY a.created_at DESC LIMIT 50`).all(userId)
      .map((row) => ({ ...row, evidence: JSON.parse(String(row.evidence)) }));
  }
  appeal(userId: string, reportId: string, note: string) {
    if (!/^[a-f0-9-]{36}$/.test(reportId) || note.trim().length < 5 || note.length > 1000) throw Error("invalid_appeal");
    const db = this.storage.db;
    const report = db.prepare("SELECT r.id FROM plaza_reports r JOIN plaza_moderation_actions a ON a.report_id=r.id WHERE r.id=? AND r.target_id=? AND a.action='hide'").get(reportId, userId);
    if (!report || db.prepare("SELECT 1 FROM plaza_appeals WHERE report_id=?").get(reportId)) throw Error("appeal_unavailable");
    const id = randomUUID();
    db.prepare("INSERT INTO plaza_appeals(id,report_id,user_id,note,created_at) VALUES(?,?,?,?,?)").run(id, reportId, userId, note.trim(), this.now());
    return id;
  }
  appeals(userId: string) {
    if (!this.canReview(userId)) throw Error("moderator_required");
    return this.storage.db.prepare(`SELECT p.id,p.report_id AS reportId,p.note,p.status,p.created_at AS createdAt,r.evidence_json AS evidence,a.alias AS author
      FROM plaza_appeals p JOIN plaza_reports r ON r.id=p.report_id JOIN accounts a ON a.id=p.user_id ORDER BY (p.status='pending') DESC,p.created_at DESC LIMIT 50`).all()
      .map((row) => ({ ...row, evidence: JSON.parse(String(row.evidence)) }));
  }
  reviewAppeal(userId: string, id: string, decision: string, note: string) {
    if (!this.canReview(userId) || !["restore", "uphold"].includes(decision) || note.trim().length < 5 || note.length > 1000) throw Error("invalid_review");
    const db = this.storage.db;
    this.storage.transaction(() => {
      const appeal = db.prepare(`SELECT p.id,p.report_id,p.user_id,r.kind,r.content_id,a.moderator_id AS original_moderator
        FROM plaza_appeals p JOIN plaza_reports r ON r.id=p.report_id JOIN plaza_moderation_actions a ON a.report_id=r.id AND a.action='hide'
        WHERE p.id=? AND p.status='pending'`).get(id);
      if (!appeal || appeal.user_id === userId || appeal.original_moderator === userId) throw Error("appeal_unavailable");
      if (decision === "restore") {
        const table = appeal.kind === "post" ? "plaza_posts" : appeal.kind === "reply" ? "plaza_replies" : appeal.kind === 'profile_photo' ? 'account_profile_photos' : "plaza_private_messages";
        if (!db.prepare(`SELECT 1 FROM ${table} WHERE id=?`).get(appeal.content_id)) throw Error("content_removed");
        const remaining = db.prepare(`SELECT COUNT(*) AS n FROM plaza_moderation_actions a JOIN plaza_reports r ON r.id=a.report_id
          LEFT JOIN plaza_appeals p ON p.report_id=r.id WHERE a.action='hide' AND r.kind=? AND r.content_id=? AND r.id<>? AND (p.status IS NULL OR p.status<>'restored')`).get(appeal.kind, appeal.content_id, appeal.report_id);
        if (Number(remaining?.n) === 0) db.prepare(`UPDATE ${table} SET hidden=0 WHERE id=?`).run(appeal.content_id);
      }
      db.prepare("INSERT INTO plaza_appeal_actions VALUES(?,?,?,?,?,?)").run(randomUUID(), id, userId, decision, note.trim(), this.now());
      db.prepare("UPDATE plaza_appeals SET status=? WHERE id=?").run(decision === "restore" ? "restored" : "upheld", id);
    });
  }
  decide(userId: string, reportId: string, action: string, reason: string) {
    if (!this.canReview(userId) || !["hide", "dismiss"].includes(action) || reason.trim().length < 5 || reason.length > 500) throw Error("invalid_decision");
    const db = this.storage.db;
    this.storage.transaction(() => {
      const report = db.prepare("SELECT * FROM plaza_reports WHERE id=? AND status='open'").get(reportId);
      if (!report || report.target_id === userId || this.moderation.moderator(String(report.target_id))) throw Error("report_unavailable");
      if (action === "hide") {
        const table = report.kind === "post" ? "plaza_posts" : report.kind === "reply" ? "plaza_replies" : report.kind === 'profile_photo' ? 'account_profile_photos' : "plaza_private_messages";
        db.prepare(`UPDATE ${table} SET hidden=1 WHERE id=?`).run(report.content_id);
      }
      db.prepare("INSERT INTO plaza_moderation_actions VALUES(?,?,?,?,?,?)").run(randomUUID(), reportId, userId, action, reason.trim(), this.now());
      db.prepare("UPDATE plaza_reports SET status='resolved' WHERE id=?").run(reportId);
    });
  }
}
