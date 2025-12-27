const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to database");

    const sqlFile = path.join(__dirname, "create-notifications-table.sql");
    const sql = fs.readFileSync(sqlFile, "utf8");

    console.log("Running migration...");
    await client.query(sql);
    console.log("✅ Notifications table created successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

runMigration();
