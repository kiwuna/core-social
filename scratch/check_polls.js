const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const databasePath = path.join(__dirname, "..", "database", "core.db");
const db = new sqlite3.Database(databasePath);

db.serialize(() => {
  console.log("--- POLLS ---");
  db.all("SELECT * FROM polls", [], (err, rows) => {
    if (err) console.error(err);
    console.log(JSON.stringify(rows, null, 2));
  });

  console.log("--- POSTS WITH POLLS ---");
  db.all("SELECT p.id, p.content, pl.question FROM posts p JOIN polls pl ON p.id = pl.post_id", [], (err, rows) => {
    if (err) console.error(err);
    console.log(JSON.stringify(rows, null, 2));
    db.close();
  });
});
