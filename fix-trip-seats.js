// Script to increase available seats for a trip
require("dotenv").config();
const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
const { trips } = require("./drizzle/schema");
const { eq } = require("drizzle-orm");

async function fixTripSeats() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL not found in .env file");
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    const tripId = 39; // Change this to the trip ID you want to fix
    const newSeatCount = 3; // Change this to the number of seats you want

    console.log(
      `Updating trip ${tripId} to have ${newSeatCount} available seats...`
    );

    const result = await db
      .update(trips)
      .set({
        seats: newSeatCount,
        updatedAt: new Date(),
      })
      .where(eq(trips.tripId, tripId))
      .returning();

    if (result.length > 0) {
      console.log("✅ Trip updated successfully!");
      console.log("Updated trip:", {
        tripId: result[0].tripId,
        seats: result[0].seats,
        status: result[0].status,
        active: result[0].active,
      });
    } else {
      console.log("❌ Trip not found");
    }
  } catch (error) {
    console.error("Error updating trip:", error);
  } finally {
    await client.end();
  }
}

fixTripSeats();
