const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg");
const path = require("path");
require("dotenv").config();

const sqliteDbPath = path.join(__dirname, "..", "database", "core.db");
const sqliteDb = new sqlite3.Database(sqliteDbPath);

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  console.log("Starting migration from SQLite to PostgreSQL...");

  // 1. Ensure tables exist in PostgreSQL
  console.log("Ensuring PostgreSQL tables exist...");
  
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      emoji TEXT NOT NULL,
      bio TEXT DEFAULT '',
      is_premium INTEGER NOT NULL DEFAULT 0,
      avatar_path TEXT,
      display_name TEXT,
      banner_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      image_path TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      font_style TEXT DEFAULT 'default',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS likes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS polls (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS poll_options (
      id SERIAL PRIMARY KEY,
      poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      option_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS poll_votes (
      id SERIAL PRIMARY KEY,
      poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(poll_id, user_id)
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS follows (
      id SERIAL PRIMARY KEY,
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id),
      CHECK (follower_id != following_id)
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    ) WITH (OIDS=FALSE)
  `);
  
  try {
    await pgPool.query('ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE');
  } catch (e) {}
  
  try {
    await pgPool.query('CREATE INDEX "IDX_session_expire" ON "session" ("expire")');
  } catch (e) {}

  // 2. Migrate data
  const tables = ["users", "posts", "likes", "comments", "polls", "poll_options", "poll_votes", "follows"];

  for (const table of tables) {
    console.log(`Migrating table: ${table}...`);
    
    const rows = await new Promise((resolve, reject) => {
      sqliteDb.all(`SELECT * FROM ${table}`, (err, rows) => {
        if (err) resolve([]); // Table might not exist in SQLite
        else resolve(rows);
      });
    });

    if (rows.length === 0) {
      console.log(`No data in ${table}, skipping.`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const colNames = columns.join(", ");

    const insertQuery = `INSERT INTO ${table} (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    for (const row of rows) {
      const values = columns.map(col => row[col]);
      await pgPool.query(insertQuery, values);
    }
    
    // Reset the sequence for serial IDs
    await pgPool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`);
    
    console.log(`Finished migrating ${table}.`);
  }

  console.log("Migration complete!");
  sqliteDb.close();
  await pgPool.end();
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
