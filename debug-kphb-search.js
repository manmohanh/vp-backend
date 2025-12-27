const { db } = require("./src/db");
const { trips } = require("./src/db/schema");
const { eq, and } = require("drizzle-orm");
const {
  calculateHaversineDistance,
  isRouteMatch,
  normalizeCoordinates,
  extractCoordinates,
} = require("./src/utils/geoUtils");

async function debugKPHBSearch() {
  console.log(
    "================================================================================"
  );
  console.log("🔍 DEBUG: KPHB TO MADHAPUR SEARCH");
  console.log(
    "================================================================================"
  );

  // Search coordinates from the mobile app logs
  const passengerPickup = { lat: 17.493776, lng: 78.401703 }; // KPHB METRO
  const passengerDestination = { lat: 17.436768, lng: 78.40071 }; // Madhapur Metro

  console.log("\n📍 PASSENGER SEARCH COORDINATES:");
  console.log(
    `   Pickup:      KPHB METRO (${passengerPickup.lat}, ${passengerPickup.lng})`
  );
  console.log(
    `   Destination: Madhapur Metro (${passengerDestination.lat}, ${passengerDestination.lng})`
  );

  // Normalize passenger coordinates
  const normalizedPickup = normalizeCoordinates(passengerPickup);
  const normalizedDestination = normalizeCoordinates(passengerDestination);

  console.log("\n📍 NORMALIZED PASSENGER COORDINATES:");
  console.log(
    `   Pickup:      (${normalizedPickup.lat}, ${normalizedPickup.lng})`
  );
  console.log(
    `   Destination: (${normalizedDestination.lat}, ${normalizedDestination.lng})`
  );

  // Fetch all available trips
  const availableTrips = await db
    .select()
    .from(trips)
    .where(and(eq(trips.status, "scheduled")));

  console.log(`\n📊 Total available trips: ${availableTrips.length}`);

  if (availableTrips.length === 0) {
    console.log("\n❌ No trips found with status 'scheduled'");
    process.exit(0);
  }

  console.log("\n" + "=".repeat(80));
  console.log("CHECKING EACH TRIP");
  console.log("=".repeat(80));

  let matchedCount = 0;

  for (const trip of availableTrips) {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`🚗 TRIP ${trip.tripId}`);
    console.log(`${"─".repeat(80)}`);
    console.log(`   Status:         ${trip.status}`);
    console.log(`   Available Seats: ${trip.availableSeats}`);
    console.log(`   From:           ${trip.from}`);
    console.log(`   To:             ${trip.to}`);
    console.log(`   Departure:      ${trip.departureTime}`);

    // Extract coordinates from trip
    const driverStart = extractCoordinates(trip.from);
    const driverEnd = extractCoordinates(trip.to);

    console.log("\n   📍 EXTRACTED DRIVER COORDINATES:");
    if (driverStart) {
      console.log(`      Start: ${JSON.stringify(driverStart)}`);
    } else {
      console.log(`      Start: ❌ NOT FOUND (format: "${trip.from}")`);
    }

    if (driverEnd) {
      console.log(`      End:   ${JSON.stringify(driverEnd)}`);
    } else {
      console.log(`      End:   ❌ NOT FOUND (format: "${trip.to}")`);
    }

    if (!driverStart || !driverEnd) {
      console.log("\n   ❌ SKIPPED: Cannot extract coordinates from trip");
      continue;
    }

    // Calculate distances
    const pickupDistance = calculateHaversineDistance(
      driverStart.lat,
      driverStart.lng,
      normalizedPickup.lat,
      normalizedPickup.lng
    );

    const dropDistance = calculateHaversineDistance(
      driverEnd.lat,
      driverEnd.lng,
      normalizedDestination.lat,
      normalizedDestination.lng
    );

    console.log("\n   📏 DISTANCE CALCULATIONS:");
    console.log(
      `      Driver Start → Passenger Pickup:      ${pickupDistance.toFixed(
        6
      )} km`
    );
    console.log(
      `      Driver End → Passenger Destination:   ${dropDistance.toFixed(
        6
      )} km`
    );

    // Check if it's an exact match
    const isExactMatch = pickupDistance < 0.1 && dropDistance < 0.1;
    const isWithin2km = pickupDistance <= 2 && dropDistance <= 2;

    console.log("\n   📊 MATCHING ANALYSIS:");
    console.log(
      `      Exact/Near Match (<0.1 km):  ${isExactMatch ? "✅ YES" : "❌ NO"}`
    );
    console.log(
      `      Within 2 km threshold:       ${isWithin2km ? "✅ YES" : "❌ NO"}`
    );

    // Use the actual isRouteMatch function
    const isMatch = isRouteMatch(
      driverStart,
      driverEnd,
      normalizedPickup,
      normalizedDestination,
      2
    );

    console.log(
      `\n   🎯 FINAL RESULT: ${isMatch ? "✅ MATCH" : "❌ NO MATCH"}`
    );

    if (isMatch) {
      matchedCount++;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(
    `📈 SUMMARY: ${matchedCount} out of ${availableTrips.length} trips matched`
  );
  console.log("=".repeat(80));

  process.exit(0);
}

debugKPHBSearch().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
