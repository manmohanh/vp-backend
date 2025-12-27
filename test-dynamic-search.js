const { db } = require("./dist/db");
const { trips } = require("./dist/db/schema");
const { sql } = require("drizzle-orm");

// Inline Haversine function
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const EARTH_RADIUS_KM = 6371.0;
  const toRadians = (degrees) => degrees * (Math.PI / 180);

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = EARTH_RADIUS_KM * c;

  return Math.round(distanceKm * 100) / 100;
}

function normalizeCoordinates(coords) {
  const normalizeCoordinate = (coordinate) =>
    Math.round(coordinate * 1000000) / 1000000;
  return {
    lat: normalizeCoordinate(coords.lat),
    lng: normalizeCoordinate(coords.lng),
  };
}

async function testDynamicSearch() {
  console.log(
    "================================================================================"
  );
  console.log("🧪 TESTING DYNAMIC RIDE SEARCH");
  console.log(
    "================================================================================\n"
  );

  // Simulate passenger search: KPHB to Madhapur
  const passengerPickup = normalizeCoordinates({
    lat: 17.493776,
    lng: 78.401703,
  });
  const passengerDrop = normalizeCoordinates({ lat: 17.436768, lng: 78.40071 });

  console.log("📍 PASSENGER SEARCH (C → D):");
  console.log(
    `   C (Pickup): KPHB METRO (${passengerPickup.lat}, ${passengerPickup.lng})`
  );
  console.log(
    `   D (Drop):   Madhapur Metro (${passengerDrop.lat}, ${passengerDrop.lng})`
  );
  console.log(`\n🎯 RULE: A→C ≤ 2 km AND B→D ≤ 2 km\n`);

  // Fetch all scheduled trips
  const result = await db.execute(sql`
    SELECT trip_id, start_location, end_location, departure_time, seats, status
    FROM trips 
    WHERE status = 'scheduled' AND active = true
    ORDER BY trip_id DESC
  `);

  console.log(`📊 Found ${result.rows.length} scheduled trips in database\n`);
  console.log("=".repeat(80));
  console.log("CHECKING EACH TRIP DYNAMICALLY");
  console.log("=".repeat(80));

  let matchingTrips = [];

  for (const row of result.rows) {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`🚗 TRIP ${row.trip_id}`);
    console.log(`${"─".repeat(80)}`);
    console.log(
      `   Departure: ${new Date(row.departure_time).toLocaleString()}`
    );
    console.log(`   Seats: ${row.seats}`);
    console.log(`   Route (A → B):`);
    console.log(`      A: ${row.start_location}`);
    console.log(`      B: ${row.end_location}`);

    // Try to extract coordinates
    const extractCoords = (location) => {
      const match = location.match(/\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/);
      if (match) {
        return normalizeCoordinates({
          lat: parseFloat(match[1]),
          lng: parseFloat(match[2]),
        });
      }
      return null;
    };

    const driverStart = extractCoords(row.start_location);
    const driverEnd = extractCoords(row.end_location);

    console.log("\n   📍 EXTRACTED COORDINATES:");
    if (driverStart) {
      console.log(`      A: ${JSON.stringify(driverStart)} ✅`);
    } else {
      console.log(`      A: ❌ NOT FOUND (missing coordinates)`);
    }

    if (driverEnd) {
      console.log(`      B: ${JSON.stringify(driverEnd)} ✅`);
    } else {
      console.log(`      B: ❌ NOT FOUND (missing coordinates)`);
    }

    if (driverStart && driverEnd) {
      // Calculate distances
      const distanceAC = calculateHaversineDistance(
        driverStart.lat,
        driverStart.lng,
        passengerPickup.lat,
        passengerPickup.lng
      );

      const distanceBD = calculateHaversineDistance(
        driverEnd.lat,
        driverEnd.lng,
        passengerDrop.lat,
        passengerDrop.lng
      );

      console.log("\n   📏 HAVERSINE DISTANCES:");
      console.log(`      A→C: ${distanceAC.toFixed(6)} km`);
      console.log(`      B→D: ${distanceBD.toFixed(6)} km`);

      // Check if within 2 km threshold
      const isMatch = distanceAC <= 2 && distanceBD <= 2;
      const isExactMatch = distanceAC < 0.1 && distanceBD < 0.1;

      console.log("\n   🎯 MATCHING RESULT:");
      console.log(
        `      A→C ≤ 2 km? ${
          distanceAC <= 2 ? "✅ YES" : "❌ NO"
        } (${distanceAC.toFixed(3)} km)`
      );
      console.log(
        `      B→D ≤ 2 km? ${
          distanceBD <= 2 ? "✅ YES" : "❌ NO"
        } (${distanceBD.toFixed(3)} km)`
      );

      if (isExactMatch) {
        console.log(`      🎯 EXACT MATCH! (< 0.1 km) - FORCE MATCH`);
        matchingTrips.push({
          tripId: row.trip_id,
          distanceAC,
          distanceBD,
          combined: distanceAC + distanceBD,
        });
      } else if (isMatch) {
        console.log(`      ✅ MATCH CONFIRMED`);
        matchingTrips.push({
          tripId: row.trip_id,
          distanceAC,
          distanceBD,
          combined: distanceAC + distanceBD,
        });
      } else {
        console.log(`      ❌ NO MATCH - Exceeds 2 km threshold`);
      }
    } else {
      console.log(
        "\n   ⚠️  SKIPPED - Missing coordinates (cannot calculate Haversine distance)"
      );
      console.log(
        "   💡 Solution: Recreate trip with coordinates or add them manually"
      );
    }
  }

  // Sort matching trips by combined distance
  matchingTrips.sort((a, b) => a.combined - b.combined);

  console.log("\n" + "=".repeat(80));
  console.log("📊 FINAL RESULTS - NEAREST MATCHING TRIPS");
  console.log("=".repeat(80));
  console.log(`Total trips checked: ${result.rows.length}`);
  console.log(`Matching trips: ${matchingTrips.length}`);
  console.log(
    `Success rate: ${(
      (matchingTrips.length / result.rows.length) *
      100
    ).toFixed(1)}%\n`
  );

  if (matchingTrips.length > 0) {
    console.log("🎯 MATCHED TRIPS (sorted by proximity):\n");
    matchingTrips.forEach((trip, index) => {
      console.log(`   ${index + 1}. Trip ${trip.tripId}:`);
      console.log(
        `      A→C: ${trip.distanceAC.toFixed(
          3
        )} km | B→D: ${trip.distanceBD.toFixed(3)} km`
      );
      console.log(`      Combined distance: ${trip.combined.toFixed(3)} km`);
    });
  } else {
    console.log("⚠️  NO MATCHES FOUND\n");
    console.log("💡 Possible reasons:");
    console.log("   • No trips have coordinates embedded in location strings");
    console.log("   • All trips exceed the 2 km distance threshold");
    console.log("   • No trips scheduled for the searched date");
    console.log("\n🔧 Solution:");
    console.log(
      "   • Recreate trips using the updated mobile app (coordinates will be added)"
    );
    console.log("   • Or manually update existing trips with coordinates");
  }
  console.log("=".repeat(80) + "\n");

  process.exit(0);
}

testDynamicSearch().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
