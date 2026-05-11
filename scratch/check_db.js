const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'server', 'db', 'core.db'));

db.serialize(() => {
  console.log('Checking for orphaned posts...');
  db.all("SELECT id, user_id FROM posts WHERE user_id NOT IN (SELECT id FROM users)", (err, rows) => {
    if (err) console.error(err);
    console.log('Orphaned posts:', rows);
  });
  
  console.log('Checking all users...');
  db.all("SELECT id, username FROM users", (err, rows) => {
    if (err) console.error(err);
    console.log('Users in DB:', rows);
  });
});
db.close();
