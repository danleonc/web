import { access } from "node:fs/promises";
import { Storage } from "../server/storage.ts";
const [operation, username, path = process.env.ENTRE_DATABASE_PATH || ".data/entre.sqlite"] = process.argv.slice(2);
if (!['grant', 'revoke'].includes(operation) || !username) throw Error('Usage: node scripts/privacy-operator.mjs grant|revoke EXISTING_USERNAME [DATABASE_PATH]');
await access(path);
const storage = new Storage(path);
try {
  const account = storage.account(username.toLowerCase()); if (!account) throw Error('Account not found');
  if (operation === 'grant') storage.db.prepare('INSERT OR IGNORE INTO privacy_operators(user_id) VALUES(?)').run(account.id);
  else storage.db.prepare('DELETE FROM privacy_operators WHERE user_id=?').run(account.id);
  console.log('Privacy operator role updated for the existing account.');
} finally { storage.close(); }
