import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { Storage, digest } from "./storage.ts";
import { Auth, accountCookie, readToken } from "./auth.ts";
import { WebSocket, WebSocketServer } from "ws";
import { featuredActivities } from "../src/data.ts";
import { canChat, createSession, sessionReducer } from "../src/room/engine.ts";
import type { Session } from "../src/room/engine.ts";
import type { SharedEvent, SharedMessage } from "../src/shared/protocol.ts";
import {
  createSafety,
  resolveSafety,
  startRemoval,
  voteRemoval,
  safetyView,
  applyExpulsions,
  removeByModerator,
  validReason,
} from "../src/safety/rules.ts";
import type { RoomSafety } from "../src/safety/rules.ts";
import { validImageRef } from "../src/media/types.ts";
import { ModerationStore } from "./moderation.ts";
import { GoogleAuth } from "./google.ts";
import type { GoogleConfig } from "./google.ts";
import { EmailConfirmation } from "./email.ts";
import type { SendVerificationEmail } from "./email.ts";
import { handleFeatures } from "./features.ts";

type Identity = {
  id: string;
  alias: string;
  expires: number;
  room: string | null;
  blocks: Set<string>;
};
type Room = {
  key: string;
  activityId: string;
  session: Session;
  messages: SharedMessage[];
  seen: Map<string, string>;
  revision: number;
  idleAt: number;
  safety: RoomSafety;
};
type Connection = {
  socket: WebSocket;
  identity: Identity;
  room: Room;
  alive: boolean;
  events: number;
  resetAt: number;
  tokenHash: string | null;
  expires: number;
};
type Options = {
  google?: GoogleConfig;
  sendVerificationEmail?: SendVerificationEmail;
  allowedOrigins?: string[];
  now?: () => number;
  databasePath?: string;
  staticRoot?: string;
  secureCookies?: boolean;
  startAt?: number;
  enforceSchedule?: boolean;
};
const cookieName = "entre_dev_session";
const packs = JSON.parse(
  readFileSync(
    new URL("../src/chat/sticker-packs.json", import.meta.url),
    "utf8",
  ),
) as { id: string; labels: string[] }[];
const stickerIds = new Set(
  packs.flatMap((p) => p.labels.map((_, i) => `${p.id}-${i + 1}`)),
);
const keys = (v: Record<string, unknown>, expected: string[]) =>
  Object.keys(v).every((k) => expected.includes(k));
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
export function createRoomServer(options: Options = {}) {
  const now = options.now || Date.now;
  const storage = options.databasePath
    ? new Storage(options.databasePath)
    : null;
  const auth = storage
    ? new Auth(storage, options.secureCookies ?? false, now)
    : null;
  const confirmation = storage
    ? new EmailConfirmation(storage, now, options.sendVerificationEmail)
    : null;
  const enforceSchedule = options.enforceSchedule ?? !!storage;
  const moderation = storage ? new ModerationStore(storage, now) : null;
  const google =
    storage && options.google
      ? new GoogleAuth(
          storage,
          now,
          options.google,
          options.secureCookies ?? false,
          (id) => !!moderation?.restriction(id),
        )
      : null;
  const allowed = new Set(
    options.allowedOrigins || [
      "http://localhost:4173",
      "http://127.0.0.1:4173",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
  );
  const identities = new Map<string, Identity>();
  const rooms = new Map<string, Room>();
  const connections = new Set<Connection>();
  const creationLimits = new Map<string, { count: number; until: number }>();
  if (storage) {
    storage.prune(now());
    for (const a of featuredActivities)
      storage.offering(a.id, options.startAt ?? Date.parse(a.startsAt));
    for (const a of storage.publicAccounts())
      identities.set(a.id, {
        ...a,
        expires: Infinity,
        room: null,
        blocks: storage.blocks(a.id),
      });
    for (const room of storage.loadRooms()) {
      room.session = {
        ...room.session,
        participants: room.session.participants.map((p) => ({
          ...p,
          present: false,
          typingUntil: 0,
        })),
        votes: [],
      };
      room.session = sessionReducer(room.session, { type: "tick", now: now() });
      room.idleAt = now();
      room.revision++;
      storage.saveRoom(room);
      rooms.set(room.activityId, room);
      for (const p of room.session.participants) {
        const i = identities.get(p.id);
        if (i) i.room = room.activityId;
      }
    }
  }
  const tokenHash = (req: IncomingMessage) => {
    const token = readToken(req, accountCookie);
    return token && /^[a-f0-9]{64}$/.test(token) ? digest(token) : null;
  };
  const authenticated = (req: IncomingMessage) => {
    if (storage) {
      const hash = tokenHash(req);
      const account = hash ? storage.session(hash, now()) : undefined;
      if (!account) return null;
      let identity = identities.get(account.id);
      if (!identity) {
        identity = {
          id: account.id,
          alias: account.alias,
          expires: Infinity,
          room: null,
          blocks: storage.blocks(account.id),
        };
        identities.set(identity.id, identity);
      }
      identity.alias = account.alias;
      return identity;
    }
    const token = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const identity = identities.get(token);
    return identity && identity.expires > now() ? identity : null;
  };
  function json(res: ServerResponse, status: number, value: unknown) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(value));
  }
  const validOrigin = (req: IncomingMessage) =>
    typeof req.headers.origin === "string" && allowed.has(req.headers.origin);
  const server = createServer(async (req, res) => {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    if (path === "/api/health" && req.method === "GET") {
      json(res, 200, {
        service: storage ? "entre-accounts" : "entre-shared-development",
        version: 2,
      });
      return;
    }
    if (
      options.staticRoot &&
      !path.startsWith("/api/") &&
      (req.method === "GET" || req.method === "HEAD")
    ) {
      const root = resolve(options.staticRoot);
      try {
        const relative =
          decodeURIComponent(path).replace(/^\/+/, "") || "index.html";
        const file = resolve(root, relative);
        if (!file.startsWith(root + "/")) throw new Error("invalid_path");
        const body = await readFile(file);
        const type: Record<string, string> = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".json": "application/json",
        };
        res.writeHead(200, {
          "Content-Type": type[extname(file)] || "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "same-origin",
          "Cache-Control": relative.startsWith("assets/")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        });
        res.end(req.method === "HEAD" ? undefined : body);
      } catch {
        json(res, 404, { error: "not_found" });
      }
      return;
    }
    if (path === "/api/auth/options" && req.method === "GET") {
      json(res, 200, { google: !!google });
      return;
    }
    if (path === "/api/auth/google-callback") {
      if (req.method !== "GET") {
        json(res, 405, { error: "method_not_allowed" });
        return;
      }
      if (!google) {
        json(res, 503, { error: "google_unavailable" });
        return;
      }
      const result = await google.callback(
        new URL(req.url!, "http://callback.local"),
        req,
        res,
      );
      if (result.revoked)
        for (const c of connections)
          if (c.tokenHash === result.revoked)
            c.socket.close(4001, "Sesion renovada");
      res.writeHead(303, {
        Location: result.location,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      });
      res.end();
      return;
    }
    const identity = authenticated(req);
    if (
      storage &&
      identity &&
      !path.startsWith("/api/auth/") &&
      path !== "/api/session" &&
      path !== "/api/activities" &&
      path !== "/api/appeals" &&
      !storage.canParticipate(identity.id)
    ) {
      req.resume();
      json(res, 403, { error: "email_confirmation_required" });
      return;
    }
    if (
      storage &&
      identity &&
      moderation?.restriction(identity.id) &&
      !path.startsWith("/api/auth/") &&
      path !== "/api/appeals" &&
      req.method !== "GET"
    ) {
      req.resume();
      json(res, 403, { error: "account_restricted" });
      return;
    }
    if (
      await handleFeatures(
        {
          storage,
          moderation,
          now,
          rooms,
          validOrigin,
          tokenHash,
          isPresent: (room, id) =>
            roomConnections(room).some((c) => c.identity.id === id),
          blocked: (sender, viewer) =>
            !!identitiesById(sender)?.blocks.has(viewer),
          advance,
          onDecision,
        },
        req,
        res,
        path,
        identity,
      )
    )
      return;
    if (storage && req.method === "GET" && path === "/api/activities") {
      if (!identity) {
        json(res, 401, { error: "session_required" });
        return;
      }
      json(res, 200, {
        activities: featuredActivities.map((a) => ({
          id: a.id,
          title: a.title,
          startsAt: new Date(storage.startsAt(a.id)).toISOString(),
          minimum: a.minimum,
          maximum: a.capacity,
          reserved: storage.countReservations(a.id),
          mine: storage.reserved(identity.id, a.id),
          accessible:
            !enforceSchedule ||
            (now() >= storage.startsAt(a.id) - 300_000 &&
              now() < storage.startsAt(a.id) + 300_000),
          bookingOpen: now() < storage.startsAt(a.id),
          ended:
            rooms.get(a.id)?.session.phase === "closed" ||
            rooms.get(a.id)?.session.phase === "insufficient" ||
            (enforceSchedule && now() >= storage.startsAt(a.id) + 300_000),
        })),
      });
      return;
    }
    if (
      storage &&
      req.method === "GET" &&
      (path === "/api/history" || /^\/api\/history\/[a-f0-9-]+$/.test(path))
    ) {
      if (!identity) {
        json(res, 401, { error: "session_required" });
        return;
      }
      if (path === "/api/history") {
        json(res, 200, { rooms: storage.history(identity.id) });
        return;
      }
      const id = path.split("/").at(-1)!;
      if (!storage.member(identity.id, id)) {
        json(res, 404, { error: "not_found" });
        return;
      }
      json(res, 200, {
        messages: visibleMessages(storage.messages(id), identity),
      });
      return;
    }
    const reservation =
      storage && path.match(/^\/api\/reservations\/([a-z]+)$/);
    if (reservation && (req.method === "POST" || req.method === "DELETE")) {
      if (!validOrigin(req)) {
        json(res, 403, { error: "origin_rejected" });
        return;
      }
      if (!identity) {
        json(res, 401, { error: "session_required" });
        return;
      }
      const activity = featuredActivities.find((a) => a.id === reservation[1]);
      if (!activity) {
        json(res, 404, { error: "not_found" });
        return;
      }
      req.resume();
      if (req.method === "DELETE") {
        if (
          roomConnections(rooms.get(activity.id)!).some(
            (c) => c.identity.id === identity.id,
          )
        ) {
          json(res, 409, { error: "leave_room_first" });
          return;
        }
        storage!.cancel(identity.id, activity.id);
        json(res, 200, { ok: true });
        return;
      }
      const result = storage!.reserve(
        identity.id,
        activity.id,
        activity.capacity,
        now(),
      );
      json(
        res,
        result === "ok" ? 200 : 409,
        result === "ok" ? { ok: true } : { error: `reservation_${result}` },
      );
      return;
    }
    const authPath = storage && path.match(/^\/api\/auth\/([a-z-]+)$/);
    if (authPath && req.method !== "POST") {
      json(res, 405, { error: "method_not_allowed" });
      return;
    }
    if (path !== "/api/session" && !authPath) {
      json(res, 404, { error: "not_found" });
      return;
    }
    if (req.method === "GET") {
      const identity = authenticated(req);
      json(
        res,
        identity ? 200 : 401,
        identity
          ? {
              id: identity.id,
              alias: identity.alias,
              moderator: moderation?.moderator(identity.id) || false,
              restriction: moderation?.restriction(identity.id) || null,
              imagesEnabled: moderation?.hasModerators() || false,
              ...(storage
                ? {
                    email: storage.emailStatus(identity.id)?.email || "",
                    emailConfirmed:
                      storage.emailStatus(identity.id)?.verifiedAt != null,
                    adultDeclared: !!storage.emailStatus(identity.id)
                      ?.adultDeclaredAt,
                    canParticipate:
                      storage.canParticipate(identity.id) &&
                      !moderation?.restriction(identity.id),
                    emailDeliveryAvailable: !!options.sendVerificationEmail,
                    googleLinked: !!storage.googleIdentity(identity.id),
                    needsGoogleProfile:
                      storage.googleIdentity(identity.id)?.profileComplete ===
                      0,
                    passwordEnabled:
                      storage.accountById(identity.id)?.passwordHash !==
                      "google-only",
                  }
                : {}),
            }
          : { error: "session_required" },
      );
      return;
    }
    if (storage && path === "/api/session") {
      json(res, 405, { error: "login_required" });
      return;
    }
    if (req.method !== "POST") {
      json(res, 405, { error: "method_not_allowed" });
      return;
    }
    if (!validOrigin(req)) {
      json(res, 403, { error: "origin_rejected" });
      return;
    }
    if (!req.headers["content-type"]?.startsWith("application/json")) {
      json(res, 415, { error: "json_required" });
      return;
    }
    if (Number(req.headers["content-length"] || 0) > 2048) {
      json(res, 413, { error: "body_too_large" });
      req.resume();
      return;
    }
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 2048) {
          json(res, 413, { error: "body_too_large" });
          return;
        }
        chunks.push(chunk);
      }
      const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (authPath && auth) {
        if (!record(value)) {
          json(res, 422, { error: "invalid_fields" });
          return;
        }
        if (["google-start", "google-complete"].includes(authPath[1])) {
          if (!google) {
            json(res, 503, { error: "google_unavailable" });
            return;
          }
          if (authPath[1] === "google-start") {
            const result = google.start(value, req, res);
            json(res, result.status, result.body);
            return;
          }
          const current = authenticated(req);
          if (!current) {
            json(res, 401, { error: "session_required" });
            return;
          }
          const result = google.complete(value, current.id);
          json(res, result.status, result.body);
          return;
        }
        if (
          ["email-code", "confirm-email"].includes(authPath[1]) &&
          confirmation
        ) {
          const currentIdentity = authenticated(req);
          if (!currentIdentity) {
            json(res, 401, { error: "session_required" });
            return;
          }
          const result = await confirmation.action(
            authPath[1],
            value,
            currentIdentity.id,
            req,
          );
          json(res, result.status, result.body);
          return;
        }
        const result = await auth.action(authPath[1], value, req, res);
        if (result.revoked)
          for (const c of connections)
            if (c.tokenHash === result.revoked)
              c.socket.close(4001, "Sesion cerrada");
        if (result.recovered)
          for (const c of connections)
            if (c.identity.id === result.recovered)
              c.socket.close(4001, "Sesion renovada");
        json(res, result.status, result.body);
        return;
      }
      if (
        !record(value) ||
        !keys(value, ["alias", "adult"]) ||
        typeof value.alias !== "string" ||
        !value.alias.trim() ||
        value.alias.trim().length > 30 ||
        /[\u0000-\u001f]/.test(value.alias) ||
        value.adult !== true
      ) {
        json(res, 422, { error: "invalid_development_profile" });
        return;
      }
      const existing = authenticated(req);
      if (existing) {
        json(res, 200, { id: existing.id, alias: existing.alias });
        return;
      }
      const ip = req.socket.remoteAddress || "local";
      const limit = creationLimits.get(ip);
      if (limit && limit.until > now() && limit.count >= 30) {
        json(res, 429, { error: "too_many_sessions" });
        return;
      }
      creationLimits.set(ip, {
        count: limit && limit.until > now() ? limit.count + 1 : 1,
        until: limit && limit.until > now() ? limit.until : now() + 60_000,
      });
      if (identities.size >= 200) {
        json(res, 503, { error: "development_capacity" });
        return;
      }
      const token = randomBytes(32).toString("hex");
      const identity = {
        id: randomUUID(),
        alias: value.alias.trim(),
        expires: now() + 4 * 60 * 60_000,
        room: null,
        blocks: new Set<string>(),
      };
      identities.set(token, identity);
      res.setHeader(
        "Set-Cookie",
        `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=14400`,
      );
      json(res, 201, { id: identity.id, alias: identity.alias });
    } catch (e) {
      if (!res.writableEnded)
        json(res, e instanceof SyntaxError ? 400 : 500, {
          error:
            e instanceof SyntaxError ? "invalid_json" : "service_unavailable",
        });
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 4096,
    perMessageDeflate: false,
  });
  function send(c: Connection, event: SharedEvent) {
    if (c.socket.readyState !== WebSocket.OPEN) return;
    if (c.socket.bufferedAmount > 128 * 1024) {
      c.socket.close(1013, "Conexion lenta");
      return;
    }
    c.socket.send(JSON.stringify(event));
  }
  function error(c: Connection, code: string, message: string) {
    send(c, { type: "error", code, message });
  }
  const roomConnections = (room: Room) =>
    [...connections].filter(
      (c) => c.room === room && c.socket.readyState === WebSocket.OPEN,
    );
  function visibleMessages(messages: SharedMessage[], viewer: Identity) {
    const ownBlocks = storage ? storage.blocks(viewer.id) : viewer.blocks;
    const visible = new Map<string, boolean>();
    return messages.filter((message) => {
      if (!visible.has(message.senderId)) {
        const reverseBlocks = storage
          ? storage.blocks(message.senderId)
          : identitiesById(message.senderId)?.blocks;
        visible.set(
          message.senderId,
          !ownBlocks.has(message.senderId) && !reverseBlocks?.has(viewer.id),
        );
      }
      return visible.get(message.senderId)!;
    });
  }
  function snapshot(c: Connection) {
    send(c, {
      type: "snapshot",
      me: c.identity.id,
      roomKey: c.room.key,
      revision: c.room.revision,
      now: now(),
      session: c.room.session,
      safety: safetyView(c.room.safety, c.identity.id),
      hiddenImages: moderation?.hiddenImages(c.room.key) || [],
      messages: visibleMessages(c.room.messages, c.identity),
    });
  }
  function identitiesById(id: string) {
    return [...identities.values()].find((i) => i.id === id);
  }
  function broadcast(room: Room) {
    room.revision++;
    storage?.saveRoom(room);
    for (const c of roomConnections(room)) snapshot(c);
  }
  function advance(room: Room) {
    const before = room.safety;
    room.safety = resolveSafety(room.safety, now());
    const next = sessionReducer(applyExpulsions(room.session, room.safety), {
      type: "tick",
      now: now(),
    });
    if (["closed", "insufficient"].includes(next.phase) && room.safety.ballot)
      room.safety = {
        ...room.safety,
        ballot: null,
        notice:
          "El encuentro terminó. La votación no produce un baneo de cuenta.",
      };
    for (const c of roomConnections(room))
      if (room.safety.expelled.includes(c.identity.id))
        c.socket.close(4005, "Retirado de este encuentro");
    if (next !== room.session || before !== room.safety) {
      room.session = next;
      broadcast(room);
    }
  }
  function onDecision(roomId: string, target: string, kind: string) {
    const room = [...rooms.values()].find((r) => r.key === roomId);
    if (room) {
      if (kind === "remove-room")
        room.safety = removeByModerator(room.safety, target);
      advance(room);
      broadcast(room);
    }
    for (const c of connections)
      if (c.identity.id === target && moderation?.restriction(target))
        c.socket.close(4004, "Cuenta restringida");
  }
  function reject(socket: import("node:stream").Duplex, status: number) {
    socket.end(
      `HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
    );
  }
  server.on("upgrade", (req, socket, head) => {
    if (!validOrigin(req)) {
      reject(socket, 403);
      return;
    }
    const identity = authenticated(req);
    if (!identity) {
      reject(socket, 401);
      return;
    }
    if (storage && !storage.canParticipate(identity.id)) {
      reject(socket, 403);
      return;
    }
    if (moderation?.restriction(identity.id)) {
      reject(socket, 403);
      return;
    }
    const match = new URL(req.url || "/", "http://localhost").pathname.match(
      /^\/api\/rooms\/([a-z]+)$/,
    );
    const activity = match && featuredActivities.find((a) => a.id === match[1]);
    if (!activity) {
      reject(socket, 404);
      return;
    }
    if (storage) {
      if (!storage.reserved(identity.id, activity.id)) {
        reject(socket, 403);
        return;
      }
      if (enforceSchedule && now() < storage.startsAt(activity.id) - 300_000) {
        reject(socket, 425);
        return;
      }
      if (
        enforceSchedule &&
        now() >= storage.startsAt(activity.id) + 300_000 &&
        !rooms
          .get(activity.id)
          ?.session.participants.some((p) => p.id === identity.id)
      ) {
        reject(socket, 410);
        return;
      }
    }
    if (identity.room && identity.room !== activity.id) {
      reject(socket, 409);
      return;
    }
    let room = rooms.get(activity.id);
    if (!room) {
      const session = createSession(
        [],
        "",
        activity.minimum,
        activity.capacity,
        activity.duration,
        activity.questions.length,
        storage && enforceSchedule ? storage.startsAt(activity.id) : now(),
      );
      session.participants = [];
      session.notice =
        "Recepción compartida: esperamos al mínimo de personas conectadas. La guía no cuenta.";
      room = {
        key: randomUUID(),
        activityId: activity.id,
        session,
        messages: [],
        seen: new Map(),
        revision: 0,
        idleAt: now(),
        safety: createSafety(),
      };
      rooms.set(activity.id, room);
    }
    advance(room);
    if (room.safety.expelled.includes(identity.id)) {
      reject(socket, 403);
      return;
    }
    if (["closed", "insufficient"].includes(room.session.phase)) {
      reject(socket, 410);
      return;
    }
    if (
      room.session.participants.some(
        (p) =>
          p.present &&
          (identity.blocks.has(p.id) ||
            identitiesById(p.id)?.blocks.has(identity.id)),
      )
    ) {
      reject(socket, 403);
      return;
    }
    const member = room.session.participants.find((p) => p.id === identity.id);
    if (!member && room.session.phase !== "lobby") {
      reject(socket, 409);
      return;
    }
    if (!member && room.session.participants.length >= activity.capacity) {
      reject(socket, 409);
      return;
    }
    if ([...connections].filter((c) => c.identity === identity).length >= 3) {
      reject(socket, 429);
      return;
    }
    const joined = room;
    wss.handleUpgrade(req, socket, head, (ws) => {
      // Upgrade callbacks run synchronously; membership and capacity change in one event-loop operation.
      identity.room = activity.id;
      const existing = joined.session.participants.find(
        (p) => p.id === identity.id,
      );
      if (existing)
        joined.session = sessionReducer(joined.session, {
          type: "presence",
          id: identity.id,
          present: true,
          now: now(),
        });
      else
        joined.session = {
          ...joined.session,
          participants: [
            ...joined.session.participants,
            {
              id: identity.id,
              name: identity.alias,
              own: false,
              present: true,
              status: "pending",
              typingUntil: 0,
            },
          ],
        };
      const c: Connection = {
        socket: ws,
        identity,
        room: joined,
        alive: true,
        events: 0,
        resetAt: now() + 10_000,
        tokenHash: storage ? tokenHash(req) : null,
        expires: storage
          ? storage.session(tokenHash(req)!, now())!.expires
          : identity.expires,
      };
      connections.add(c);
      broadcast(joined);
      ws.on("pong", () => {
        c.alive = true;
      });
      ws.on("error", () => {});
      ws.on("message", (raw) => {
        if (storage && !storage.canParticipate(identity.id)) {
          ws.close(4001, "Confirma tu correo");
          return;
        }
        if (moderation?.restriction(identity.id)) {
          ws.close(4004, "Cuenta restringida");
          return;
        }
        if (joined.safety.expelled.includes(identity.id)) {
          ws.close(4005, "Retirado de este encuentro");
          return;
        }
        if (
          c.expires <= now() ||
          (storage && c.tokenHash && !storage.session(c.tokenHash, now()))
        ) {
          ws.close(4001, "Sesion vencida");
          return;
        }
        if (now() >= c.resetAt) {
          c.events = 0;
          c.resetAt = now() + 10_000;
        }
        if (++c.events > 80) {
          error(
            c,
            "rate_limited",
            "Espera un momento antes de enviar más acciones.",
          );
          return;
        }
        advance(joined);
        let value: unknown;
        try {
          value = JSON.parse(raw.toString());
        } catch {
          error(c, "invalid_event", "Acción no válida.");
          return;
        }
        if (!record(value) || typeof value.type !== "string") {
          error(c, "invalid_event", "Acción no válida.");
          return;
        }
        const ownPresent = joined.session.participants.some(
          (p) => p.id === identity.id && p.present,
        );
        if (!ownPresent) {
          error(c, "not_present", "Debes estar presente en esta sala.");
          return;
        }
        if (value.type === "leave" && keys(value, ["type"])) {
          ws.close(1000, "Salida voluntaria");
          return;
        }
        if (
          value.type === "open-removal" &&
          keys(value, ["type", "targetId", "reason"]) &&
          typeof value.targetId === "string" &&
          validReason(value.reason)
        ) {
          if (!canChat(joined.session)) {
            error(
              c,
              "room_not_ready",
              "La sala necesita quórum para abrir una votación.",
            );
            return;
          }
          const next = startRemoval(
            joined.safety,
            identity.id,
            value.targetId,
            value.reason,
            joined.session.participants
              .filter((p) => p.present)
              .map((p) => p.id),
            now(),
            randomUUID(),
          );
          if (next === joined.safety) {
            error(
              c,
              "removal_unavailable",
              "No se puede abrir otra solicitud ahora. Se requieren al menos tres presentes y dos minutos entre solicitudes.",
            );
            return;
          }
          joined.safety = next;
          advance(joined);
          broadcast(joined);
          return;
        }
        if (
          value.type === "removal-vote" &&
          keys(value, ["type", "ballotId", "choice"]) &&
          typeof value.ballotId === "string" &&
          (value.choice === "remove" || value.choice === "keep")
        ) {
          const next = voteRemoval(
            joined.safety,
            identity.id,
            value.ballotId,
            value.choice,
            joined.session.participants
              .filter((p) => p.present)
              .map((p) => p.id),
            now(),
          );
          if (next === joined.safety) {
            error(
              c,
              "vote_rejected",
              "El voto no es válido, ya está registrado o venció el plazo.",
            );
            return;
          }
          joined.safety = next;
          advance(joined);
          broadcast(joined);
          return;
        }
        if (
          value.type === "block" &&
          keys(value, ["type", "participantId"]) &&
          typeof value.participantId === "string"
        ) {
          if (
            value.participantId === identity.id ||
            !joined.session.participants.some(
              (p) => p.id === value.participantId,
            )
          ) {
            error(c, "invalid_target", "Participante no válido.");
            return;
          }
          identity.blocks.add(value.participantId);
          storage?.block(identity.id, value.participantId);
          for (const peer of connections)
            if (peer.identity === identity)
              peer.socket.close(4003, "Bloqueo registrado; sales de esta sala");
          return;
        }
        if (value.type === "message") {
          if (
            !keys(value, ["type", "clientId", "content"]) ||
            typeof value.clientId !== "string" ||
            !/^[a-zA-Z0-9-]{8,64}$/.test(value.clientId) ||
            !record(value.content)
          ) {
            error(c, "invalid_message", "Mensaje no válido.");
            return;
          }
          const idempotency = `${identity.id}:${value.clientId}`;
          if (joined.seen.has(idempotency)) {
            send(c, { type: "ack", clientId: value.clientId });
            return;
          }
          if (!canChat(joined.session)) {
            error(
              c,
              "room_not_ready",
              "El chat espera quórum o el encuentro ya terminó.",
            );
            return;
          }
          const content = value.content;
          if (content.replyTo !== undefined) {
            const original =
              typeof content.replyTo === "string" &&
              content.replyTo.length <= 80
                ? joined.messages.find((m) => m.id === content.replyTo)
                : undefined;
            if (!original || !visibleMessages([original], identity).length) {
              error(
                c,
                "invalid_reply",
                "El mensaje original ya no está disponible en esta sala. Descarta ese envío pendiente y vuelve a enviarlo sin cita.",
              );
              return;
            }
          }
          let message: SharedMessage | undefined =
            content.type === "text" &&
            keys(content, ["type", "text", "replyTo"]) &&
            typeof content.text === "string" &&
            content.text.trim().length > 0 &&
            content.text.length <= 1000
              ? {
                  id: randomUUID(),
                  clientId: value.clientId,
                  senderId: identity.id,
                  name: identity.alias,
                  type: "text",
                  text: content.text.trim(),
                }
              : content.type === "sticker" &&
                  keys(content, ["type", "stickerId", "replyTo"]) &&
                  typeof content.stickerId === "string" &&
                  stickerIds.has(content.stickerId)
                ? {
                    id: randomUUID(),
                    clientId: value.clientId,
                    senderId: identity.id,
                    name: identity.alias,
                    type: "sticker",
                    stickerId: content.stickerId,
                  }
                : undefined;
          if (
            content.type === "image" &&
            keys(content, ["type", "image", "replyTo"]) &&
            validImageRef(content.image) &&
            storage &&
            moderation
          ) {
            const asset = moderation.media(content.image.id);
            if (
              asset &&
              asset.room_id === joined.key &&
              asset.owner_id === identity.id &&
              !asset.hidden
            )
              message = {
                id: randomUUID(),
                clientId: value.clientId,
                senderId: identity.id,
                name: identity.alias,
                type: "image",
                image: {
                  id: content.image.id,
                  description: content.image.description,
                },
              };
          }
          if (!message) {
            error(c, "invalid_message", "Texto o sticker no válido.");
            return;
          }
          if (typeof content.replyTo === "string")
            message.replyTo = content.replyTo;
          joined.messages.push(message);
          joined.messages = joined.messages.slice(-50);
          joined.seen.set(idempotency, message.id);
          if (joined.seen.size > 200)
            joined.seen.delete(joined.seen.keys().next().value!);
          joined.session = sessionReducer(joined.session, {
            type: "response",
            id: identity.id,
            status: "participated",
            now: now(),
          });
          broadcast(joined);
          send(c, { type: "ack", clientId: value.clientId });
          return;
        }
        const before = joined.session;
        if (
          value.type === "start" &&
          storage &&
          enforceSchedule &&
          now() < storage.startsAt(activity.id)
        ) {
          error(
            c,
            "too_early",
            "El encuentro comienza en el horario reservado.",
          );
          return;
        }
        if (value.type === "start" && keys(value, ["type"]))
          joined.session = sessionReducer(before, {
            type: "start",
            now: now(),
          });
        else if (value.type === "extend" && keys(value, ["type"]))
          joined.session = sessionReducer(before, {
            type: "extend",
            now: now(),
          });
        else if (value.type === "next-question" && keys(value, ["type"]))
          joined.session = sessionReducer(before, {
            type: "vote",
            id: identity.id,
            now: now(),
          });
        else if (
          value.type === "typing" &&
          keys(value, ["type", "active"]) &&
          typeof value.active === "boolean"
        )
          joined.session = sessionReducer(before, {
            type: "typing",
            id: identity.id,
            active: value.active,
            now: now(),
          });
        else if (
          value.type === "respond" &&
          keys(value, ["type", "status"]) &&
          typeof value.status === "string" &&
          ["ready", "pass", "listen", "pending"].includes(value.status)
        )
          joined.session = sessionReducer(before, {
            type: "response",
            id: identity.id,
            status: value.status as "ready" | "pass" | "listen" | "pending",
            now: now(),
          });
        else {
          error(
            c,
            "invalid_event",
            "Acción no permitida. El reloj, la identidad y la presencia los controla el servidor.",
          );
          return;
        }
        if (joined.session !== before) broadcast(joined);
        else snapshot(c);
      });
      ws.on("close", () => {
        connections.delete(c);
        if (
          [...connections].some(
            (other) => other.identity === identity && other.room === joined,
          )
        )
          return;
        if (joined.session.phase === "lobby") {
          joined.session = {
            ...joined.session,
            participants: joined.session.participants.filter(
              (p) => p.id !== identity.id,
            ),
            votes: joined.session.votes.filter((id) => id !== identity.id),
          };
          identity.room = null;
        } else
          joined.session = sessionReducer(joined.session, {
            type: "presence",
            id: identity.id,
            present: false,
            now: now(),
          });
        if (!roomConnections(joined).length) joined.idleAt = now();
        broadcast(joined);
      });
    });
  });
  function tick() {
    for (const room of rooms.values()) {
      advance(room);
      if (!roomConnections(room).length && now() - room.idleAt > 5 * 60_000) {
        storage?.archive(room.key, now());
        rooms.delete(room.activityId);
        for (const i of identities.values())
          if (i.room === room.activityId) i.room = null;
      }
    }
    for (const [token, i] of identities)
      if (i.expires <= now()) {
        for (const c of connections)
          if (c.identity === i) c.socket.close(4001, "Sesion vencida");
        identities.delete(token);
      }
    for (const [ip, limit] of creationLimits)
      if (limit.until <= now()) creationLimits.delete(ip);
    for (const c of connections)
      if (
        c.expires <= now() ||
        (storage && c.tokenHash && !storage.session(c.tokenHash, now()))
      )
        c.socket.close(4001, "Sesion vencida");
    for (const c of connections)
      if (moderation?.restriction(c.identity.id))
        c.socket.close(4004, "Cuenta restringida");
  }
  const timer = setInterval(tick, 500);
  timer.unref();
  const heartbeat = setInterval(() => {
    for (const c of connections) {
      if (!c.alive) {
        c.socket.terminate();
        continue;
      }
      c.alive = false;
      c.socket.ping();
    }
  }, 10_000);
  heartbeat.unref();
  const maintenance = setInterval(() => storage?.prune(now()), 60_000);
  maintenance.unref();
  async function close() {
    clearInterval(timer);
    clearInterval(heartbeat);
    clearInterval(maintenance);
    for (const c of connections) c.socket.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    storage?.close();
  }
  return { server, tick, close };
}
