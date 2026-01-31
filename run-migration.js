const { Client } = require("postgres");
const fs = require("fs");

async function runMigration() {
  const client = new Client({
    connectionString:
      "postgresql://postgres.xevvrvhhznpxycfaryya:root@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
  });

  try {
    await client.connect();
    console.log("Connected to database");

    const migrationSql = fs.readFileSync(
      "./drizzle/create_new_coupons_table.sql",
      "utf8"
    );
    console.log("Running migration...");

    const result = await client.query(migrationSql);
    console.log("Migration completed successfully");
    console.log("Result:", result);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

runMigration();
