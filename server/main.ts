import { createRoomServer } from "./app.ts";
if (process.env.NODE_ENV === "production")
  throw new Error(
    "This server is a local development lab, not a production service.",
  );
const app = createRoomServer();
app.server.listen(8787, "127.0.0.1", () =>
  console.log(
    "Shared-room development API ready on port 8787 (loopback only).",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
