/**
 * Backup Local PostgreSQL Database
 *
 * This script creates a backup of the local PostgreSQL database
 * by exporting table data to JSON files and optionally to SQL.
 *
 * Usage: node scripts/backup-local-db.js
 *
 * Output: Creates a 'backups' directory with timestamped backup files
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const backupDir = path.join(__dirname, "..", "backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
const backupFileName = `core-social-backup-${timestamp}`;

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Tables to backup (in dependency order - parents before children)
const tables = [
  "users",
  "posts",
  "likes",
  "reposts",
  "comments",
  "polls",
  "poll_options",
  "poll_votes",
  "follows",
  "verification_codes",
  "messages",
  "push_subscriptions",
  "notifications",
  "post_impressions",
  "post_view_events",
  "post_view_aggregates",
  "reports",
  "session"
];

async function backupDatabase() {
  console.log("Starting database backup...");
  console.log(`Connection: ${process.env.DATABASE_URL ? "✓" : "✗ Missing DATABASE_URL"}`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await pool.connect();
    console.log("✓ Connected to database");

    const backupData = {
      timestamp: new Date().toISOString(),
      database: process.env.DATABASE_URL?.split("/").pop() || "unknown",
      tables: {}
    };

    let totalRows = 0;

    for (const table of tables) {
      console.log(`  Backing up table: ${table}...`);

      try {
        const result = await pool.query(`SELECT * FROM ${table}`);
        const rowCount = result.rowCount || 0;
        totalRows += rowCount;

        backupData.tables[table] = {
          rowCount,
          columns: result.fields.map(f => f.name),
          rows: result.rows
        };

        console.log(`    ✓ ${rowCount} rows`);
      } catch (err) {
        console.error(`    ✗ Error backing up ${table}:`, err.message);
        backupData.tables[table] = {
          error: err.message,
          rowCount: 0,
          columns: [],
          rows: []
        };
      }
    }

    backupData.totalRows = totalRows;

    // Write JSON backup
    const jsonPath = path.join(backupDir, `${backupFileName}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(backupData, null, 2));
    console.log(`\n✓ JSON backup created: ${jsonPath}`);

    // Write summary
    const summaryPath = path.join(backupDir, `${backupFileName}-summary.txt`);
    const summary = `
Core Social Database Backup Summary
====================================
Timestamp: ${backupData.timestamp}
Database: ${backupData.database}
Total Rows: ${totalRows}

Table Breakdown:
${tables.map(table => {
  const t = backupData.tables[table];
  const count = t.error ? "ERROR" : t.rowCount;
  return `  ${table}: ${count}`;
}).join("\n")}

Files Created:
  - ${path.basename(jsonPath)}
  - ${path.basename(summaryPath)}

To restore this backup, use the restore-local-db.js script.
`;
    fs.writeFileSync(summaryPath, summary);
    console.log(`✓ Summary created: ${summaryPath}`);

    console.log(`\n✓ Backup complete! Total rows: ${totalRows}`);
    console.log(`  Location: ${backupDir}`);

  } catch (err) {
    console.error("\n✗ Backup failed:", err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

// Run backup
backupDatabase().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
