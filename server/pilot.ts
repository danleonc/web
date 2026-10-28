import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { googleFromEnv } from "./google.ts";
import { smtpMailer } from "./email.ts";
import { createRoomServer } from "./app.ts";
const publicOrigin = process.env.ENTRE_PUBLIC_ORIGIN;
if (!publicOrigin)
  throw new Error(
    "ENTRE_PUBLIC_ORIGIN is required. See docs/CUENTAS_Y_DESPLIEGUE.md.",
  );
const origin = new URL(publicOrigin);
if (origin.origin !== publicOrigin || origin.username || origin.password)
  throw new Error("Use an exact origin without credentials or trailing slash.");
const local = ["localhost", "127.0.0.1"].includes(origin.hostname);
if (origin.protocol !== "https:" && !(local && origin.protocol === "http:"))
  throw new Error("A public account service requires HTTPS.");
const port = Number(process.env.PORT || 8788);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid PORT");
const host = process.env.ENTRE_BIND || "127.0.0.1";
if (!["127.0.0.1", "0.0.0.0"].includes(host))
  throw new Error("Unsupported ENTRE_BIND");
const root = resolve("dist-pilot");
if (
  JSON.parse(readFileSync(resolve(root, "entre-build.json"), "utf8")).mode !==
  "accounts"
)
  throw new Error("Run npm run build:pilot before npm start");
const app = createRoomServer({
  sendVerificationEmail: smtpMailer(),
  google: googleFromEnv(process.env,origin.origin),
  databasePath:
    process.env.ENTRE_DATABASE_PATH || resolve(".data/entre.sqlite"),
  staticRoot: root,
  allowedOrigins: [origin.origin],
  secureCookies: origin.protocol === "https:",
});
app.server.listen(port, host, () =>
  console.log(`Entre account service ready on port ${port}.`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
