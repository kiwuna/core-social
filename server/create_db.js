const { Client } = require("pg");
require("dotenv").config();

async function createDatabase() {
  // Parse the DATABASE_URL to get credentials, but connect to 'postgres' DB first
  const connectionString = process.env.DATABASE_URL;
  const dbName = connectionString.split("/").pop().split("?")[0];
  const baseUrl = connectionString.substring(0, connectionString.lastIndexOf("/") + 1) + "postgres";

  console.log(`Connecting to ${baseUrl} to create database "${dbName}"...`);

  const client = new Client({
    connectionString: baseUrl,
  });

  try {
    await client.connect();
    
    // Check if database exists
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    
    if (res.rowCount === 0) {
      console.log(`Database "${dbName}" does not exist. Creating...`);
      // CREATE DATABASE cannot be run in a transaction, and pg driver handles this fine with client.query
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created successfully!`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.error("Error creating database:", err.message);
  } finally {
    await client.end();
  }
}

createDatabase();
