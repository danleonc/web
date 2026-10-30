import { createECDH, ECDH } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import webpush from "web-push";
import { digest } from "./storage.ts";
import type { Storage } from "./storage.ts";
export type PushConfig = {
  publicKey: string; privateKey: string; subject: string;
  // Private test transport only. Production always uses web-push/HTTPS.
  send?: (subscription: webpush.PushSubscription, payload: string, options: webpush.RequestOptions) => Promise<unknown>;
};
function validateConfig(config: PushConfig) {
  try {
    if (!/^[\w-]{87}$/.test(config.publicKey) || !/^[\w-]{43}$/.test(config.privateKey)) throw Error();
    const key = createECDH("prime256v1"); key.setPrivateKey(Buffer.from(config.privateKey, "base64url"));
    if (!key.getPublicKey().equals(Buffer.from(config.publicKey, "base64url"))) throw Error();
    const subject = new URL(config.subject);
    if (!((subject.protocol === "mailto:" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject.pathname)) || (subject.protocol === "https:" && !subject.username && !subject.password))) throw Error();
  } catch { throw Error("Configura claves VAPID emparejadas y un contacto válido en el servidor."); }
}
export function pushFromEnv(env: NodeJS.ProcessEnv): PushConfig | undefined {
  const publicKey = env.ENTRE_VAPID_PUBLIC_KEY, privateKey = env.ENTRE_VAPID_PRIVATE_KEY, subject = env.ENTRE_VAPID_SUBJECT;
  if (!publicKey && !privateKey && !subject) return undefined;
  if (!publicKey || !privateKey || !subject) throw Error("Completa las tres variables VAPID del servidor.");
  const config = { publicKey, privateKey, subject }; validateConfig(config); return config;
}
function validEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && (!url.port || url.port === "443") && url.pathname.length > 1 &&
      (["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(url.hostname) || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname));
  } catch { return false; }
}
export function validSubscription(value: unknown): webpush.PushSubscription | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!validEndpoint(v.endpoint) || !v.keys || typeof v.keys !== "object" || Array.isArray(v.keys) || Object.keys(v).some(k => !["endpoint", "expirationTime", "keys"].includes(k))) return null;
  const keys = v.keys as Record<string, unknown>;
  if (typeof keys.p256dh !== "string" || !/^[\w-]{87}$/.test(keys.p256dh) || typeof keys.auth !== "string" || !/^[\w-]{22}$/.test(keys.auth) || Object.keys(keys).some(k => !["p256dh", "auth"].includes(k))) return null;
  if (v.expirationTime !== undefined && v.expirationTime !== null && (!Number.isSafeInteger(v.expirationTime) || Number(v.expirationTime) <= 0)) return null;
  try { ECDH.convertKey(Buffer.from(keys.p256dh, "base64url"), "prime256v1"); } catch { return null; }
  return { endpoint: v.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });res.end(JSON.stringify(body));
};
export class PushDelivery {
  private storage: Storage;
  private config: PushConfig;
  private now: () => number;
  constructor(storage: Storage, config: PushConfig, now: () => number) { validateConfig(config); this.storage = storage; this.config = config; this.now = now; }
  get publicKey() { return this.config.publicKey; }
  async handle(req: IncomingMessage, res: ServerResponse, path: string, identity: { id: string } | null, sessionHash: string | null, originValid: boolean) {
    if (path === "/api/push/options" && req.method === "GET") { json(res, 200, { available: true, publicKey: this.publicKey }); return; }
    if (!identity || !sessionHash) { req.resume(); json(res, 401, { error: "session_required" }); return; }
    if (req.method !== "POST") { req.resume(); json(res, 405, { error: "method_not_allowed" }); return; }
    if (!originValid) { req.resume(); json(res, 403, { error: "origin_rejected" }); return; }
    if (!req.headers["content-type"]?.startsWith("application/json")) { req.resume(); json(res, 415, { error: "json_required" }); return; }
    let value: unknown;
    try {
      let size = 0; const chunks: Buffer[] = [];
      for await (const chunk of req) { size += chunk.length; if (size > 4096) { json(res, 413, { error: "body_too_large" }); return; } chunks.push(chunk); }
      value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch { json(res, 422, { error: "invalid_fields" }); return; }
    if (!record(value)) { json(res, 422, { error: "invalid_fields" }); return; }
    const db = this.storage.db;
    if (path === "/api/push/subscribe") {
      const sub = validSubscription(value.subscription);
      if (!sub || Object.keys(value).some(k => k !== "subscription")) { json(res, 422, { error: "invalid_subscription" }); return; }
      if (!this.storage.takeLimit(`push-sub:${identity.id}`, 10, 600_000, this.now()) || !this.storage.takeLimit(`push-sub-ip:${req.socket.remoteAddress || "unknown"}`, 30, 600_000, this.now())) { json(res, 429, { error: "rate_limited" }); return; }
      const key = digest(sub.endpoint);
      const existing = db.prepare("SELECT user_id FROM push_subscriptions WHERE endpoint_hash=?").get(key);
      if (existing && existing.user_id !== identity.id) { json(res, 409, { error: "device_conflict" }); return; }
      const count = db.prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id=? AND session_hash<>?").get(identity.id, sessionHash)!;
      if (!existing && Number(count.n) >= 5) { json(res, 409, { error: "device_limit" }); return; }
      this.storage.transaction(() => {
        db.prepare("DELETE FROM push_subscriptions WHERE user_id=? AND session_hash=? AND endpoint_hash<>?").run(identity.id, sessionHash, key);
        db.prepare("INSERT INTO push_subscriptions(endpoint_hash,user_id,session_hash,subscription_json,created_at) VALUES(?,?,?,?,?) ON CONFLICT(endpoint_hash) DO UPDATE SET session_hash=excluded.session_hash,subscription_json=excluded.subscription_json,created_at=excluded.created_at").run(key, identity.id, sessionHash, JSON.stringify(sub), this.now());
      });
      json(res, 200, { ok: true }); return;
    }
    if (!["/api/push/status", "/api/push/unsubscribe", "/api/push/test"].includes(path)) { json(res, 404, { error: "not_found" }); return; }
    if (!validEndpoint(value.endpoint) || Object.keys(value).some(k => k !== "endpoint")) { json(res, 422, { error: "invalid_fields" }); return; }
    const key = digest(value.endpoint);
    const row = db.prepare("SELECT subscription_json FROM push_subscriptions WHERE endpoint_hash=? AND user_id=?").get(key, identity.id);
    if (path.endsWith("/status")) { json(res, 200, { enabled: !!row }); return; }
    if (path.endsWith("/unsubscribe")) { db.prepare("DELETE FROM push_subscriptions WHERE endpoint_hash=? AND user_id=?").run(key, identity.id); json(res, 200, { ok: true }); return; }
    if (!row) { json(res, 404, { error: "device_not_found" }); return; }
    const peer = req.socket.remoteAddress || "unknown";
    if (!this.storage.takeLimit(`push-test:${identity.id}`, 5, 3_600_000, this.now()) || !this.storage.takeLimit(`push-test-ip:${peer}`, 20, 3_600_000, this.now())) { json(res, 429, { error: "rate_limited" }); return; }
    const sub = validSubscription(JSON.parse(String(row.subscription_json)));
    if (!sub) { db.prepare("DELETE FROM push_subscriptions WHERE endpoint_hash=?").run(key); json(res, 410, { error: "device_expired" }); return; }
    const payload = JSON.stringify({ title: "Nexafia", body: "Este es tu aviso de prueba. Los avisos reales de La Plaza requieren conectar su backend.", tag: "nexafia-test" });
    try {
      await (this.config.send || ((s, p, o) => webpush.sendNotification(s, p, o)))(sub, payload, { vapidDetails: { subject: this.config.subject, publicKey: this.config.publicKey, privateKey: this.config.privateKey }, TTL: 60, timeout: 5000 });
      json(res, 200, { ok: true });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) { db.prepare("DELETE FROM push_subscriptions WHERE endpoint_hash=? AND user_id=?").run(key, identity.id); json(res, 410, { error: "device_expired" }); }
      else json(res, 503, { error: "push_delivery_failed" });
    }
  }
}
export async function handlePush(ctx: { storage: Storage | null; delivery: PushDelivery | null; identity: {id:string} | null; sessionHash: string | null; originValid: boolean }, req: IncomingMessage, res: ServerResponse, path: string) {
  if (!path.startsWith("/api/push/")) return false;
  if (!ctx.delivery) { req.resume(); json(res, path === "/api/push/options" && req.method === "GET" ? 200 : 503, path === "/api/push/options" && req.method === "GET" ? { available: false } : { error: "push_unavailable" }); return true; }
  await ctx.delivery.handle(req, res, path, ctx.identity, ctx.sessionHash, ctx.originValid); return true;
}
