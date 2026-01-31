const { Pool } = require("postgres");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  console.log("\n🔧 Running status column length fix migration...\n");

  try {
    const sqlPath = path.join(__dirname, "fix-status-column-length.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Execute the migration
    const result = await pool.query(sql);
    console.log("✅ Migration executed successfully!\n");

    // Show verification results
    if (result.rows && result.rows.length > 0) {
      console.log("📊 Column lengths after migration:");
      result.rows.forEach((row) => {
        console.log(
          `   ${row.table_name}.${row.column_name}: varchar(${row.character_maximum_length})`
        );
      });
    }

    console.log("\n✅ Status columns can now handle:");
    console.log('   • "cancelled_by_passenger" (23 chars)');
    console.log('   • "cancelled_by_rider" (20 chars)');
    console.log("   • All existing status values\n");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
