const { Client } = require("postgres");
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

    const sqlFile = path.join(__dirname, "add-push-token-column.sql");
    const sql = fs.readFileSync(sqlFile, "utf8");

    console.log("Running migration...");
    await client.query(sql);
    console.log("✅ Push token column added successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
  } finally {
    await client.end();
  }
}

runMigration();
