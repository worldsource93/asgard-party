import { createClient } from '@libsql/client';
export async function openDatabase(url = process.env.DATABASE_URL || 'file:local.db') {
  const db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  await db.executeMultiple(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
      recovery TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      nickname TEXT NOT NULL, server TEXT NOT NULL, job TEXT NOT NULL, power INTEGER NOT NULL,
      level INTEGER NOT NULL, intro TEXT NOT NULL, availability TEXT NOT NULL,
      dungeons TEXT NOT NULL, public INTEGER NOT NULL DEFAULT 0,
      verified_power INTEGER, verified_level INTEGER, verified_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS parties (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL, dungeon TEXT NOT NULL, schedule TEXT NOT NULL, roles TEXT NOT NULL,
      description TEXT NOT NULL, contact TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS party_members (
      party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY(party_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
    CREATE INDEX IF NOT EXISTS parties_owner ON parties(owner_id);
    CREATE TABLE IF NOT EXISTS verification_requests (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      nickname TEXT NOT NULL, server TEXT NOT NULL, power INTEGER NOT NULL, level INTEGER NOT NULL,
      evidence TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const columns = (await db.execute('PRAGMA table_info(verification_requests)')).rows;
  if (!columns.some(column => column.name === 'request_id')) {
    await db.execute('ALTER TABLE verification_requests ADD COLUMN request_id TEXT');
    await db.execute('UPDATE verification_requests SET request_id=lower(hex(randomblob(16))) WHERE request_id IS NULL');
  }
  for (const field of ['profile_power', 'profile_level']) {
    if (!columns.some(column => column.name === field)) {
      await db.execute(`ALTER TABLE verification_requests ADD COLUMN ${field} INTEGER`);
    }
  }
  await db.execute(`CREATE TABLE IF NOT EXISTS verification_images (
    request_id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    mime TEXT NOT NULL, image BLOB NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS verification_decisions (
    request_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, decision TEXT NOT NULL,
    note TEXT NOT NULL, reviewer_id TEXT NOT NULL, reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  return db;
}
