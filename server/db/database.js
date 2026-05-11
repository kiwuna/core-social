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
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      image_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (createError) => {
    if (createError) {
      console.error("Could not create posts table:", createError.message);
    }
  });

  db.all(`PRAGMA table_info(posts)`, [], (error, columns) => {
    if (error) {
      console.error("Could not inspect posts table:", error.message);
      return;
    }

    const hasLikesColumn = columns.some((column) => column.name === "likes");
    const hasImagePathColumn = columns.some((column) => column.name === "image_path");

    if (!hasLikesColumn) {
      db.run(
        `ALTER TABLE posts ADD COLUMN likes INTEGER NOT NULL DEFAULT 0`,
        (alterError) => {
          if (alterError) {
            console.error("Could not add likes column:", alterError.message);
          }
        }
      );
    }

    if (!hasImagePathColumn) {
      db.run(
        `ALTER TABLE posts ADD COLUMN image_path TEXT`,
        (alterError) => {
          if (alterError) {
            console.error("Could not add image_path column:", alterError.message);
          }
        }
      );
    }
  });
});

module.exports = db;
