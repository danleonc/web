import type { IncomingMessage, ServerResponse } from "node:http";
import type { Storage } from "./storage.ts";
import type { ModerationStore } from "./moderation.ts";
import { scheduleMeeting, cancelMeeting } from "./meetings.ts";

export async function handleMeetingCreation(storage: Storage, moderation: ModerationStore, now: () => number, validOrigin: (req: IncomingMessage) => boolean, req: IncomingMessage, res: ServerResponse, actor: { id: string } | null, cancelId?: string) {
  const json = (status: number, value: unknown) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(JSON.stringify(value)); };
  if (!actor) { req.resume(); json(401, { error: "session_required" }); return; }
  if (!validOrigin(req)) { req.resume(); json(403, { error: "origin_rejected" }); return; }
  if (!moderation.moderator(actor.id) || moderation.restriction(actor.id)) { req.resume(); json(403, { error: "moderator_required" }); return; }
  try {
    if (!req.headers["content-type"]?.startsWith("application/json")) throw Error("json_required");
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 2048) throw Error("body_too_large"); chunks.push(chunk); }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("invalid_body");
    if (cancelId) { cancelMeeting(storage, cancelId, value as Record<string, unknown>, now()); json(200, { ok: true }); }
    else json(201, { meeting: scheduleMeeting(storage, actor.id, value as Record<string, unknown>, now()) });
  } catch { req.resume(); json(422, { error: "invalid_meeting" }); }
}
