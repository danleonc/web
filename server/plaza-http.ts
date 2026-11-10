import type { IncomingMessage, ServerResponse } from "node:http";
import type { Storage } from "./storage.ts";
import { PlazaStore } from "./plaza.ts";
import { PlazaModeration } from "./plaza-moderation.ts";
import { ConnectionsStore } from "./connections.ts";

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(body));
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw Error("json_required");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) throw Error("body_too_large");
    chunks.push(chunk);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("invalid_body");
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => typeof value[key] === "string");
}
export async function handlePlaza(storage: Storage, now: () => number, validOrigin: (req: IncomingMessage) => boolean, req: IncomingMessage, res: ServerResponse, path: string, actor: { id: string } | null, onBlock: (id: string) => void, onUnblock: (id: string) => boolean) {
  if (!path.startsWith("/api/plaza/")) return false;
  if (!actor) { req.resume(); json(res, 401, { error: "session_required" }); return true; }
  const plaza = new PlazaStore(storage);
  const moderation = new PlazaModeration(storage, now);
  const connections = new ConnectionsStore(storage, now);
  if (path.startsWith("/api/plaza/moderation/") && !moderation.canReview(actor.id)) { req.resume(); json(res, 403, { error: "moderator_required" }); return true; }
  const post = path.match(/^\/api\/plaza\/posts\/([a-f0-9-]{36})$/);
  const replies = path.match(/^\/api\/plaza\/posts\/([a-f0-9-]{36})\/replies$/);
  const reply = path.match(/^\/api\/plaza\/replies\/([a-f0-9-]{36})$/);
  const block = path.match(/^\/api\/plaza\/blocks\/([a-f0-9-]{36})$/);
  const invitation = path.match(/^\/api\/plaza\/invitations\/([a-f0-9-]{36})\/decision$/);
  const privateMessages = path.match(/^\/api\/plaza\/connections\/([a-f0-9-]{36})\/messages$/);
  const privateMessage = path.match(/^\/api\/plaza\/connections\/([a-f0-9-]{36})\/messages\/([a-f0-9-]{36})$/);
  const privateBlock = path.match(/^\/api\/plaza\/connections\/([a-f0-9-]{36})\/block$/);
  if (req.method === "GET") {
    if (path === "/api/plaza/posts") json(res, 200, { posts: plaza.listPosts(actor.id) });
    else if (path === "/api/plaza/blocks") json(res, 200, { blocks: storage.blockedAccounts(actor.id) });
    else if (path === "/api/plaza/my-moderation") json(res, 200, { actions: moderation.myActions(actor.id) });
    else if (path === "/api/plaza/connections") json(res, 200, { connections: connections.list(actor.id) });
    else if (privateMessages) { const messages = connections.messages(actor.id, privateMessages[1]); json(res, messages ? 200 : 404, messages ? { messages } : { error: "not_found" }); }
    else if (path === "/api/plaza/moderation/appeals") json(res, 200, { appeals: moderation.appeals(actor.id) });
    else if (path === "/api/plaza/moderation/reports") json(res, 200, { reports: moderation.reports(actor.id) });
    else if (replies) json(res, 200, { replies: plaza.listReplies(actor.id, replies[1]) });
    else json(res, 404, { error: "not_found" });
    return true;
  }
  if (!validOrigin(req)) { req.resume(); json(res, 403, { error: "origin_rejected" }); return true; }
  try {
    if (req.method === "DELETE" && privateMessage) {
      req.resume(); const ok = connections.remove(actor.id, privateMessage[1], privateMessage[2]); json(res, ok ? 200 : 404, ok ? { ok: true } : { error: "not_found" });
    } else if (req.method === "POST" && privateBlock) {
      const value = await body(req);
      if (Object.keys(value).length !== 0) throw Error("invalid_body");
      const peer = connections.peer(actor.id, privateBlock[1]);
      if (!peer) json(res, 404, { error: "not_found" });
      else { onBlock(peer); json(res, 200, { ok: true }); }
    } else if (req.method === "POST" && path === "/api/plaza/invitations") {
      const value = await body(req);
      if (!fields(value, ["kind", "contentId", "note"])) throw Error("invalid_body");
      json(res, 201, { invitation: connections.invite(actor.id, String(value.kind), String(value.contentId), String(value.note)) });
    } else if (req.method === "POST" && invitation) {
      const value = await body(req);
      if (!fields(value, ["action"])) throw Error("invalid_body");
      const ok = connections.decide(actor.id, invitation[1], String(value.action));
      json(res, ok ? 200 : 404, ok ? { ok: true } : { error: "not_found" });
    } else if (req.method === "POST" && privateMessages) {
      const value = await body(req);
      if (!fields(value, ["clientId", "body"])) throw Error("invalid_body");
      const message = connections.send(actor.id, privateMessages[1], String(value.clientId), String(value.body));
      json(res, message ? 201 : 404, message ? { message } : { error: "not_found" });
    } else if (req.method === "POST" && path === "/api/plaza/appeals") {
      const value = await body(req);
      if (!fields(value, ["reportId", "note"])) throw Error("invalid_body");
      json(res, 201, { id: moderation.appeal(actor.id, String(value.reportId), String(value.note)) });
    } else if (req.method === "POST" && path === "/api/plaza/moderation/appeals") {
      const value = await body(req);
      if (!fields(value, ["id", "decision", "note"])) throw Error("invalid_body");
      moderation.reviewAppeal(actor.id, String(value.id), String(value.decision), String(value.note));
      json(res, 200, { ok: true });
    } else if (req.method === "POST" && path === "/api/plaza/blocks") {
      const value = await body(req);
      if (!fields(value, ["kind", "contentId"])) throw Error("invalid_body");
      onBlock(plaza.blockTarget(actor.id, String(value.kind), String(value.contentId)));
      json(res, 200, { ok: true });
    } else if (req.method === "DELETE" && block) {
      const ok = onUnblock(block[1]);
      json(res, ok ? 200 : 404, ok ? { ok: true } : { error: "not_found" });
    } else if (req.method === "POST" && path === "/api/plaza/reports") {
      const value = await body(req);
      if (!fields(value, ["kind", "contentId", "reason", "note"])) throw Error("invalid_body");
      json(res, 201, { id: moderation.report(actor.id, String(value.kind), String(value.contentId), String(value.reason), String(value.note)) });
    } else if (req.method === "POST" && path === "/api/plaza/moderation/actions") {
      const value = await body(req);
      if (!fields(value, ["reportId", "action", "reason"])) throw Error("invalid_body");
      moderation.decide(actor.id, String(value.reportId), String(value.action), String(value.reason));
      json(res, 200, { ok: true });
    } else if (req.method === "POST" && path === "/api/plaza/posts") {
      const value = await body(req);
      if (!fields(value, ["topic", "title", "body"])) throw Error("invalid_body");
      json(res, 201, { post: plaza.createPost(actor.id, value as { topic: string; title: string; body: string }, now()) });
    } else if (req.method === "PATCH" && post) {
      const value = await body(req);
      if (!fields(value, ["topic", "title", "body"])) throw Error("invalid_body");
      const ok = plaza.editPost(actor.id, post[1], value as { topic: string; title: string; body: string });
      json(res, ok ? 200 : 404, ok ? { ok: true } : { error: "not_found" });
    } else if (req.method === "POST" && replies) {
      const value = await body(req);
      if (!fields(value, ["body"])) throw Error("invalid_body");
      json(res, 201, { reply: plaza.createReply(actor.id, replies[1], value.body as string, now()) });
    } else if (req.method === "PATCH" && reply) {
      const value = await body(req);
      if (!fields(value, ["body"])) throw Error("invalid_body");
      const ok = plaza.editReply(actor.id, reply[1], value.body as string);
      json(res, ok ? 200 : 404, ok ? { ok: true } : { error: "not_found" });
    } else if (req.method === "DELETE" && (post || reply)) {
      const ok = post ? plaza.deletePost(actor.id, post[1]) : plaza.deleteReply(actor.id, reply![1]);
      json(res, ok ? 200 : 404, ok ? { ok: true } : { error: "not_found" });
    } else { req.resume(); json(res, 404, { error: "not_found" }); }
  } catch { req.resume(); json(res, 422, { error: "invalid_request" }); }
  return true;
}
