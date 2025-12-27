import axios from "axios";

/**
 * Calculate straight-line distance between two points using Haversine formula
 *
 * IMPORTANT: This returns STRAIGHT-LINE (as the crow flies) distance.
 * For actual road/driving distance, use Google Distance Matrix API.
 *
 * Formula: Haversine formula for great-circle distance
 * Earth radius: 6371.0 km (mean radius)
 *
 * @param lat1 - Latitude of point 1 in decimal degrees
 * @param lon1 - Longitude of point 1 in decimal degrees
 * @param lat2 - Latitude of point 2 in decimal degrees
 * @param lon2 - Longitude of point 2 in decimal degrees
 * @returns Distance in kilometers (straight-line)
 *
 * @example
 * // Distance between two points in Hyderabad
 * const distance = calculateHaversineDistance(17.3850, 78.4867, 17.4239, 78.4738);
 * // Returns: ~4.5 km (straight line)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Earth's mean radius in kilometers
  // Using 6371.0 km as per International Union of Geodesy and Geophysics
  const EARTH_RADIUS_KM = 6371.0;

  // Convert latitude and longitude differences to radians
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  // Convert latitudes to radians
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  // Haversine formula
  // a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  // c = 2 * atan2(√a, √(1-a))
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Distance = R * c
  const distanceKm = EARTH_RADIUS_KM * c;

  // Round to 2 decimal places for practical use
  return Math.round(distanceKm * 100) / 100;
}

/**
 * Convert degrees to radians
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Normalize coordinate to 6 decimal places (~0.11 meter precision)
 * This ensures consistent comparison and prevents floating-point precision issues
 *
 * @param coordinate - Latitude or longitude value
 * @returns Normalized coordinate rounded to 6 decimal places
 *
 * @example
 * normalizeCoordinate(17.38500123456) // Returns: 17.385001
 * normalizeCoordinate(78.48670987654) // Returns: 78.486710
 */
export function normalizeCoordinate(coordinate: number): number {
  return Math.round(coordinate * 1000000) / 1000000;
}

/**
 * Normalize a coordinate pair (lat, lng)
 *
 * @param coords - Coordinate object with lat and lng
 * @returns Normalized coordinate object
 */
export function normalizeCoordinates(coords: { lat: number; lng: number }): {
  lat: number;
  lng: number;
} {
  return {
    lat: normalizeCoordinate(coords.lat),
    lng: normalizeCoordinate(coords.lng),
  };
}

/**
 * Format location string with normalized coordinates
 *
 * @param locationName - Human-readable location name
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Formatted string: "Location Name (lat, lng)"
 */
export function formatLocationWithCoords(
  locationName: string,
  lat: number,
  lng: number
): string {
  const normalizedLat = normalizeCoordinate(lat);
  const normalizedLng = normalizeCoordinate(lng);
  return `${locationName} (${normalizedLat}, ${normalizedLng})`;
}

/**
 * Check if a passenger's route fits within a driver's route
 * Returns true if:
 * - Passenger pickup (C) is within maxDistance km of driver start (A)
 * - Passenger destination (D) is within maxDistance km of driver end (B)
 */
