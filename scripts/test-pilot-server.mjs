// Isolated browser-test service: dates are bypassed only in this fixture.
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Storage, digest } from "../server/storage.ts";
import { passwordHash } from "../server/auth.ts";
import { ModerationStore } from "../server/moderation.ts";
import { mockGoogle } from "../tests/server/mock-google.mjs";
import { createRoomServer } from "../server/app.ts";
const directory = await mkdtemp(join(tmpdir(), "entre-browser-pilot-"));
// This role and password exist ONLY in the private browser-test fixture.
const setup = new Storage(join(directory, "test.sqlite"));
setup.createAccount(
  {
    id: randomUUID(),
    username: "moderator_fixture",
    alias: "Moderación de prueba",
    passwordHash: await passwordHash("Una clave exclusiva del fixture 123"),
    recoveryHash: digest(randomUUID()),
  },
  Date.now(),
);
const moderator = setup.account("moderator_fixture");
setup.db
  .prepare(
    "INSERT INTO account_emails(user_id,email,verified_at,adult_declared_at) VALUES(?,?,?,?)",
  )
  .run(moderator.id, "moderator@example.test", Date.now(), Date.now());
const mailbox = join(tmpdir(), "afinia-test-pilot-mailbox");
await rm(mailbox, { recursive: true, force: true });
await mkdir(mailbox, { mode: 0o700 });
new ModerationStore(setup, Date.now).role("moderator_fixture", true);
setup.close();
const app = createRoomServer({
  databasePath: join(directory, "test.sqlite"),
  google: await mockGoogle("http://127.0.0.1:4190"),
  sendVerificationEmail: async (email, code) => {
    await writeFile(
      join(mailbox, createHash("sha256").update(email).digest("hex") + ".json"),
      JSON.stringify({ code }),
      { mode: 0o600 },
    );
  },
  staticRoot: resolve("dist-pilot"),
  allowedOrigins: ["http://127.0.0.1:4190"],
  enforceSchedule: false,
});
app.server.listen(4190, "127.0.0.1", () =>
  console.log("Isolated account browser-test fixture ready."),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    void app
      .close()
      .then(() => rm(directory, { recursive: true, force: true }))
      .then(() => rm(mailbox, { recursive: true, force: true }))
      .then(() => process.exit(0));
  });
