import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to database");

    // Read the migration SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, "../drizzle/coupon_schema_migration.sql"),
      "utf8"
    );

    console.log("Running coupon schema migration...");

    // Execute the migration
    await client.query(migrationSQL);

    console.log("Migration completed successfully!");

    // Verify the new schema
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'coupons'
      ORDER BY ordinal_position;
    `);

    console.log("New coupon table schema:");
    console.table(result.rows);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

runMigration();
