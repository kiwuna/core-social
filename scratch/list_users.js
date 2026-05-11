const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'database', 'core.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, username FROM users", (err, rows) => {
  if (err) {
    console.error("Error reading users:", err);
  } else {
    console.log("Users in database:");
    console.table(rows);
  }
  db.close();
});
