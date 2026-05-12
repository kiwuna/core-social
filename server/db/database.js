const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const serverRoot = path.join(__dirname, "..");
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(serverRoot, process.env.DATABASE_PATH)
  : path.join(serverRoot, "..", "database", "core.db");

const db = new sqlite3.Database(databasePath, (error) => {
  if (error) {
    console.error("Database connection error:", error.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

db.serialize(() => {
  // Create Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      emoji TEXT NOT NULL,
      bio TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Posts table (with user_id for new installations)
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      image_path TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (createError) => {
    if (createError) {
      console.error("Could not create posts table:", createError.message);
    }
  });

  // Create Likes table (tracks individual user likes)
  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `);

  // Create Comments table
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create Polls table
  db.run(`
    CREATE TABLE IF NOT EXISTS polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `);

  // Create Poll Options table
  db.run(`
    CREATE TABLE IF NOT EXISTS poll_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id INTEGER NOT NULL,
      option_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
    )
  `);

  // Create Poll Votes table
  db.run(`
    CREATE TABLE IF NOT EXISTS poll_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id INTEGER NOT NULL,
      option_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(poll_id, user_id),
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
      FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Migration logic for existing installations
  db.all(`PRAGMA table_info(posts)`, [], (error, columns) => {
    if (error) {
      console.error("Could not inspect posts table:", error.message);
      return;
    }

    const hasLikesColumn = columns.some((column) => column.name === "likes");
    const hasImagePathColumn = columns.some((column) => column.name === "image_path");
    const hasUserIdColumn = columns.some((column) => column.name === "user_id");

    if (!hasLikesColumn) {
      db.run(`ALTER TABLE posts ADD COLUMN likes INTEGER NOT NULL DEFAULT 0`);
    }

    if (!hasImagePathColumn) {
      db.run(`ALTER TABLE posts ADD COLUMN image_path TEXT`);
    }

    if (!hasUserIdColumn) {
      // Adding user_id as nullable for existing posts (Anonymous)
      db.run(`ALTER TABLE posts ADD COLUMN user_id INTEGER REFERENCES users(id)`);
    }
  });

  // Migration for users table (bio, is_premium, avatar_path columns)
  db.serialize(() => {
    db.all(`PRAGMA table_info(users)`, [], (error, columns) => {
      if (error) {
        console.error("Could not inspect users table:", error.message);
        return;
      }
      const hasBioColumn = columns.some((c) => c.name === "bio");
      const hasPremiumColumn = columns.some((c) => c.name === "is_premium");
      const hasAvatarColumn = columns.some((c) => c.name === "avatar_path");
      const hasDisplayName = columns.some((c) => c.name === "display_name");
 
      const hasBannerColumn = columns.some((c) => c.name === "banner_path");
 
      if (!hasBioColumn) {
        console.log("Adding bio column to users table...");
        db.run(`ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''`, (err) => {
          if (err) console.error("Error adding bio column:", err.message);
          else console.log("Bio column added.");
        });
      }
      if (!hasPremiumColumn) {
        console.log("Adding is_premium column to users table...");
        db.run(`ALTER TABLE users ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0`, (err) => {
          if (err) console.error("Error adding is_premium column:", err.message);
          else console.log("is_premium column added.");
        });
      }
      if (!hasAvatarColumn) {
        console.log("Adding avatar_path column to users table...");
        db.run(`ALTER TABLE users ADD COLUMN avatar_path TEXT`, (err) => {
          if (err) console.error("Error adding avatar_path column:", err.message);
          else console.log("avatar_path column added.");
        });
      }
      if (!hasDisplayName) {
        console.log("Adding display_name column to users table...");
        db.run(`ALTER TABLE users ADD COLUMN display_name TEXT`, (err) => {
          if (err) console.error("Error adding display_name column:", err.message);
          else console.log("display_name column added.");
        });
      }
      if (!hasBannerColumn) {
        console.log("Adding banner_path column to users table...");
        db.run(`ALTER TABLE users ADD COLUMN banner_path TEXT`, (err) => {
          if (err) console.error("Error adding banner_path column:", err.message);
          else console.log("Banner column added.");
        });
      }
    });
  });

  // Migration for posts table (font_style column)
  db.serialize(() => {
    db.all(`PRAGMA table_info(posts)`, [], (error, columns) => {
      if (error) return;
      const hasFontStyle = columns.some((c) => c.name === "font_style");
      if (!hasFontStyle) {
        console.log("Adding font_style column to posts table...");
        db.run(`ALTER TABLE posts ADD COLUMN font_style TEXT DEFAULT 'default'`, (err) => {
          if (err) console.error("Error adding font_style column:", err.message);
          else console.log("font_style column added.");
        });
      }
    });
  });
});

module.exports = db;
