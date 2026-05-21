const { Pool } = require("pg");
require("dotenv").config();

// Create a connection pool to PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // If using a cloud provider like Supabase/Neon, you might need SSL
  // ssl: { rejectUnauthorized: false }
});

pool.on("connect", () => {
  console.log("Connected to PostgreSQL database.");
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err.message);
});

// Initialize tables
const initDb = async () => {
  try {
    // Users table
    await pool.query(`
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
        email TEXT,
        is_synced BOOLEAN DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT FALSE,
        sync_code TEXT,
        last_sync_request BIGINT,
        warnings INTEGER DEFAULT 0,
        warning_reasons TEXT[] DEFAULT '{}'::TEXT[],
        is_banned BOOLEAN DEFAULT FALSE,
        role TEXT DEFAULT 'user',
        acknowledged_warnings INTEGER DEFAULT 0,
        suspended_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns if they don't exist
    const runAlter = async (query) => {
      try {
        await pool.query(query);
      } catch (err) {
        // Suppress expected column-exists errors
      }
    };

    await runAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT');
    await runAlter('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key');
    await runAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_synced BOOLEAN DEFAULT FALSE');
    await runAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE');
    await runAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS sync_code TEXT');
    await runAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sync_request BIGINT');
    await runAlter('ALTER TABLE users ALTER COLUMN last_sync_request TYPE BIGINT USING (EXTRACT(EPOCH FROM last_sync_request) * 1000)::BIGINT');
    await runAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS warnings INTEGER DEFAULT 0');
    await runAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS warning_reasons TEXT[] DEFAULT \'{}\'::TEXT[]');
    await runAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE');
    await runAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT \'user\'');
    await runAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS acknowledged_warnings INTEGER DEFAULT 0');
    await runAlter('ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP WITH TIME ZONE DEFAULT NULL');

    // Create reports table
    await runAlter(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, reporter_id)
      )
    `);

    // Posts table
    await pool.query(`
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

    // Likes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id)
      )
    `);

    // Comments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Polls table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS polls (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Poll Options table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS poll_options (
        id SERIAL PRIMARY KEY,
        poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
        option_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Poll Votes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS poll_votes (
        id SERIAL PRIMARY KEY,
        poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
        option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(poll_id, user_id)
      )
    `);

    // Follows table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id),
        CHECK (follower_id != following_id)
      )
    `);

    // Verification codes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Push subscriptions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await runAlter('CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id)');

    // Notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL, -- 'like', 'follow', 'comment'
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Session table (for connect-pg-simple)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      ) WITH (OIDS=FALSE)
    `);
    
    // Add primary key and index separately to avoid errors if they exist
    try {
      await pool.query('ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE');
    } catch (e) {} // Ignore if already exists
    
    try {
      await pool.query('CREATE INDEX "IDX_session_expire" ON "session" ("expire")');
    } catch (e) {} // Ignore if already exists

    console.log("PostgreSQL tables initialized.");
  } catch (error) {
    console.error("Error initializing PostgreSQL tables:", error.message);
  }
};

initDb();

module.exports = pool;
