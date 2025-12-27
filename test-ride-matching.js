// Inline implementation for testing
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function isRouteMatch(
  driverStart,
  driverEnd,
  passengerPickup,
  passengerDestination,
  maxDistance = 2
) {
  const pickupDistance = calculateHaversineDistance(
    driverStart.lat,
    driverStart.lng,
    passengerPickup.lat,
    passengerPickup.lng
  );

  const destinationDistance = calculateHaversineDistance(
    driverEnd.lat,
    driverEnd.lng,
    passengerDestination.lat,
    passengerDestination.lng
  );

  return pickupDistance <= maxDistance && destinationDistance <= maxDistance;
}

function extractCoordinates(location) {
  try {
    const parenMatch = location.match(/\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/);
    if (parenMatch) {
      return {
        lat: parseFloat(parenMatch[1]),
        lng: parseFloat(parenMatch[2]),
      };
    }

    const commaMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (commaMatch) {
      return {
        lat: parseFloat(commaMatch[1]),
        lng: parseFloat(commaMatch[2]),
      };
    }

    return null;
  } catch (error) {
    console.error("Error extracting coordinates:", error);
    return null;
  }
}

console.log("🚗 Ride Matching Logic Test\n");
console.log("=".repeat(60));

// Test Case 1: Match - Driver Mumbai Central → Bandra, Passenger nearby
console.log("\n📍 TEST CASE 1: MATCHING ROUTE");
console.log("-".repeat(60));

const driver1Start = { lat: 19.1975, lng: 72.8362 }; // Mumbai Central
const driver1End = { lat: 19.0596, lng: 72.8295 }; // Bandra

const passenger1Pickup = { lat: 19.1967, lng: 72.8347 }; // Mumbai Central Station
const passenger1Dest = { lat: 19.0625, lng: 72.8311 }; // Bandra West

console.log("Driver Route:");
console.log(
  `  Start: Mumbai Central (${driver1Start.lat}, ${driver1Start.lng})`
);
console.log(`  End: Bandra (${driver1End.lat}, ${driver1End.lng})`);

console.log("\nPassenger Route:");
console.log(
  `  Pickup: Mumbai Central Station (${passenger1Pickup.lat}, ${passenger1Pickup.lng})`
);
console.log(
  `  Destination: Bandra West (${passenger1Dest.lat}, ${passenger1Dest.lng})`
);

const pickupDist1 = calculateHaversineDistance(
  driver1Start.lat,
  driver1Start.lng,
  passenger1Pickup.lat,
  passenger1Pickup.lng
);
const destDist1 = calculateHaversineDistance(
  driver1End.lat,
  driver1End.lng,
  passenger1Dest.lat,
  passenger1Dest.lng
);

console.log("\nDistances:");
console.log(`  Pickup distance: ${pickupDist1.toFixed(2)} km`);
console.log(`  Destination distance: ${destDist1.toFixed(2)} km`);

const match1 = isRouteMatch(
  driver1Start,
  driver1End,
  passenger1Pickup,
  passenger1Dest,
  2
);
console.log(
  `\n${match1 ? "✅ MATCH" : "❌ NO MATCH"} (within 2 km threshold)\n`
);

// Test Case 2: No Match - Driver Mumbai Central → Bandra, Passenger Andheri → Borivali
console.log("=".repeat(60));
console.log("\n📍 TEST CASE 2: NON-MATCHING ROUTE");
console.log("-".repeat(60));

const driver2Start = { lat: 19.1975, lng: 72.8362 }; // Mumbai Central
const driver2End = { lat: 19.0596, lng: 72.8295 }; // Bandra

const passenger2Pickup = { lat: 19.1136, lng: 72.8697 }; // Andheri
const passenger2Dest = { lat: 19.2403, lng: 72.8543 }; // Borivali

console.log("Driver Route:");
console.log(
  `  Start: Mumbai Central (${driver2Start.lat}, ${driver2Start.lng})`
);
console.log(`  End: Bandra (${driver2End.lat}, ${driver2End.lng})`);

