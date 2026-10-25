import { randomUUID } from "node:crypto";
import type { Storage } from "./storage.ts";
import { digest } from "./storage.ts";
import { applyExpulsions, removeByModerator } from "../src/safety/rules.ts";
import { sessionReducer } from "../src/room/engine.ts";
import type { ConductReason } from "../src/safety/rules.ts";
export type Restriction = {
  kind: "suspend" | "ban";
  reason: string;
  until: number | null;
  actionId: string;
};
export class ModerationStore {
  readonly storage: Storage;
  readonly now: () => number;
  constructor(storage: Storage, now: () => number) {
    this.storage = storage;
    this.now = now;
  }
  moderator(id: string) {
    return !!this.storage.db
      .prepare("SELECT 1 FROM moderators WHERE user_id=?")
      .get(id);
  }
  hasModerators() {
    return !!this.storage.db.prepare("SELECT 1 FROM moderators LIMIT 1").get();
  }
  restriction(id: string): Restriction | null {
    return (
      (this.storage.db
        .prepare(
          "SELECT kind,reason,until_at AS until,action_id AS actionId FROM restrictions WHERE user_id=? AND (until_at IS NULL OR until_at>?)",
        )
        .get(id, this.now()) as Restriction | undefined) || null
    );
  }
  role(username: string, enabled: boolean) {
    const account = this.storage.account(username.toLowerCase());
    if (!account) throw Error("Account not found");
    if (enabled)
      this.storage.db
        .prepare("INSERT OR IGNORE INTO moderators VALUES(?)")
        .run(account.id);
    else
      this.storage.db
        .prepare("DELETE FROM moderators WHERE user_id=?")
        .run(account.id);
  }
  report(
    roomId: string,
    reporter: string,
    target: string,
    reason: ConductReason,
    note: string,
    messageId: string,
    evidence: unknown,
    imageId: string | null,
  ) {
    const old = this.storage.db
      .prepare(
        "SELECT id FROM reports WHERE reporter_id=? AND room_id=? AND target_id=? AND reason=? AND message_id=?",
      )
      .get(reporter, roomId, target, reason, messageId);
    if (old) return old.id as string;
    if (
      !this.storage.takeLimit(
        digest(`reports:${reporter}`),
        5,
        60 * 60_000,
        this.now(),
      )
    )
      throw Error("Espera antes de registrar otro reporte.");
    const count = this.storage.db
      .prepare("SELECT COUNT(*) AS n FROM reports")
      .get()!.n as number;
    if (count >= 5000)
      throw Error("La cola de reportes está llena. No se pudo guardar.");
    const id = randomUUID();
    this.storage.db
      .prepare(
        "INSERT INTO reports(id,room_id,reporter_id,target_id,reason,note,message_id,evidence_json,image_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        roomId,
        reporter,
        target,
        reason,
        note,
        messageId,
        JSON.stringify(evidence),
        imageId,
        this.now(),
      );
    return id;
  }
  reports() {
    return this.storage.db
      .prepare(
        "SELECT r.id,r.room_id AS roomId,r.target_id AS targetId,r.reason,r.note,r.status,r.resolution,r.evidence_json AS evidence,r.image_id AS imageId,r.created_at AS createdAt,a.alias AS target FROM reports r JOIN accounts a ON a.id=r.target_id ORDER BY (r.status='open') DESC,r.created_at DESC LIMIT 50",
      )
      .all()
      .map((r) => ({ ...r, evidence: JSON.parse(r.evidence as string) }));
  }
  decide(
    moderatorId: string,
    reportId: string,
    kind: string,
    reason: string,
    hours: number,
  ) {
    if (!this.moderator(moderatorId) || this.restriction(moderatorId))
      throw Error("Se requiere moderación.");
    const report = this.storage.db
      .prepare("SELECT * FROM reports WHERE id=?")
      .get(reportId);
    if (!report) throw Error("Reporte no encontrado.");
    if (report.status !== "open")
      throw Error("Este reporte ya tiene una decisión.");
    const target = report.target_id as string;
    if (target === moderatorId || this.moderator(target))
      throw Error(
        "Esta decisión requiere intervención del responsable del servicio.",
      );
    if (kind === "hide-image" && !report.image_id)
      throw Error("El reporte no contiene una imagen.");
    const id = randomUUID();
    const until = kind === "suspend" ? this.now() + hours * 60 * 60_000 : null;
    this.storage.transaction(() => {
      this.storage.db
        .prepare("INSERT INTO moderation_actions VALUES(?,?,?,?,?,?,?,?)")
        .run(
          id,
          target,
          moderatorId,
          reportId,
          kind,
          reason,
          until,
          this.now(),
        );
      if (kind === "suspend" || kind === "ban")
        this.storage.db
          .prepare("INSERT OR REPLACE INTO restrictions VALUES(?,?,?,?,?)")
          .run(target, kind, reason, until, id);
      if (kind === "remove-room") {
        const room = this.storage
          .loadRooms()
          .find((r) => r.key === report.room_id);
        if (room) {
          room.safety = removeByModerator(room.safety, target);
          room.session = sessionReducer(
            applyExpulsions(room.session, room.safety),
            { type: "tick", now: this.now() },
          );
          this.storage.db
            .prepare("UPDATE rooms SET session_json=?,safety_json=? WHERE id=?")
            .run(
              JSON.stringify(room.session),
              JSON.stringify(room.safety),
              room.key,
            );
          this.storage.db
            .prepare("DELETE FROM memberships WHERE room_id=? AND user_id=?")
            .run(room.key, target);
        }
      }
      if (kind === "hide-image")
        this.storage.db
          .prepare("UPDATE media SET hidden=1 WHERE id=?")
          .run(report.image_id);
      this.storage.db
        .prepare("UPDATE reports SET status='resolved',resolution=? WHERE id=?")
        .run(`${kind}: ${reason}`, reportId);
    });
    return {
      target,
      roomId: report.room_id as string,
      imageId: report.image_id as string | null,
    };
  }
  appeals(id?: string) {
    return id
      ? this.storage.db
          .prepare(
            "SELECT id,action_id AS actionId,note,status,review_note AS reviewNote FROM appeals WHERE user_id=? ORDER BY created_at DESC LIMIT 10",
          )
          .all(id)
      : this.storage.db
          .prepare(
            "SELECT p.id,p.user_id AS userId,p.action_id AS actionId,p.note,p.status,a.alias AS name,m.kind AS originalKind,m.reason AS originalReason FROM appeals p JOIN accounts a ON a.id=p.user_id JOIN moderation_actions m ON m.id=p.action_id ORDER BY (p.status='pending') DESC,p.created_at DESC LIMIT 50",
          )
          .all();
  }
  appeal(id: string, note: string) {
    const restriction = this.restriction(id);
    if (!restriction) throw Error("No hay una restricción vigente que apelar.");
    const old = this.storage.db
      .prepare("SELECT id FROM appeals WHERE user_id=? AND action_id=?")
      .get(id, restriction.actionId);
    if (old) return old.id;
    const appealId = randomUUID();
    this.storage.db
      .prepare(
        "INSERT INTO appeals(id,user_id,action_id,note,created_at) VALUES(?,?,?,?,?)",
      )
      .run(appealId, id, restriction.actionId, note, this.now());
    return appealId;
  }
  reviewAppeal(actor: string, id: string, restore: boolean, note: string) {
    if (!this.moderator(actor) || this.restriction(actor))
      throw Error("Se requiere moderación.");
    const appeal = this.storage.db
      .prepare("SELECT * FROM appeals WHERE id=?")
      .get(id);
    if (!appeal || appeal.status !== "pending")
      throw Error("Apelación no disponible.");
    if (
      restore &&
      this.restriction(appeal.user_id as string)?.actionId !== appeal.action_id
    )
      throw Error(
        "La restricción cambió o ya terminó; no se puede restaurar desde esta apelación.",
      );
    if (appeal.user_id === actor)
      throw Error("No puedes revisar tu propia apelación.");
    this.storage.transaction(() => {
      if (restore)
        this.storage.db
          .prepare("DELETE FROM restrictions WHERE user_id=? AND action_id=?")
          .run(appeal.user_id, appeal.action_id);
      this.storage.db
        .prepare("UPDATE appeals SET status=?,review_note=? WHERE id=?")
        .run(restore ? "restored" : "upheld", note, id);
      this.storage.db
        .prepare("INSERT INTO moderation_actions VALUES(?,?,?,?,?,?,?,?)")
        .run(
          randomUUID(),
          appeal.user_id,
          actor,
          null,
          restore ? "appeal-restore" : "appeal-uphold",
          note,
          null,
          this.now(),
        );
    });
  }
  media(id: string) {
    return this.storage.db.prepare("SELECT * FROM media WHERE id=?").get(id);
  }
  hiddenImages(roomId: string) {
    return (
      this.storage.db
        .prepare("SELECT id FROM media WHERE room_id=? AND hidden=1")
        .all(roomId) as { id: string }[]
    ).map((r) => r.id);
  }
  reviewMedia(id: string) {
    return !!this.storage.db
      .prepare("SELECT 1 FROM reports WHERE image_id=?")
      .get(id);
  }
}
