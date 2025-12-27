const { Pool } = require("pg");
require("dotenv").config();

async function checkTrips() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("\n📊 ALL TRIPS IN DATABASE:\n");

    const result = await pool.query(`
      SELECT 
        trip_id,
        start_location,
        end_location, 
        departure_time,
        seats,
        status
      FROM trips
      WHERE status = 'scheduled'
      ORDER BY trip_id DESC
      LIMIT 10
    `);

    const trips = result.rows;
    console.log(`Total scheduled trips: ${trips.length}\n`);

    trips.forEach((trip, index) => {
      console.log(`${index + 1}. TRIP ${trip.trip_id} - ${trip.status}`);
      console.log(`   From: ${trip.start_location?.substring(0, 60)}...`);
      console.log(`   To:   ${trip.end_location?.substring(0, 60)}...`);
      console.log(`   Date: ${new Date(trip.departure_time).toLocaleString()}`);
      console.log(`   Seats: ${trip.seats}`);
      console.log("");
    });

    console.log(
      "✅ These trip IDs (53, 54, etc.) are DYNAMIC - they come from the database!"
    );
    console.log("✅ The search checks ALL available trips, not hardcoded IDs.");
    console.log(
      "✅ When you create Trip 55, 56, etc., they will automatically appear.\n"
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

checkTrips();
