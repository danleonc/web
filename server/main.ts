import { createRoomServer } from "./app.ts";
if (process.env.NODE_ENV === "production")
  throw new Error(
    "This server is a local development lab, not a production service.",
  );
const testPort = process.env.NEXAFIA_TEST_PORT;
if (testPort && (!/^[1-9]\d{0,4}$/.test(testPort) || Number(testPort)>65535))
  throw new Error("Invalid local test port");
const app = createRoomServer(testPort ? { allowedOrigins: [
  "http://localhost:4173", "http://127.0.0.1:4173",
  "http://localhost:5173", "http://127.0.0.1:5173",
  `http://127.0.0.1:${testPort}`,
] } : undefined);
app.server.listen(8787, "127.0.0.1", () =>
  console.log(
    "Shared-room development API ready on port 8787 (loopback only).",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
