const { db } = require("./dist/db");
const { trips } = require("./dist/db/schema");

async function checkTrips() {
  console.log(
    "================================================================================"
  );
  console.log("🔍 CHECKING TRIPS IN DATABASE");
  console.log(
    "================================================================================\n"
  );

  const allTrips = await db.select().from(trips);

  console.log(`Total trips: ${allTrips.length}\n`);

  for (const trip of allTrips) {
    console.log(
      `─────────────────────────────────────────────────────────────────────────────`
    );
    console.log(`Trip ID: ${trip.tripId}`);
    console.log(`Status: ${trip.status}`);
    console.log(`From: ${trip.from}`);
    console.log(`To: ${trip.to}`);
    console.log(`Created: ${trip.createdAt}`);
    console.log();
  }

  process.exit(0);
}

checkTrips().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
