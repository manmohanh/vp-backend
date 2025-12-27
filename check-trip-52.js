const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
require("dotenv").config();

async function checkTrip52() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  try {
    console.log("🔍 Checking Trip 52 in database...\n");

    const result = await pool.query(
      "SELECT trip_id, start_location, end_location, departure_time, status, active FROM trips WHERE trip_id = 52"
    );

    if (result.rows.length === 0) {
      console.log("❌ Trip 52 not found in database");
    } else {
      console.log("✅ Trip 52 found:");
      console.log(JSON.stringify(result.rows[0], null, 2));

      const trip = result.rows[0];
      console.log("\n📍 Location Analysis:");
      console.log(
        `   Start Location: ${
          trip.start_location === null ? "NULL" : `"${trip.start_location}"`
        }`
      );
      console.log(
        `   End Location: ${
          trip.end_location === null ? "NULL" : `"${trip.end_location}"`
        }`
      );
      console.log(`   Status: ${trip.status}`);
      console.log(`   Active: ${trip.active}`);
    }

    console.log("\n🔍 Checking all trips with null locations...\n");
    const nullLocations = await pool.query(
      "SELECT trip_id, start_location, end_location, status FROM trips WHERE start_location IS NULL OR end_location IS NULL"
    );

    if (nullLocations.rows.length > 0) {
      console.log(
        `⚠️  Found ${nullLocations.rows.length} trips with null locations:`
      );
      nullLocations.rows.forEach((trip) => {
        console.log(
          `   Trip ${trip.trip_id}: start=${
            trip.start_location === null ? "NULL" : "OK"
          }, end=${trip.end_location === null ? "NULL" : "OK"}`
        );
      });
    } else {
      console.log("✅ No trips with null locations found");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

checkTrip52();
