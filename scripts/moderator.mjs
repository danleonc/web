import { Storage } from "../server/storage.ts";
import { ModerationStore } from "../server/moderation.ts";
import { access } from "node:fs/promises";
const [
  operation,
  username,
  path = process.env.ENTRE_DATABASE_PATH || ".data/entre.sqlite",
] = process.argv.slice(2);
if (!["promote", "revoke"].includes(operation) || !username)
  throw Error(
    "Usage: node scripts/moderator.mjs promote|revoke EXISTING_USERNAME [DATABASE_PATH]",
  );
await access(path);
const storage = new Storage(path);
try {
  new ModerationStore(storage, Date.now).role(
    username,
    operation === "promote",
  );
  console.log("Moderator role updated for the existing account.");
} finally {
  storage.close();
}
