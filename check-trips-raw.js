const { db } = require("./dist/db");
const { sql } = require("drizzle-orm");

async function checkTripsRaw() {
  console.log(
    "================================================================================"
  );
  console.log("🔍 CHECKING TRIPS - RAW SQL QUERY");
  console.log(
    "================================================================================\n"
  );

  const result = await db.execute(sql`
    SELECT trip_id, status, start_location, end_location, created_at 
    FROM trips 
    WHERE status = 'scheduled'
    ORDER BY trip_id DESC 
    LIMIT 5
  `);

  console.log(`Found ${result.rows.length} scheduled trips:\n`);

  for (const row of result.rows) {
    console.log(
      `─────────────────────────────────────────────────────────────────────────────`
    );
    console.log(`Trip ID: ${row.trip_id}`);
    console.log(`Status: ${row.status}`);
    console.log(`From: ${row.start_location}`);
    console.log(`To: ${row.end_location}`);
    console.log(`Created: ${row.created_at}`);
    console.log();
  }

  process.exit(0);
}

checkTripsRaw().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
