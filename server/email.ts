import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import type { IncomingMessage } from "node:http";
import nodemailer from "nodemailer";
import { Storage, digest } from "./storage.ts";
export type SendVerificationEmail = (
  email: string,
  code: string,
) => Promise<void>;

export function smtpMailer(
  env: NodeJS.ProcessEnv = process.env,
): SendVerificationEmail | undefined {
  if (!env.ENTRE_SMTP_HOST) return undefined;
  const port = Number(env.ENTRE_SMTP_PORT || 465);
  const secure = port === 465;
  if (
    ![465, 587].includes(port) ||
    !env.ENTRE_SMTP_USER ||
    !env.ENTRE_SMTP_PASSWORD ||
    !env.ENTRE_MAIL_FROM
  )
    throw Error("Configura SMTP con TLS, usuario, contraseña y remitente.");
  const transporter = nodemailer.createTransport({
    host: env.ENTRE_SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: { user: env.ENTRE_SMTP_USER, pass: env.ENTRE_SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return async (email, code) => {
    await transporter.sendMail({
      from: env.ENTRE_MAIL_FROM,
      to: email,
      subject: "Confirma tu correo en Afinia",
      text: `Tu código de Afinia es ${code}. Caduca en 10 minutos y solo puede usarse una vez. No lo compartas. Si no solicitaste este mensaje, puedes ignorarlo.`,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  };
}
const fail = (status: number, error: string) => ({ status, body: { error } });
export class EmailConfirmation {
  constructor(
    storage: Storage,
    now: () => number,
    send?: SendVerificationEmail,
  ) {
    this.storage = storage;
    this.now = now;
    this.send = send;
  }
  private codeSecret = randomBytes(32);
  private hashCode(id: string, code: string) {
    return createHmac("sha256", this.codeSecret)
      .update(`${id}:${code}`)
      .digest("hex");
  }
  storage: Storage;
  now: () => number;
  send?: SendVerificationEmail;
  async action(
    path: string,
    value: Record<string, unknown>,
    id: string,
    req: IncomingMessage,
  ) {
    const now = this.now(),
      db = this.storage.db;
    const ip = req.socket.remoteAddress || "local";
    if (path === "email-code") {
      if (
        Object.keys(value).some((k) => !["email", "adult"].includes(k)) ||
        value.adult !== true ||
        typeof value.email !== "string"
      )
        return fail(422, "invalid_email_declaration");
      const email = value.email.trim().toLowerCase();
      if (
        email.length > 254 ||
        !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
          email,
        )
      )
        return fail(422, "invalid_email_declaration");
      if (!this.send) return fail(503, "email_unavailable");
      const old = this.storage.emailStatus(id);
      if (old?.verifiedAt != null) return fail(409, "email_already_confirmed");
      if (
        (old && now - old.lastSent < 60_000) ||
        !this.storage.takeLimit(
          digest(`mail-ip:${ip}`),
          15,
          60 * 60_000,
          now,
        ) ||
        !this.storage.takeLimit(
          digest(`mail-user:${id}`),
          5,
          60 * 60_000,
          now,
        ) ||
        !this.storage.takeLimit(
          digest(`mail-target:${email}`),
          5,
          60 * 60_000,
          now,
        )
      )
        return fail(429, "email_rate_limited");
      const used = db
        .prepare(
          "SELECT user_id FROM account_emails WHERE email=? AND user_id<>? AND verified_at IS NOT NULL",
        )
        .get(email, id);
      if (used) return fail(409, "email_unavailable_for_account");
      const code = randomInt(100_000_000).toString().padStart(8, "0");
      const hash = this.hashCode(id, code);
      db.prepare(
        "INSERT INTO account_emails(user_id,email,adult_declared_at,code_hash,code_until,last_sent) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email, adult_declared_at=excluded.adult_declared_at, code_hash=excluded.code_hash, code_until=excluded.code_until, last_sent=excluded.last_sent, attempts=0",
      ).run(id, email, now, hash, now + 600_000, now);
      try {
        await this.send(email, code);
      } catch {
        db.prepare(
          "UPDATE account_emails SET code_hash=NULL, code_until=0 WHERE user_id=? AND code_hash=?",
        ).run(id, hash);
        return fail(503, "email_delivery_failed");
      }
      return { status: 200, body: { ok: true } };
    }
    if (
      Object.keys(value).some((k) => k !== "code") ||
      typeof value.code !== "string" ||
      !/^\d{8}$/.test(value.code)
    )
      return fail(422, "invalid_confirmation_code");
    if (
      !this.storage.takeLimit(digest(`confirm-ip:${ip}`), 60, 15 * 60_000, now)
    )
      return fail(429, "email_rate_limited");
    return this.storage.transaction(() => {
      const row = this.storage.emailStatus(id);
      if (
        !row?.codeHash ||
        row.verifiedAt != null ||
        row.codeUntil <= now ||
        row.attempts >= 5
      )
        return fail(422, "invalid_confirmation_code");
      db.prepare(
        "UPDATE account_emails SET attempts=attempts+1 WHERE user_id=?",
      ).run(id);
      if (
        !timingSafeEqual(
          Buffer.from(row.codeHash, "hex"),
          Buffer.from(this.hashCode(id, value.code as string), "hex"),
        )
      )
        return fail(422, "invalid_confirmation_code");
      if (
        db
          .prepare(
            "SELECT 1 FROM account_emails WHERE email=? AND user_id<>? AND verified_at IS NOT NULL",
          )
          .get(row.email, id)
      )
        return fail(409, "email_unavailable_for_account");
      db.prepare(
        "UPDATE account_emails SET verified_at=?, code_hash=NULL, code_until=0 WHERE user_id=?",
      ).run(now, id);
      return { status: 200, body: { ok: true } };
    });
  }
}
