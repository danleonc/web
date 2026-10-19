import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { WebSocket, WebSocketServer } from "ws";
import { featuredActivities } from "../src/data.ts";
import { canChat, createSession, sessionReducer } from "../src/room/engine.ts";
import type { Session } from "../src/room/engine.ts";
import type { SharedEvent, SharedMessage } from "../src/shared/protocol.ts";

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
};
type Connection = {
  socket: WebSocket;
  identity: Identity;
  room: Room;
  alive: boolean;
  events: number;
  resetAt: number;
};
type Options = { allowedOrigins?: string[]; now?: () => number };
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
  const authenticated = (req: IncomingMessage) => {
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
      json(res, 200, { service: "entre-shared-development", version: 1 });
      return;
    }
    if (path !== "/api/session") {
      json(res, 404, { error: "not_found" });
      return;
    }
    if (req.method === "GET") {
      const identity = authenticated(req);
      json(
        res,
        identity ? 200 : 401,
        identity
          ? { id: identity.id, alias: identity.alias }
          : { error: "session_required" },
      );
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
    } catch {
      if (!res.writableEnded) json(res, 400, { error: "invalid_json" });
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
  function snapshot(c: Connection) {
    send(c, {
      type: "snapshot",
      me: c.identity.id,
      roomKey: c.room.key,
      revision: c.room.revision,
      now: now(),
      session: c.room.session,
      messages: c.room.messages.filter(
        (m) =>
          !c.identity.blocks.has(m.senderId) &&
          !identitiesById(m.senderId)?.blocks.has(c.identity.id),
      ),
    });
  }
  function identitiesById(id: string) {
    return [...identities.values()].find((i) => i.id === id);
  }
  function broadcast(room: Room) {
    room.revision++;
    for (const c of roomConnections(room)) snapshot(c);
  }
  function advance(room: Room) {
    const next = sessionReducer(room.session, { type: "tick", now: now() });
    if (next !== room.session) {
      room.session = next;
      broadcast(room);
    }
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
    const match = new URL(req.url || "/", "http://localhost").pathname.match(
      /^\/api\/rooms\/([a-z]+)$/,
    );
    const activity = match && featuredActivities.find((a) => a.id === match[1]);
    if (!activity) {
      reject(socket, 404);
      return;
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
        now(),
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
      };
      rooms.set(activity.id, room);
    }
    advance(room);
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
      };
      connections.add(c);
      broadcast(joined);
      ws.on("pong", () => {
        c.alive = true;
      });
      ws.on("error", () => {});
      ws.on("message", (raw) => {
        if (identity.expires <= now()) {
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
          const message: SharedMessage | undefined =
            content.type === "text" &&
            keys(content, ["type", "text"]) &&
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
                  keys(content, ["type", "stickerId"]) &&
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
          if (!message) {
            error(c, "invalid_message", "Texto o sticker no válido.");
            return;
          }
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
          send(c, { type: "ack", clientId: value.clientId });
          broadcast(joined);
          return;
        }
        const before = joined.session;
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
  async function close() {
    clearInterval(timer);
    clearInterval(heartbeat);
    for (const c of connections) c.socket.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  return { server, tick, close };
}
