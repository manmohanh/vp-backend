const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("postgres");
require("dotenv").config();

// Haversine distance calculation (same as backend)
function calculateHaversineDistance(coord1, coord2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

// Extract coordinates from location string
function extractCoordinates(locationString) {
  if (!locationString) return null;

  const regex = /\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/;
  const match = locationString.match(regex);

  if (match) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2]),
    };
  }

  return null;
}

async function debugRideMatching() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Passenger search coordinates
    const passengerPickup = {
      lat: 17.396199300000003,
      lng: 78.6224957,
    };

    const passengerDestination = {
      lat: 17.419272,
      lng: 78.57410709999999,
    };

    console.log("🔍 DEBUGGING RIDE MATCHING\n");
    console.log("Passenger Search:");
    console.log(`   Pickup: (${passengerPickup.lat}, ${passengerPickup.lng})`);
    console.log(
      `   Destination: (${passengerDestination.lat}, ${passengerDestination.lng})`
    );
    console.log("\n" + "=".repeat(80) + "\n");

    // Get all active scheduled trips
    const result = await pool.query(`
      SELECT trip_id, start_location, end_location, status, active, seats
      FROM trips 
      WHERE status = 'scheduled' AND active = true
      ORDER BY trip_id
    `);

    console.log(`Found ${result.rows.length} active scheduled trips\n`);

    result.rows.forEach((trip) => {
      console.log(`\n📍 Trip ${trip.trip_id}:`);
      console.log(`   Start: ${trip.start_location}`);
      console.log(`   End: ${trip.end_location}`);
      console.log(`   Seats: ${trip.seats}`);

      const driverStart = extractCoordinates(trip.start_location);
      const driverEnd = extractCoordinates(trip.end_location);

      if (!driverStart || !driverEnd) {
        console.log(
          "   ⚠️  Cannot extract coordinates - trip locations missing coordinate format"
        );
        return;
      }

      console.log(
        `   Driver Start Coords: (${driverStart.lat}, ${driverStart.lng})`
      );
      console.log(`   Driver End Coords: (${driverEnd.lat}, ${driverEnd.lng})`);

      // Calculate distances
      const pickupDistance = calculateHaversineDistance(
        driverStart,
        passengerPickup
      );
      const destinationDistance = calculateHaversineDistance(
        driverEnd,
        passengerDestination
      );

      console.log(`\n   📏 Distance Analysis:`);
      console.log(
        `      Driver Start → Passenger Pickup: ${pickupDistance.toFixed(2)} km`
      );
      console.log(
        `      Driver End → Passenger Destination: ${destinationDistance.toFixed(
          2
        )} km`
      );

      const maxDistance = 2; // 2 km threshold
      const pickupMatch = pickupDistance <= maxDistance;
      const destinationMatch = destinationDistance <= maxDistance;

      console.log(`\n   ✓ Matching Logic (2 km threshold):`);
      console.log(
        `      Pickup Match: ${
          pickupMatch ? "✅" : "❌"
        } (${pickupDistance.toFixed(2)} km ${pickupMatch ? "≤" : ">"} 2 km)`
      );
      console.log(
        `      Destination Match: ${
          destinationMatch ? "✅" : "❌"
        } (${destinationDistance.toFixed(2)} km ${
          destinationMatch ? "≤" : ">"
        } 2 km)`
      );

      const isMatch = pickupMatch && destinationMatch;
      console.log(
        `\n   ${isMatch ? "✅ MATCH" : "❌ NO MATCH"} - ${
          isMatch ? "This ride should be shown" : "This ride should be hidden"
        }`
      );
      console.log("\n" + "-".repeat(80));
    });

    console.log("\n\n📊 SUMMARY:");
    const matchingTrips = result.rows.filter((trip) => {
      const driverStart = extractCoordinates(trip.start_location);
      const driverEnd = extractCoordinates(trip.end_location);

      if (!driverStart || !driverEnd) return false;

      const pickupDistance = calculateHaversineDistance(
        driverStart,
        passengerPickup
      );
      const destinationDistance = calculateHaversineDistance(
        driverEnd,
        passengerDestination
      );

      return pickupDistance <= 2 && destinationDistance <= 2;
    });

    console.log(`Total trips: ${result.rows.length}`);
    console.log(`Matching trips: ${matchingTrips.length}`);
    console.log(
      `Non-matching trips: ${result.rows.length - matchingTrips.length}`
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

debugRideMatching();
