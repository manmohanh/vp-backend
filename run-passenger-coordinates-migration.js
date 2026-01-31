const { Client } = require("postgres");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔗 Connecting to database...");
    await client.connect();
    console.log("✅ Connected to database");

    console.log("\n📝 Reading migration file...");
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, "drizzle", "add_passenger_coordinates.sql"),
      "utf8"
    );

    console.log("🚀 Running migration...");
    await client.query(migrationSQL);
    console.log("✅ Migration completed successfully!");

    console.log("\n📊 Verifying columns...");
    const result = await client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      AND column_name IN ('pickup_latitude', 'pickup_longitude', 'dropoff_latitude', 'dropoff_longitude')
      ORDER BY column_name;
    `);

    console.log("\n✅ Passenger coordinate columns:");
    result.rows.forEach((row) => {
      console.log(
        `   - ${row.column_name}: ${row.data_type}(${row.numeric_precision},${row.numeric_scale})`
      );
    });
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("\n👋 Database connection closed");
  }
}

runMigration();
