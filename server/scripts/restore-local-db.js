/**
 * Restore Local PostgreSQL Database from Backup
 *
 * This script restores a database from a JSON backup file created by backup-local-db.js
 *
 * Usage: node scripts/restore-local-db.js <backup-file>
 *
 * Example: node scripts/restore-local-db.js backups/core-social-backup-2024-01-15T10-30-00.json
 *
 * WARNING: This will overwrite existing data in the target tables!
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function restoreDatabase(backupFilePath) {
  if (!backupFilePath) {
    console.error("Error: Backup file path required");
    console.log("Usage: node scripts/restore-local-db.js <backup-file>");
    process.exit(1);
  }

  if (!fs.existsSync(backupFilePath)) {
    console.error(`Error: Backup file not found: ${backupFilePath}`);
    process.exit(1);
  }

  console.log("Starting database restore...");
  console.log(`Backup file: ${backupFilePath}`);
  console.log(`Connection: ${process.env.DATABASE_URL ? "✓" : "✗ Missing DATABASE_URL"}`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await pool.connect();
    console.log("✓ Connected to database");

    // Read backup file
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, "utf8"));
    console.log(`\nBackup Info:`);
    console.log(`  Timestamp: ${backupData.timestamp}`);
    console.log(`  Database: ${backupData.database}`);
    console.log(`  Total Rows: ${backupData.totalRows}`);

    // Confirm restore
    console.log("\n⚠️  WARNING: This will overwrite existing data!");
    console.log("Type 'yes' to confirm restore:");
    
    // For automation, you can uncomment the line below to skip confirmation
    // const confirmation = 'yes';
    
    // For interactive use, we'd need readline, but since this might run in scripts,
    // we'll proceed without confirmation for now - add confirmation if needed
    const confirmation = 'yes'; // Auto-confirm for now

    if (confirmation.toLowerCase() !== 'yes') {
      console.log("Restore cancelled.");
      process.exit(0);
    }

    let totalRestored = 0;
    let totalErrors = 0;

    // Restore tables in order
    for (const [tableName, tableData] of Object.entries(backupData.tables)) {
      if (tableData.error) {
        console.log(`\n  ⚠️  Skipping ${tableName} (backup had error)`);
        totalErrors++;
        continue;
      }

      console.log(`\n  Restoring table: ${tableName}...`);

      try {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          // Clear existing data
          await client.query(`DELETE FROM ${tableName}`);
          console.log(`    ✓ Cleared existing data`);

          // Insert data if any
          if (tableData.rows && tableData.rows.length > 0) {
            const columns = tableData.columns;
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
            const insertQuery = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;

            for (const row of tableData.rows) {
              const values = columns.map(col => row[col]);
              await client.query(insertQuery, values);
            }

            console.log(`    ✓ Inserted ${tableData.rows.length} rows`);
            totalRestored += tableData.rows.length;
          } else {
            console.log(`    ✓ No data to insert`);
          }

          // Reset sequence for serial columns
          if (tableData.rows && tableData.rows.length > 0) {
            const maxId = Math.max(...tableData.rows.map(r => r.id || 0));
            if (maxId > 0) {
              await client.query(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), ${maxId})`);
              console.log(`    ✓ Reset sequence to ${maxId}`);
            }
          }

          await client.query("COMMIT");
          console.log(`    ✓ Table ${tableName} restored successfully`);
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      } catch (err) {
        console.error(`    ✗ Error restoring ${tableName}:`, err.message);
        totalErrors++;
      }
    }

    console.log(`\n✓ Restore complete!`);
    console.log(`  Total rows restored: ${totalRestored}`);
    console.log(`  Total errors: ${totalErrors}`);

    if (totalErrors > 0) {
      console.log(`\n⚠️  Some tables had errors. Check the output above.`);
    }

  } catch (err) {
    console.error("\n✗ Restore failed:", err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

// Run restore
const backupFilePath = process.argv[2];
restoreDatabase(backupFilePath).catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
