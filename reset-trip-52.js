const { Pool } = require("pg");
require("dotenv").config();

async function resetTrip52() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log(
      "🔄 Resetting Trip 52 to original format (without coordinates)...\n"
    );

    const oldStartLocation =
      "NEIL GOGTE INSTITUTE OF TECHNOLOGY | Parvathapur, Peerzadiguda, Hyderabad, Telangana, India";
    const oldEndLocation =
      "Bommak Gangaiah Convention | Convention Hall In Uppal | chilka road, Rajashekar Colony, Mallikarjuna Nagar, Boduppal, Secunderabad, Telangana, India";

    console.log("Start location:", oldStartLocation);
    console.log("End location:", oldEndLocation);

    const result = await pool.query(
      `UPDATE trips 
       SET start_location = $1, end_location = $2, updated_at = NOW()
       WHERE trip_id = 52
       RETURNING trip_id, start_location, end_location`,
      [oldStartLocation, oldEndLocation]
    );

    if (result.rows.length > 0) {
      console.log("\n✅ Trip 52 reset successfully (no embedded coordinates)!");
      console.log(
        "\nNow the hybrid matching system will use Google Distance Matrix API"
      );
    } else {
      console.log("\n❌ Trip 52 not found");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

resetTrip52();
