import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { Storage, StoredRoom } from "./storage.ts";
import { digest } from "./storage.ts";
import { ModerationStore } from "./moderation.ts";
import { normalizeUpload } from "./images.ts";
import { canChat } from "../src/room/engine.ts";
import { validReason } from "../src/safety/rules.ts";
type Actor = { id: string; blocks: Set<string> };
type Context = {
  storage: Storage | null;
  moderation: ModerationStore | null;
  now: () => number;
  rooms: Map<string, StoredRoom>;
  validOrigin: (req: IncomingMessage) => boolean;
  tokenHash: (req: IncomingMessage) => string | null;
  isPresent: (room: StoredRoom, id: string) => boolean;
  blocked: (sender: string, viewer: string) => boolean;
  advance: (room: StoredRoom) => void;
  onDecision: (roomId: string, target: string, kind: string) => void;
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));
function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(body));
}
async function readJson(req: IncomingMessage) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw Error("Se requiere JSON.");
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw Error("Solicitud demasiado grande.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
export async function handleFeatures(
  ctx: Context,
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  actor: Actor | null,
): Promise<boolean> {
  const { storage, moderation, now, rooms } = ctx;
  if (!storage || !moderation) return false;
  if (path.startsWith("/api/moderation/") || path === "/api/appeals") {
    if (!actor) {
      json(res, 401, { error: "session_required" });
      return true;
    }
    if (
      path.startsWith("/api/moderation/") &&
      (!moderation.moderator(actor.id) || moderation.restriction(actor.id))
    ) {
      json(res, 403, { error: "moderator_required" });
      return true;
    }
    if (req.method === "GET") {
      if (path === "/api/moderation/reports")
        json(res, 200, { reports: moderation.reports() });
      else if (path === "/api/moderation/appeals")
        json(res, 200, { appeals: moderation.appeals() });
      else if (path === "/api/appeals")
        json(res, 200, { appeals: moderation.appeals(actor.id) });
      else json(res, 404, { error: "not_found" });
      return true;
    }
    if (req.method !== "POST" || !ctx.validOrigin(req)) {
      json(res, 403, { error: "origin_rejected" });
      return true;
    }
    try {
      const v = await readJson(req);
      if (!record(v)) throw Error("Solicitud no válida.");
      if (path === "/api/appeals") {
        if (
          !keys(v, ["note"]) ||
          typeof v.note !== "string" ||
          v.note.trim().length < 5 ||
          v.note.length > 1000
        )
          throw Error("Describe tu apelación en 5–1000 caracteres.");
        json(res, 200, { id: moderation.appeal(actor.id, v.note.trim()) });
        return true;
      }
      if (path === "/api/moderation/actions") {
        if (
          !keys(v, ["reportId", "action", "reason", "hours"]) ||
          typeof v.reportId !== "string" ||
          typeof v.action !== "string" ||
          !["dismiss", "hide-image", "remove-room", "suspend", "ban"].includes(
            v.action,
          ) ||
          typeof v.reason !== "string" ||
          v.reason.trim().length < 5 ||
          v.reason.length > 500 ||
          (v.hours !== undefined &&
            (!Number.isInteger(v.hours) ||
              Number(v.hours) < 1 ||
              Number(v.hours) > 168))
        )
          throw Error("Elige una acción y justifica la decisión.");
        const decision = moderation.decide(
          actor.id,
          v.reportId,
          v.action,
          v.reason.trim(),
          Number(v.hours || 24),
        );
        ctx.onDecision(decision.roomId, decision.target, v.action);
        json(res, 200, { ok: true });
        return true;
      }
      if (path === "/api/moderation/appeals") {
        if (
          !keys(v, ["id", "decision", "note"]) ||
          typeof v.id !== "string" ||
          !["restore", "uphold"].includes(String(v.decision)) ||
          typeof v.note !== "string" ||
          v.note.trim().length < 5 ||
          v.note.length > 500
        )
          throw Error("Justifica la revisión de la apelación.");
        moderation.reviewAppeal(
          actor.id,
          v.id,
          v.decision === "restore",
          v.note.trim(),
        );
        json(res, 200, { ok: true });
        return true;
      }
      json(res, 404, { error: "not_found" });
    } catch (e) {
      json(res, 422, {
        error: "moderation_action_failed",
        message: e instanceof Error ? e.message : "No se pudo completar.",
      });
    }
    return true;
  }
  if (
    actor &&
    moderation.restriction(actor.id) &&
    path !== "/api/session" &&
    !path.startsWith("/api/auth/")
  ) {
    req.resume();
    json(res, 403, { error: "account_restricted" });
    return true;
  }
  const media = path.match(/^\/api\/media\/([a-f0-9-]{36})$/);
  if (media && req.method === "GET") {
    if (!actor) {
      json(res, 401, { error: "session_required" });
      return true;
    }
    const asset = moderation.media(media[1]);
    const review =
      moderation.moderator(actor.id) && moderation.reviewMedia(media[1]);
    if (
      !asset ||
      (!review &&
        (!storage.member(actor.id, asset.room_id as string) ||
          asset.hidden ||
          actor.blocks.has(asset.owner_id as string) ||
          ctx.blocked(asset.owner_id as string, actor.id)))
    ) {
      json(res, 404, { error: "not_found" });
      return true;
    }
    res.writeHead(200, {
      "Content-Type": "image/webp",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": 'inline; filename="afinia-imagen.webp"',
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    res.end(Buffer.from(asset.body as Uint8Array));
    return true;
  }
  const action = path.match(/^\/api\/rooms\/([a-f0-9-]{36})\/(reports|media)$/);
  if (action && req.method === "POST") {
    if (!actor) {
      req.resume();
      json(res, 401, { error: "session_required" });
      return true;
    }
    if (!ctx.validOrigin(req)) {
      req.resume();
      json(res, 403, { error: "origin_rejected" });
      return true;
    }
    const room = [...rooms.values()].find((r) => r.key === action[1]);
    if (!room || !room.session.participants.some((p) => p.id === actor.id)) {
      req.resume();
      json(res, 404, { error: "not_found" });
      return true;
    }
    try {
      if (action[2] === "reports") {
        const v = await readJson(req);
        if (
          !record(v) ||
          !keys(v, ["targetId", "reason", "note", "messageId"]) ||
          typeof v.targetId !== "string" ||
          v.targetId === actor.id ||
          !room.session.participants.some((p) => p.id === v.targetId) ||
          !validReason(v.reason) ||
          typeof v.note !== "string" ||
          v.note.length > 500 ||
          (v.messageId !== undefined && typeof v.messageId !== "string")
        )
          throw Error("Reporte no válido.");
        const message =
          typeof v.messageId === "string"
            ? room.messages.find(
                (m) => m.id === v.messageId && m.senderId === v.targetId,
              )
            : undefined;
        if (v.messageId && !message)
          throw Error("El mensaje no pertenece al participante señalado.");
        const id = moderation.report(
          room.key,
          actor.id,
          v.targetId,
          v.reason,
          v.note.trim(),
          String(v.messageId || ""),
          message || { kind: "conduct" },
          message?.type === "image" ? message.image.id : null,
        );
        json(res, 201, { id });
        return true;
      }
      ctx.advance(room);
      if (!moderation.hasModerators()) {
        req.resume();
        json(res, 503, {
          error: "images_unavailable",
          message: "Las imágenes aún no están habilitadas en este piloto.",
        });
        return true;
      }
      if (
        !canChat(room.session) ||
        !ctx.isPresent(room, actor.id) ||
        room.safety.expelled.includes(actor.id)
      )
        throw Error("Necesitas estar presente en una sala con quórum.");
      const clientId = req.headers["x-upload-id"];
      if (typeof clientId !== "string" || !/^[a-f0-9-]{36}$/.test(clientId))
        throw Error("Identificador de envío no válido.");
      const old = storage.db
        .prepare(
          "SELECT id FROM media WHERE room_id=? AND owner_id=? AND client_id=?",
        )
        .get(room.key, actor.id, clientId);
      if (old) {
        req.resume();
        json(res, 200, { id: old.id });
        return true;
      }
      if (!storage.takeLimit(digest(`images:${actor.id}`), 10, 60_000, now()))
        throw Error("Espera un minuto antes de enviar más imágenes.");
      if (
        Number(
          storage.db
            .prepare("SELECT COUNT(*) AS n FROM media WHERE room_id=?")
            .get(room.key)!.n,
        ) >= 20 ||
        Number(
          storage.db.prepare("SELECT COUNT(*) AS n FROM media").get()!.n,
        ) >= 200
      )
        throw Error("Se alcanzó el límite de imágenes de este piloto.");
      const body = await normalizeUpload(req);
      ctx.advance(room);
      if (
        !storage.session(ctx.tokenHash(req)!, now()) ||
        moderation.restriction(actor.id) ||
        !canChat(room.session) ||
        room.safety.expelled.includes(actor.id) ||
        !ctx.isPresent(room, actor.id)
      )
        throw Error("La sesión o sala dejó de estar disponible.");
      const duplicate = storage.db
        .prepare(
          "SELECT id FROM media WHERE room_id=? AND owner_id=? AND client_id=?",
        )
        .get(room.key, actor.id, clientId);
      if (duplicate) {
        json(res, 200, { id: duplicate.id });
        return true;
      }
      if (
        Number(
          storage.db
            .prepare("SELECT COUNT(*) AS n FROM media WHERE room_id=?")
            .get(room.key)!.n,
        ) >= 20 ||
        Number(
          storage.db.prepare("SELECT COUNT(*) AS n FROM media").get()!.n,
        ) >= 200
      )
        throw Error("Se alcanzó el límite de imágenes de este piloto.");
      const id = randomUUID();
      storage.db
        .prepare(
          "INSERT INTO media(id,room_id,owner_id,client_id,body,created_at) VALUES(?,?,?,?,?,?)",
        )
        .run(id, room.key, actor.id, clientId, body, now());
      json(res, 201, { id });
      return true;
    } catch (e) {
      req.resume();
      json(res, 422, {
        error: "room_action_failed",
        message: e instanceof Error ? e.message : "No se pudo completar.",
      });
    }
    return true;
  }
  return false;
}
