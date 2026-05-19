const { Client } = require("pg");
require("dotenv").config();

async function promoteSoko() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found in environment variables.");
    process.exit(1);
  }

  console.log("Connecting to PostgreSQL...");
  const client = new Client({ connectionString });

  try {
    await client.connect();
    
    // Check if soko exists
    const resCheck = await client.query("SELECT id, username, role FROM users WHERE username = $1", ["soko"]);
    if (resCheck.rowCount === 0) {
      console.log("User 'soko' not found in database yet. We will still ensure automatic promotion on login!");
    } else {
      const user = resCheck.rows[0];
      console.log(`Found user: ${user.username} with role: ${user.role}`);
    }

    // Perform update
    const resUpdate = await client.query("UPDATE users SET role = 'ceo' WHERE username = $1 RETURNING id, username, role", ["soko"]);
    
    if (resUpdate.rowCount > 0) {
      console.log("SUCCESS! User 'soko' has been promoted to 'ceo' role.");
      console.table(resUpdate.rows);
    } else {
      console.log("Could not update role directly (user does not exist in DB yet).");
    }
  } catch (err) {
    console.error("Error executing query:", err.message);
  } finally {
    await client.end();
  }
}

promoteSoko();