console.log("\nPassenger Route:");
console.log(
  `  Pickup: Andheri (${passenger2Pickup.lat}, ${passenger2Pickup.lng})`
);
console.log(
  `  Destination: Borivali (${passenger2Dest.lat}, ${passenger2Dest.lng})`
);

const pickupDist2 = calculateHaversineDistance(
  driver2Start.lat,
  driver2Start.lng,
  passenger2Pickup.lat,
  passenger2Pickup.lng
);
const destDist2 = calculateHaversineDistance(
  driver2End.lat,
  driver2End.lng,
  passenger2Dest.lat,
  passenger2Dest.lng
);

console.log("\nDistances:");
console.log(`  Pickup distance: ${pickupDist2.toFixed(2)} km`);
console.log(`  Destination distance: ${destDist2.toFixed(2)} km`);

const match2 = isRouteMatch(
  driver2Start,
  driver2End,
  passenger2Pickup,
  passenger2Dest,
  2
);
console.log(
  `\n${match2 ? "✅ MATCH" : "❌ NO MATCH"} (within 2 km threshold)\n`
);

// Test Case 3: Coordinate Extraction
console.log("=".repeat(60));
console.log("\n📍 TEST CASE 3: COORDINATE EXTRACTION");
console.log("-".repeat(60));

const locationStrings = [
  "Mumbai Central (19.197500, 72.836200)",
  "Bandra Railway Station (19.054070, 72.840950)",
  "Just a location name without coordinates",
  "19.1975, 72.8362",
];

locationStrings.forEach((location) => {
  const coords = extractCoordinates(location);
  console.log(`\nInput: "${location}"`);
  if (coords) {
    console.log(`  ✅ Extracted: (${coords.lat}, ${coords.lng})`);
  } else {
    console.log(`  ❌ No coordinates found`);
  }
});

// Test Case 4: Edge Cases - Boundary Testing
console.log("\n" + "=".repeat(60));
console.log("\n📍 TEST CASE 4: BOUNDARY TESTING (2 km threshold)");
console.log("-".repeat(60));

const driverStart = { lat: 19.1975, lng: 72.8362 };
const driverEnd = { lat: 19.0596, lng: 72.8295 };

const testCases = [
  {
    name: "Exactly at boundary",
    pickupLat: 19.1795,
    pickupLng: 72.8362,
    destLat: 19.0416,
    destLng: 72.8295,
  },
  {
    name: "Just inside boundary",
    pickupLat: 19.1965,
    pickupLng: 72.8352,
    destLat: 19.0606,
    destLng: 72.8305,
  },
  {
    name: "Just outside boundary",
    pickupLat: 19.1755,
    pickupLng: 72.8362,
    destLat: 19.0386,
    destLng: 72.8295,
  },
];

testCases.forEach((testCase) => {
  const pickupDist = calculateHaversineDistance(
    driverStart.lat,
    driverStart.lng,
    testCase.pickupLat,
    testCase.pickupLng
  );
  const destDist = calculateHaversineDistance(
    driverEnd.lat,
    driverEnd.lng,
    testCase.destLat,
    testCase.destLng
  );

  const match = isRouteMatch(
    driverStart,
    driverEnd,
    { lat: testCase.pickupLat, lng: testCase.pickupLng },
    { lat: testCase.destLat, lng: testCase.destLng },
    2
  );

  console.log(`\n${testCase.name}:`);
  console.log(
    `  Pickup: (${testCase.pickupLat}, ${
      testCase.pickupLng
    }) - Distance: ${pickupDist.toFixed(2)} km`
  );
  console.log(
    `  Destination: (${testCase.destLat}, ${
      testCase.destLng
    }) - Distance: ${destDist.toFixed(2)} km`
  );
  console.log(`  Result: ${match ? "✅ MATCH" : "❌ NO MATCH"}`);
});

console.log("\n" + "=".repeat(60));
console.log("\n✅ All tests completed!\n");