export function isRouteMatch(
  driverStart: { lat: number; lng: number },
  driverEnd: { lat: number; lng: number },
  passengerPickup: { lat: number; lng: number },
  passengerDestination: { lat: number; lng: number },
  maxDistance: number = 2
): boolean {
  // Normalize all coordinates before comparison
  const normalizedDriverStart = normalizeCoordinates(driverStart);
  const normalizedDriverEnd = normalizeCoordinates(driverEnd);
  const normalizedPassengerPickup = normalizeCoordinates(passengerPickup);
  const normalizedPassengerDest = normalizeCoordinates(passengerDestination);

  console.log("\n🔍 DETAILED ROUTE MATCHING:");
  console.log(
    "   📍 Driver Start (original):    ",
    JSON.stringify(driverStart)
  );
  console.log(
    "   📍 Driver Start (normalized):  ",
    JSON.stringify(normalizedDriverStart)
  );
  console.log("   📍 Driver End (original):      ", JSON.stringify(driverEnd));
  console.log(
    "   📍 Driver End (normalized):    ",
    JSON.stringify(normalizedDriverEnd)
  );
  console.log(
    "   📍 Passenger Pickup (original):",
    JSON.stringify(passengerPickup)
  );
  console.log(
    "   📍 Passenger Pickup (norm):    ",
    JSON.stringify(normalizedPassengerPickup)
  );
  console.log(
    "   📍 Passenger Drop (original):  ",
    JSON.stringify(passengerDestination)
  );
  console.log(
    "   📍 Passenger Drop (norm):      ",
    JSON.stringify(normalizedPassengerDest)
  );

  // Calculate distance between driver start (A) and passenger pickup (C)
  const pickupDistance = calculateHaversineDistance(
    normalizedDriverStart.lat,
    normalizedDriverStart.lng,
    normalizedPassengerPickup.lat,
    normalizedPassengerPickup.lng
  );

  // Calculate distance between driver end (B) and passenger destination (D)
  const destinationDistance = calculateHaversineDistance(
    normalizedDriverEnd.lat,
    normalizedDriverEnd.lng,
    normalizedPassengerDest.lat,
    normalizedPassengerDest.lng
  );

  console.log("\n   📏 HAVERSINE DISTANCE CALCULATIONS:");
  console.log(
    `      A → C (Driver Start → Passenger Pickup): ${pickupDistance.toFixed(
      6
    )} km`
  );
  console.log(
    `      B → D (Driver End → Passenger Drop):     ${destinationDistance.toFixed(
      6
    )} km`
  );
  console.log(`      Max allowed distance: ${maxDistance} km`);

  // SPECIAL CASE: If coordinates are identical or nearly identical (<0.1 km)
  // Force match regardless of maxDistance
  const EXACT_MATCH_THRESHOLD = 0.1; // 100 meters
  const isExactPickupMatch = pickupDistance < EXACT_MATCH_THRESHOLD;
  const isExactDropMatch = destinationDistance < EXACT_MATCH_THRESHOLD;

  if (isExactPickupMatch && isExactDropMatch) {
    console.log("\n   ✅ EXACT/NEAR-EXACT MATCH DETECTED!");
    console.log(
      `      Pickup distance: ${pickupDistance.toFixed(
        6
      )} km < ${EXACT_MATCH_THRESHOLD} km ✅`
    );
    console.log(
      `      Drop distance: ${destinationDistance.toFixed(
        6
      )} km < ${EXACT_MATCH_THRESHOLD} km ✅`
    );
    console.log(
      "      🎯 FORCE MATCH: Coordinates are identical or nearly identical\n"
    );
    return true;
  }

  // NORMAL CASE: Check if within maxDistance (default 2 km)
  const pickupWithinRange = pickupDistance <= maxDistance;
  const dropWithinRange = destinationDistance <= maxDistance;
  const isMatch = pickupWithinRange && dropWithinRange;

  console.log("\n   📊 MATCHING DECISION:");
  console.log(
    `      Pickup within ${maxDistance} km? ${
      pickupWithinRange ? "✅ YES" : "❌ NO"
    } (${pickupDistance.toFixed(3)} km)`
  );
  console.log(
    `      Drop within ${maxDistance} km?   ${
      dropWithinRange ? "✅ YES" : "❌ NO"
    } (${destinationDistance.toFixed(3)} km)`
  );
  console.log(`      Final Result: ${isMatch ? "✅ MATCH" : "❌ NO MATCH"}\n`);

  return isMatch;
}

/**
 * Extract coordinates from location string
 * Supports formats:
 * - "Location Name (lat, lng)"
 * - "lat,lng"
 * Returns null if coordinates cannot be extracted
 */
export function extractCoordinates(
  location: string
): { lat: number; lng: number } | null {
  try {
    // Try to extract from format: "Location Name (lat, lng)"
    const parenMatch = location.match(/\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/);
    if (parenMatch) {
      return normalizeCoordinates({
        lat: parseFloat(parenMatch[1]),
        lng: parseFloat(parenMatch[2]),
      });
    }

    // Try to extract from format: "lat,lng"
    const commaMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (commaMatch) {
      return normalizeCoordinates({
        lat: parseFloat(commaMatch[1]),
        lng: parseFloat(commaMatch[2]),
      });
    }

    return null;
  } catch (error) {
    console.error("Error extracting coordinates:", error);
    return null;
  }
}

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

const getComponent = (
  components: AddressComponent[],
  types: string[]
): string => {
  return (
    components.find((c) => types.some((t) => c.types.includes(t)))?.long_name ||
    ""
  );
};

type ReverseGeocodeResult = {
  fullAddress: string;
  area: string;
  city: string;
  shortAddress: string;
};

export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult | null> => {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          latlng: `${latitude},${longitude}`,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (response.data.status !== "OK") return null;

    const result = response.data.results[0];
    const components: AddressComponent[] = result.address_components;

    const area =
      getComponent(components, ["sublocality", "neighborhood"]) ||
      getComponent(components, ["sublocality_level_1"]);

    const city =
      getComponent(components, ["locality"]) ||
      getComponent(components, ["administrative_area_level_2"]);

    const shortAddress = [area, city].filter(Boolean).join(", ");

    return {
      fullAddress: result.formatted_address,
      area,
      city,
      shortAddress,
    };
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return null;
  }
};
