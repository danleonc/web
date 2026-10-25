-- Frozen schema before image and safety support; synthetic migration fixture.

      BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, alias TEXT NOT NULL, password_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS blocks(user_id TEXT NOT NULL REFERENCES accounts(id), blocked_id TEXT NOT NULL REFERENCES accounts(id), PRIMARY KEY(user_id,blocked_id), CHECK(user_id<>blocked_id));
      CREATE TABLE IF NOT EXISTS offerings(activity_id TEXT PRIMARY KEY, starts_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS reservations(user_id TEXT NOT NULL REFERENCES accounts(id), activity_id TEXT NOT NULL REFERENCES offerings(activity_id), created_at INTEGER NOT NULL, PRIMARY KEY(user_id,activity_id));
      CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY, activity_id TEXT NOT NULL REFERENCES offerings(activity_id), session_json TEXT NOT NULL, revision INTEGER NOT NULL, idle_at INTEGER NOT NULL, archived_at INTEGER);
      CREATE UNIQUE INDEX IF NOT EXISTS active_room ON rooms(activity_id) WHERE archived_at IS NULL;
      CREATE TABLE IF NOT EXISTS memberships(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES accounts(id), PRIMARY KEY(room_id,user_id));
      CREATE TABLE IF NOT EXISTS messages(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, id TEXT NOT NULL, sender_id TEXT NOT NULL REFERENCES accounts(id), client_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(room_id,id), UNIQUE(room_id,sender_id,client_id));
      CREATE TABLE IF NOT EXISTS receipts(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, request_id TEXT NOT NULL, message_id TEXT NOT NULL, PRIMARY KEY(room_id,request_id));
      CREATE TABLE IF NOT EXISTS auth_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, until_at INTEGER NOT NULL);
      PRAGMA user_version=1;
      COMMIT;
    
