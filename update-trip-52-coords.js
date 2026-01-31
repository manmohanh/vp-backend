const { Pool } = require("postgres");
require("dotenv").config();

async function updateTrip52() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("📝 Updating Trip 52 with coordinate format...\n");

    // NEIL GOGTE INSTITUTE OF TECHNOLOGY coordinates: 17.3961993, 78.6224957
    // Bommak Gangaiah Convention coordinates: 17.419272, 78.574107

    const newStartLocation =
      "NEIL GOGTE INSTITUTE OF TECHNOLOGY (17.3961993, 78.6224957)";
    const newEndLocation =
      "Bommak Gangaiah Convention | Convention Hall In Uppal (17.419272, 78.574107)";

    console.log("New start location:", newStartLocation);
    console.log("New end location:", newEndLocation);

    const result = await pool.query(
      `UPDATE trips 
       SET start_location = $1, end_location = $2, updated_at = NOW()
       WHERE trip_id = 52
       RETURNING trip_id, start_location, end_location`,
      [newStartLocation, newEndLocation]
    );

    if (result.rows.length > 0) {
      console.log("\n✅ Trip 52 updated successfully!");
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log("\n❌ Trip 52 not found");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

updateTrip52();
