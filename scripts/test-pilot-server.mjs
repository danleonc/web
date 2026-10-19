// Isolated browser-test service: dates are bypassed only in this fixture.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRoomServer } from "../server/app.ts";
const directory = await mkdtemp(join(tmpdir(), "entre-browser-pilot-"));
const app = createRoomServer({
  databasePath: join(directory, "test.sqlite"),
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
      .then(() => process.exit(0));
  });
