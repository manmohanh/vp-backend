const { Pool } = require("postgres");
require("dotenv").config();

async function verifyMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔍 Verifying migration...");
    console.log("");

    // Check the bookings table structure
    const result = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      AND column_name IN ('payment_status', 'payment_method', 'payment_received_at', 'payment_confirmed_by')
      ORDER BY column_name;
    `);

    if (result.rows.length === 4) {
      console.log("✅ All COD payment columns exist in bookings table:");
      console.log("");
      result.rows.forEach((row) => {
        console.log(`  ✓ ${row.column_name}`);
        console.log(`    Type: ${row.data_type}`);
        if (row.column_default) {
          console.log(`    Default: ${row.column_default}`);
        }
        console.log("");
      });
      console.log("✅ Migration verification successful!");
      console.log("");
      console.log("🚀 Your backend is ready to accept COD bookings!");
    } else {
      console.log("⚠️  Warning: Not all columns were created");
      console.log(
        "Found columns:",
        result.rows.map((r) => r.column_name).join(", ")
      );
    }
  } catch (error) {
    console.error("❌ Verification failed:", error.message);
  } finally {
    await pool.end();
  }
}

verifyMigration();
