import express, { Response, Request } from "express";
import { db } from "../db";
import { bookings, trips, users, vehicles } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import {
  eq,
  and,
  or,
  like,
  gte,
  lte,
  desc,
  asc,
  sql,
  getTableColumns,
  gt,
  ne,
} from "drizzle-orm";
import {
  calculateHaversineDistance,
  isRouteMatch,
  extractCoordinates,
  normalizeCoordinates,
  formatLocationWithCoords,
  reverseGeocode,
} from "../utils/geoUtils";
import googleMapsService from "../services/googleMaps.service";

export const createTrip = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      vehicleId,
      startAddress,
      endAddress,
      startLocation,
      endLocation,
      departureTime,
      arrivalTime,
      seats,
      trip_date,
      distanceFlexibility,
      timeFlexibility,
      expectedFare,
      remarks,
    } = req.body;

    console.log("body", req.body);

    // Validate required fields
    if (!vehicleId || !startLocation || !endLocation || !seats) {
      throw new Error(
        "Vehicle ID, start location, end location, and seats are required"
      );
    }

    // Convert vehicleId to integer
    const vehicleIdInt = parseInt(vehicleId);
    if (isNaN(vehicleIdInt)) {
      throw new Error("Vehicle ID must be a valid number");
    }

    // Check if vehicle exists and belongs to user
    const vehicle = await db.query.vehicles.findFirst({
      where: and(
        eq(vehicles.vehicleId, vehicleIdInt),
        eq(vehicles.userId, req.user!.userId)
      ),
    });

    if (!vehicle) {
      throw new Error("Vehicle not found or not owned by you");
    }

    // Check if vehicle is active
    if (!vehicle.active) {
      throw new Error("Vehicle is not active");
    }

    // Check if vehicle is verified
    // if (!vehicle.verified) {
    //   res.status(400).json({ error: "Vehicle is not verified yet" }); return;
    // }

    // Check if seats are valid
    if (!vehicle.capacity || seats > vehicle.capacity) {
      throw new Error(
        `Seats cannot exceed vehicle's maximum capacity of ${
          vehicle.capacity || "unknown"
        }`
      );
    }

    // Validate flexibility values
    if (distanceFlexibility && distanceFlexibility < 0) {
      throw new Error("Distance flexibility cannot be negative");
    }

    if (timeFlexibility && timeFlexibility < 0) {
      throw new Error("Time flexibility cannot be negative");
    }

    // Validate fare if provided
    if (expectedFare && expectedFare < 0) {
      throw new Error("Expected fare cannot be negative");
    }

    const shortStartAdd = (
      await reverseGeocode(startLocation.y, startLocation.x)
    ).shortAddress;
    const shortEndAdd = (await reverseGeocode(endLocation.y, endLocation.x))
      .shortAddress;

    // Create new trip
    const tripInsertData: typeof trips.$inferInsert = {
      vehicleId: vehicleIdInt,
      driverId: req.user!.userId,
      startLocation,
      endLocation,
      startAddress: shortStartAdd,
      endAddress: shortEndAdd,
      tripDate: trip_date ? new Date(trip_date) : undefined,
      departureTime: departureTime ? new Date(departureTime) : undefined,
      arrivalTime: arrivalTime ? new Date(arrivalTime) : undefined,
      availableSeats: seats,
      distanceFlexibility: distanceFlexibility || 0,
      timeFlexibility: timeFlexibility || 0,
      expectedFare,
      active: true,
      status: "scheduled",
      remarks,
    };

    console.log("Trip insert data:", JSON.stringify(tripInsertData, null, 2));

    const [newTrip] = await db.insert(trips).values(tripInsertData).returning();

    res.status(201).json({
      message: "Trip created successfully",
      trip: {
        tripId: newTrip.tripId,
        vehicleId: newTrip.vehicleId,
        driverId: newTrip.driverId,
        startLocation: newTrip.startLocation,
        endLocation: newTrip.endLocation,
        departureTime: newTrip.departureTime,
        arrivalTime: newTrip.arrivalTime,
        seats: newTrip.availableSeats,
        distanceFlexibility: newTrip.distanceFlexibility,
        timeFlexibility: newTrip.timeFlexibility,
        expectedFare: newTrip.expectedFare,
        status: newTrip.status,
        remarks: newTrip.remarks,
        createdAt: newTrip.createdAt,
      },
    });
  } catch (error) {
    // console.error("Create trip error:", error);
    // console.error("Error details:", {
    //   message: error instanceof Error ? error.message : "Unknown error",
    //   stack: error instanceof Error ? error.stack : undefined,
    //   requestBody: req.body,
    //   userId: req.user?.userId,
    //   vehicleIdInt: parseInt(req.body.vehicleId),
    //   parsedVehicleId: !isNaN(parseInt(req.body.vehicleId)),
    // });

    // Check if it's a database constraint error
    if (error instanceof Error) {
      if (error.message.includes("violates not-null constraint")) {
        res
          .status(400)
          .json({ error: "Missing required field: " + error.message });
        return;
      }
      if (error.message.includes("violates foreign key constraint")) {
        res.status(400).json({ error: "Invalid reference: " + error.message });
        return;
      }
      if (error.message.includes("violates unique constraint")) {
        res.status(400).json({ error: "Duplicate entry: " + error.message });
        return;
      }
    }

    res.status(500).json({
      error:
        "Error creating trip: " +
        (error instanceof Error ? error.message : "Unknown error"),
    });
  }
};

export const getMyTrips = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { type = "upcoming" } = req.query;
    const now = new Date();

    const conditions = [eq(trips.driverId, req.user!.userId)];

    // Upcoming vs Past
    if (type === "upcoming") {
      conditions.push(gt(trips.tripDate, now));
      conditions.push(eq(trips.status, "scheduled"));
    } else {
      conditions.push(lte(trips.tripDate, now));
    }

    const userTrips = await db.query.trips.findMany({
      where: and(...conditions),
      with: {
        vehicle: true,
      },
      orderBy: [desc(trips.departureTime)],
    });

    res.status(200).json({
      trips: userTrips.map((trip) => ({
        tripId: trip.tripId,
        startAddress: trip.startAddress,
        endAddress: trip.endAddress,
        departureTime: trip.departureTime,
        expectedFare: trip.expectedFare,
        status: trip.status,
        vehicle: trip.vehicle,
        tripDate: trip.tripDate,
      })),
    });
  } catch (error) {
    console.error("Get trips error:", error);
    res.status(500).json({ error: "Error fetching trips" });
  }
};

// export const searchTrips = async (
//   req: express.Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const {
//       startLocation,
//       endLocation,
//       date,
//       seats = "1",
//       maxDistance = "2", // Default 2km for route matching
//       maxTimeFlexibility = "30",
//       maxFare,
//       page = "1",
//       limit = "10",
//       // Coordinate-based search parameters
//       pickupLat,
//       pickupLng,
//       destinationLat,
//       destinationLng,
//     } = req.query;

//     const pageNumber = parseInt(page as string);
//     const limitNumber = parseInt(limit as string);
//     const offset = (pageNumber - 1) * limitNumber;
//     const maxDistanceKm = parseFloat(maxDistance as string);

//     const conditions = [eq(trips.status, "scheduled"), eq(trips.active, true)];

//     console.log("\n🔍 SEARCH QUERY PARAMETERS:");
//     console.log(`   Start Location: ${startLocation || "N/A"}`);
//     console.log(`   End Location: ${endLocation || "N/A"}`);
//     console.log(`   Date: ${date || "N/A"}`);
//     console.log(
//       `   Coordinates: ${
//         pickupLat && pickupLng ? `(${pickupLat}, ${pickupLng})` : "N/A"
//       }`
//     );
//     console.log(`   Seats Needed: ${seats}`);
//     console.log(`   Max Distance: ${maxDistanceKm} km\n`);

//     // If date is provided, filter by date
//     if (date) {
//       const searchDate = new Date(date as string);
//       const now = new Date();

//       // IMPORTANT: Only show future trips, even if searching by date
//       // If searching for today, use current time as start
//       // If searching for future date, use start of that day
//       const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
//       const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

//       // Use whichever is later: current time or start of search date
//       const effectiveStart = now > startOfDay ? now : startOfDay;

//       console.log(`📅 Filtering by date: ${searchDate.toDateString()}`);
//       console.log(`   Current time: ${now.toISOString()}`);
//       console.log(
//         `   Effective start: ${effectiveStart.toISOString()} (only future trips)`
//       );
//       console.log(`   End of day: ${endOfDay.toISOString()}\n`);

//       conditions.push(
//         gte(trips.departureTime, effectiveStart),
//         lte(trips.departureTime, endOfDay)
//       );
//     } else {
//       // No date specified - show all upcoming trips
//       const now = new Date();
//       console.log(
//         `📅 No date specified - showing trips after ${now.toISOString()}\n`
//       );
//       conditions.push(gte(trips.departureTime, now));
//     }

//     // Always filter by available seats
//    // conditions.push(gte(trips.seats, parseInt(seats as string)));

//     // Filter by max fare if provided
//     // if (maxFare) {
//     //   conditions.push(lte(trips.expectedFare, parseInt(maxFare as string)));
//     // }

//     // Fetch all matching trips (we'll filter by coordinates in memory)
//     const availableTrips = await db.query.trips.findMany({
//       where: and(...conditions),
//       with: {
//         vehicle: true,
//         driver: true,
//       },
//       orderBy: [asc(trips.departureTime)],
//     });

//     console.log(
//       `✅ Fetched ${availableTrips.length} trips from database matching basic criteria\n`
//     );

//     // Apply coordinate-based filtering if coordinates are provided
//     let filteredTrips = availableTrips;

//     if (pickupLat && pickupLng && destinationLat && destinationLng) {
//       // Parse and normalize passenger coordinates
//       const passengerPickup = normalizeCoordinates({
//         lat: parseFloat(pickupLat as string),
//         lng: parseFloat(pickupLng as string),
//       });
//       const passengerDestination = normalizeCoordinates({
//         lat: parseFloat(destinationLat as string),
//         lng: parseFloat(destinationLng as string),
//       });

//       console.log(`\n${"=".repeat(80)}`);
//       console.log(
//         `🔍 RIDE MATCHING SEARCH - Dynamic Coordinate-Based Filtering`
//       );
//       console.log(`${"=".repeat(80)}\n`);
//       console.log("📍 PASSENGER ROUTE (C → D):");
//       console.log(
//         `   C (Pickup):      (${passengerPickup.lat}, ${passengerPickup.lng}) [Normalized to 6 decimals]`
//       );
//       console.log(
//         `   D (Destination): (${passengerDestination.lat}, ${passengerDestination.lng}) [Normalized to 6 decimals]`
//       );
//       console.log(`\n🎯 MATCHING RULES:`);
//       console.log(
//         `   ✅ Distance A→C ≤ ${maxDistanceKm} km (Driver Start → Passenger Pickup)`
//       );
//       console.log(
//         `   ✅ Distance B→D ≤ ${maxDistanceKm} km (Driver End → Passenger Drop)`
//       );
//       console.log(`   ✅ EXACT MATCH: If both distances < 0.1 km, FORCE MATCH`);
//       console.log(`\n📊 Available Trips to Check: ${availableTrips.length}\n`);

//       // Process trips SEQUENTIALLY to avoid interleaved Google API calls
//       const matchedTrips: Array<{ trip: any; roadDistance: number | null }> =
//         [];
//       let tripIndex = 0;

//       for (const trip of availableTrips) {
//         tripIndex++;
//         console.log(`\n${"─".repeat(80)}`);
//         console.log(
//           `🚗 TRIP ${trip.tripId} - CHECK ${tripIndex}/${availableTrips.length}`
//         );
//         console.log(`${"─".repeat(80)}`);
//         console.log(
//           `   Departure: ${
//             trip.departureTime
//               ? new Date(trip.departureTime).toLocaleString()
//               : "N/A"
//           }`
//         );
//         console.log(`   Available Seats: ${trip.seats}`);
//         console.log(`   Driver Route (A → B):`);
//         console.log(`      A (Start): ${trip.startLocation}`);
//         console.log(`      B (End):   ${trip.endLocation}`);

//         // Extract coordinates from trip locations
//         const driverStart = extractCoordinates(trip.startLocation);
//         const driverEnd = extractCoordinates(trip.endLocation);

//         console.log("\n   📍 EXTRACTED & NORMALIZED COORDINATES:");
//         if (driverStart) {
//           console.log(
//             `      A: ${JSON.stringify(driverStart)} [Normalized to 6 decimals]`
//           );
//         } else {
//           console.log(
//             `      A: ❌ NOT FOUND (no coordinates in location string)`
//           );
//         }
//         if (driverEnd) {
//           console.log(
//             `      B: ${JSON.stringify(driverEnd)} [Normalized to 6 decimals]`
//           );
//         } else {
//           console.log(
//             `      B: ❌ NOT FOUND (no coordinates in location string)`
//           );
//         }

//         // Method 1: Coordinate-based matching (fast, accurate for trips with embedded coords)
//         if (driverStart && driverEnd) {
//           console.log(
//             "\n   ✅ Using HAVERSINE distance formula (fast, accurate)"
//           );
//           console.log("   📏 COMPUTING DISTANCES:");

//           // Calculate Haversine distances
//           const pickupDistance = calculateHaversineDistance(
//             driverStart.lat,
//             driverStart.lng,
//             passengerPickup.lat,
//             passengerPickup.lng
//           );

//           const dropDistance = calculateHaversineDistance(
//             driverEnd.lat,
//             driverEnd.lng,
//             passengerDestination.lat,
//             passengerDestination.lng
//           );

//           console.log(
//             `      A→C (${driverStart.lat}, ${driverStart.lng}) → (${passengerPickup.lat}, ${passengerPickup.lng})`
//           );
//           console.log(`          = ${pickupDistance.toFixed(6)} km`);
//           console.log(
//             `      B→D (${driverEnd.lat}, ${driverEnd.lng}) → (${passengerDestination.lat}, ${passengerDestination.lng})`
//           );
//           console.log(`          = ${dropDistance.toFixed(6)} km`);

//           const matches = isRouteMatch(
//             driverStart,
//             driverEnd,
//             passengerPickup,
//             passengerDestination,
//             maxDistanceKm
//           );

//           // Calculate actual road distance using Google Distance Matrix API
//           let roadDistance = null;
//           if (matches) {
//             try {
//               const distanceResult =
//                 await googleMapsService.calculateDistanceByCoordinates(
//                   driverStart.lat,
//                   driverStart.lng,
//                   driverEnd.lat,
//                   driverEnd.lng
//                 );
//               if (distanceResult) {
//                 roadDistance = distanceResult.distance;
//                 console.log(
//                   `\n   ✅ MATCH CONFIRMED - Total route distance: ${roadDistance.toFixed(
//                     2
//                   )} km`
//                 );
//               } else {
//                 console.log(`\n   ✅ MATCH CONFIRMED (Haversine-based)`);
//               }
//             } catch (error) {
//               console.log(
//                 `\n   ✅ MATCH CONFIRMED (Haversine-based, API unavailable)`
//               );
//             }

//             // Add to matched trips array
//             matchedTrips.push({ trip, roadDistance });
//           } else {
//             console.log(
//               `\n   ❌ NO MATCH - Distances exceed ${maxDistanceKm} km threshold`
//             );
//           }

//           // Continue to next trip (don't return early!)
//           continue;
//         }

//         // Method 2: Google Distance Matrix API fallback (for trips without embedded coords)
//         console.log(
//           `\n   ⚠️  No coordinates found - Using Google Distance Matrix API fallback`
//         );

//         try {
//           // Calculate distance from driver start to passenger pickup
//           let pickupDistance = maxDistanceKm + 1; // Default to non-match
//           let destinationDistance = maxDistanceKm + 1; // Default to non-match

//           // IMPORTANT: Always use trip.startLocation for this specific trip, not extracted coords
//           if (trip.startLocation) {
//             console.log(`\n   🌐 Calculating pickup distance (address-based):`);
//             console.log(`      From: ${trip.startLocation}`);
//             console.log(
//               `      To:   (${passengerPickup.lat}, ${passengerPickup.lng})`
//             );

//             const addressDistanceResult =
//               await googleMapsService.calculateDistance(
//                 trip.startLocation,
//                 `${passengerPickup.lat},${passengerPickup.lng}`
//               );
//             pickupDistance = addressDistanceResult?.distance || pickupDistance;
//             console.log(`      Result: ${pickupDistance.toFixed(3)} km`);
//           }

//           // IMPORTANT: Always use trip.endLocation for this specific trip, not extracted coords
//           if (trip.endLocation) {
//             console.log(`\n   🌐 Calculating drop distance (address-based):`);
//             console.log(`      From: ${trip.endLocation}`);
//             console.log(
//               `      To:   (${passengerDestination.lat}, ${passengerDestination.lng})`
//             );

//             const addressDistanceResult =
//               await googleMapsService.calculateDistance(
//                 trip.endLocation,
//                 `${passengerDestination.lat},${passengerDestination.lng}`
//               );
//             destinationDistance =
//               addressDistanceResult?.distance || destinationDistance;
//             console.log(`      Result: ${destinationDistance.toFixed(3)} km`);
//           }

//           console.log(`\n   📏 GOOGLE DISTANCE MATRIX RESULTS:`);
//           console.log(
//             `      Pickup distance:      ${pickupDistance.toFixed(3)} km`
//           );
//           console.log(
//             `      Destination distance: ${destinationDistance.toFixed(3)} km`
//           );
//           console.log(`      Max allowed:          ${maxDistanceKm} km`);

//           // SPECIAL CASE: Exact or near-exact match
//           const EXACT_MATCH_THRESHOLD = 0.1;
//           const isExactPickup = pickupDistance < EXACT_MATCH_THRESHOLD;
//           const isExactDrop = destinationDistance < EXACT_MATCH_THRESHOLD;

//           let matches = false;

//           if (isExactPickup && isExactDrop) {
//             matches = true;
//             console.log(`\n   ✅ EXACT MATCH DETECTED!`);
//             console.log(
//               `      Both distances < ${EXACT_MATCH_THRESHOLD} km - FORCE MATCH`
//             );
//           } else {
//             matches =
//               pickupDistance <= maxDistanceKm &&
//               destinationDistance <= maxDistanceKm;
//             console.log(`\n   📊 MATCHING DECISION:`);
//             console.log(
//               `      Pickup within ${maxDistanceKm} km?    ${
//                 pickupDistance <= maxDistanceKm ? "✅ YES" : "❌ NO"
//               }`
//             );
//             console.log(
//               `      Drop within ${maxDistanceKm} km?      ${
//                 destinationDistance <= maxDistanceKm ? "✅ YES" : "❌ NO"
//               }`
//             );
//             console.log(
//               `      Result: ${matches ? "✅ MATCH" : "❌ NO MATCH"}`
//             );
//           }

//           // Calculate full route distance if matched (using address-based API)
//           let roadDistance = null;
//           if (matches) {
//             try {
//               const routeDistanceResult =
//                 await googleMapsService.calculateDistance(
//                   trip.startLocation,
//                   trip.endLocation
//                 );
//               if (routeDistanceResult) {
//                 roadDistance = routeDistanceResult.distance;
//                 console.log(
//                   `   ✅ MATCH CONFIRMED - Route distance: ${roadDistance.toFixed(
//                     2
//                   )} km`
//                 );
//               } else {
//                 console.log(`   ✅ MATCH CONFIRMED (address-based)`);
//               }
//             } catch (error) {
//               console.log(`   ✅ MATCH CONFIRMED (address-based)`);
//             }
//           } else {
//             console.log(
//               `   ❌ NO MATCH (distances exceed ${maxDistanceKm} km)`
//             );
//           }

//           // If this trip matches, add it to results with road distance
//           if (matches) {
//             matchedTrips.push({ trip, roadDistance });
//           }
//         } catch (error) {
//           console.error(
//             `   ⚠️  Error calculating distance for Trip ${trip.tripId}:`,
//             error
//           );
//         }
//       }

//       // Store trips with their road distances and calculate combined distance for sorting
//       const tripsWithDistance = matchedTrips
//         .map((result) => {
//           // Calculate combined pickup+drop distance for "nearest" sorting
//           let combinedDistance = null;
//           const driverStart = extractCoordinates(result.trip.startLocation);
//           const driverEnd = extractCoordinates(result.trip.endLocation);

//           if (driverStart && driverEnd) {
//             const pickupDist = calculateHaversineDistance(
//               driverStart.lat,
//               driverStart.lng,
//               passengerPickup.lat,
//               passengerPickup.lng
//             );
//             const dropDist = calculateHaversineDistance(
//               driverEnd.lat,
//               driverEnd.lng,
//               passengerDestination.lat,
//               passengerDestination.lng
//             );
//             combinedDistance = pickupDist + dropDist; // Sum of both distances
//           }

//           return {
//             ...result.trip,
//             roadDistance: result.roadDistance,
//             combinedDistance,
//           };
//         })
//         .sort((a, b) => {
//           // Sort by combined distance (nearest first)
//           if (a.combinedDistance !== null && b.combinedDistance !== null) {
//             return a.combinedDistance - b.combinedDistance;
//           }
//           // If one doesn't have distance, put it last
//           if (a.combinedDistance !== null) return -1;
//           if (b.combinedDistance !== null) return 1;
//           return 0;
//         });

//       filteredTrips = tripsWithDistance;

//       console.log(`\n${"=".repeat(80)}`);
//       console.log(`📊 SEARCH RESULTS SUMMARY`);
//       console.log(`${"=".repeat(80)}`);
//       console.log(`Total trips checked: ${availableTrips.length}`);
//       console.log(`Matching trips found: ${filteredTrips.length}`);
//       console.log(
//         `Search success rate: ${(
//           (filteredTrips.length / availableTrips.length) *
//           100
//         ).toFixed(1)}%`
//       );

//       // Show which trips matched and which didn't
//       if (availableTrips.length > 0) {
//         console.log(`\n📋 DETAILED RESULTS:`);
//         const matchedTripIds = new Set(filteredTrips.map((t) => t.tripId));
//         availableTrips.forEach((trip, idx) => {
//           const matched = matchedTripIds.has(trip.tripId);
//           console.log(
//             `   ${idx + 1}. Trip ${trip.tripId}: ${
//               matched ? "✅ MATCH" : "❌ NO MATCH"
//             }`
//           );
//         });
//       }

//       if (filteredTrips.length > 0) {
//         console.log(`\n🎯 NEAREST MATCHING TRIPS (sorted by proximity):\n`);
//         filteredTrips.slice(0, 5).forEach((trip, index) => {
//           const driverStart = extractCoordinates(trip.startLocation);
//           const driverEnd = extractCoordinates(trip.endLocation);

//           if (driverStart && driverEnd) {
//             const pickupDist = calculateHaversineDistance(
//               driverStart.lat,
//               driverStart.lng,
//               passengerPickup.lat,
//               passengerPickup.lng
//             );
//             const dropDist = calculateHaversineDistance(
//               driverEnd.lat,
//               driverEnd.lng,
//               passengerDestination.lat,
//               passengerDestination.lng
//             );

//             console.log(`   ${index + 1}. Trip ${trip.tripId}:`);
//             console.log(
//               `      A→C: ${pickupDist.toFixed(3)} km | B→D: ${dropDist.toFixed(
//                 3
//               )} km | Combined: ${(pickupDist + dropDist).toFixed(3)} km`
//             );
//             console.log(
//               `      Route: ${trip.startLocation?.substring(
//                 0,
//                 40
//               )}... → ${trip.endLocation?.substring(0, 40)}...`
//             );
//           } else {
//             console.log(
//               `   ${index + 1}. Trip ${trip.tripId} (coordinates unavailable)`
//             );
//           }
//         });

//         if (filteredTrips.length > 5) {
//           console.log(`   ... and ${filteredTrips.length - 5} more trips`);
//         }
//       } else {
//         console.log(
//           `\n⚠️  No trips match the search criteria within ${maxDistanceKm} km`
//         );
//         console.log(`\n💡 Suggestions:`);
//         console.log(`   • Increase max distance threshold`);
//         console.log(`   • Try different dates`);
//         console.log(`   • Ensure driver trips have coordinates embedded`);
//       }
//       console.log(`${"=".repeat(80)}\n`);
//     } else if (startLocation && endLocation) {
//       // Fallback to text-based search if coordinates not provided
//       filteredTrips = availableTrips.filter((trip) => {
//         const tripStart = trip.startLocation?.toLowerCase() || "";
//         const tripEnd = trip.endLocation?.toLowerCase() || "";
//         const searchStart = (startLocation as string).toLowerCase();
//         const searchEnd = (endLocation as string).toLowerCase();

//         return tripStart.includes(searchStart) || tripEnd.includes(searchEnd);
//       });
//     }

//     // Apply pagination to filtered results
//     const total = filteredTrips.length;
//     const paginatedTrips = filteredTrips.slice(offset, offset + limitNumber);

//     res.json({
//       trips: paginatedTrips.map((trip: any) => ({
//         tripId: trip.tripId,
//         vehicleId: trip.vehicleId,
//         driverId: trip.driverId,
//         startLocation: trip.startLocation,
//         endLocation: trip.endLocation,
//         departureTime: trip.departureTime,
//         arrivalTime: trip.arrivalTime,
//         seats: trip.seats,
//         distanceFlexibility: trip.distanceFlexibility,
//         timeFlexibility: trip.timeFlexibility,
//         expectedFare: trip.expectedFare,
//         status: trip.status,
//         remarks: trip.remarks,
//         vehicle: trip.vehicle,
//         driver: trip.driver,
//         createdAt: trip.createdAt,
//         roadDistance: trip.roadDistance, // Include actual road distance
//       })),
//       pagination: {
//         total: total,
//         page: pageNumber,
//         limit: limitNumber,
//         totalPages: Math.ceil(total / limitNumber),
//         hasMore: pageNumber * limitNumber < total,
//       },
//     });
//   } catch (error) {
//     console.error("Search trips error:", error);
//     res.status(500).json({ error: "Error searching trips" });
//   }
// };

export const searchTrips = async (req: AuthRequest, res: Response) => {
  try {
    const {
      startLat,
      startLng,
      endLat,
      endLng,
      seatsNeeded = 1,
      tripDate,
    } = req.query;

    // Validate required coordinates
    if (!startLat || !startLng || !endLat || !endLng || !tripDate) {
      return res.status(400).json({
        message: "Start and end coordinates are required",
      });
    }

    // Validate coordinates format
    const lat1 = Number(startLat);
    const lng1 = Number(startLng);
    const lat2 = Number(endLat);
    const lng2 = Number(endLng);

    if (
      isNaN(lat1) ||
      isNaN(lng1) ||
      isNaN(lat2) ||
      isNaN(lng2) ||
      lat1 < -90 ||
      lat1 > 90 ||
      lat2 < -90 ||
      lat2 > 90 ||
      lng1 < -180 ||
      lng1 > 180 ||
      lng2 < -180 ||
      lng2 > 180
    ) {
      return res.status(400).json({
        message: "Invalid coordinate values",
      });
    }

    let parsedTripDate: Date | null = null;

    if (tripDate) {
      parsedTripDate = new Date(tripDate as string);

      // Check if date is valid
      if (isNaN(parsedTripDate.getTime())) {
        return res.status(400).json({
          message:
            "Invalid date format. Use ISO 8601 format (e.g., 2024-12-25)",
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tripDateOnly = new Date(parsedTripDate);
      tripDateOnly.setHours(0, 0, 0, 0);

      if (tripDateOnly < today) {
        return res.status(400).json({
          message: "Trip date must be today or in the future",
          providedDate: tripDateOnly.toISOString().split("T")[0],
          currentDate: today.toISOString().split("T")[0],
        });
      }
    }

    // Validate seats
    const seats = Number(seatsNeeded);
    if (isNaN(seats) || seats < 1) {
      return res.status(400).json({
        message: "Seats needed must be a positive number",
      });
    }

    const passengerStart = sql`ST_SetSRID(ST_MakePoint(${lng1}, ${lat1}), 4326)`;
    const passengerEnd = sql`ST_SetSRID(ST_MakePoint(${lng2}, ${lat2}), 4326)`;

    // Get current date for filtering
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const availableTrips = await db
      .select({
        // Trip columns
        ...getTableColumns(trips),

        // Distance calculations
        startDistance: sql<number>`ROUND(ST_Distance(${trips.startLocation}::geography, ${passengerStart}::geography)::numeric, 2)`,
        endDistance: sql<number>`ROUND(ST_Distance(${trips.endLocation}::geography, ${passengerEnd}::geography)::numeric, 2)`,
        startToPassengerDrop: sql<number>`ROUND(ST_Distance(${trips.startLocation}::geography, ${passengerEnd}::geography)::numeric, 2)`,
        driverTripDistance: sql<number>`ROUND(ST_Distance(${trips.startLocation}::geography, ${trips.endLocation}::geography)::numeric, 2)`,
        totalDistance: sql<number>`ROUND((ST_Distance(${trips.startLocation}::geography, ${passengerStart}::geography) + ST_Distance(${trips.endLocation}::geography, ${passengerEnd}::geography))::numeric, 2)`,

        driver: {
          userId: users.userId,
          firstname: users.firstname,
          lastname: users.lastname,
        },

        vehicle: {
          vehicleId: vehicles.vehicleId,
          model: vehicles.model,
        },
      })
      .from(trips)
      .innerJoin(users, eq(trips.driverId, users.userId))
      .innerJoin(vehicles, eq(trips.vehicleId, vehicles.vehicleId))
      .where(
        and(
          // Passenger's pickup must be within driver's flexibility from driver's start
          sql`ST_Distance(
            ${trips.startLocation}::geography, 
            ${passengerStart}::geography
          ) <= (${trips.distanceFlexibility} * 1000)`,

          // Passenger's drop location must not be beyond driver's end location
          sql`ST_Distance(
            ${trips.startLocation}::geography, 
            ${passengerEnd}::geography
          ) <= ST_Distance(
            ${trips.startLocation}::geography, 
            ${trips.endLocation}::geography
          )`,

          // Enough seats available
          sql`${trips.availableSeats} >= ${seats}`,
          eq(trips.active, true),
          eq(trips.status, "scheduled"),
          eq(users.active, true),
          eq(vehicles.active, true),
          eq(sql`DATE(${trips.tripDate})`, tripDate),
          ne(trips.driverId, req.user?.userId)

          // Trip date must be current or future
          // sql`${trips.tripDate} >= ${currentDate.toISOString().split("T")[0]}`,
        )
      )
      .orderBy(
        sql`(ST_Distance(${trips.startLocation}::geography, ${passengerStart}::geography) + 
             ST_Distance(${trips.endLocation}::geography, ${passengerEnd}::geography))`
      );

    res.json({
      message: "success",
      count: availableTrips.length,
      filters: {
        passengerStart: { lat: lat1, lng: lng1 },
        passengerEnd: { lat: lat2, lng: lng2 },
        seatsNeeded: seats,
        tripDate: parsedTripDate?.toISOString().split("T")[0] || "any",
        minDate: currentDate.toISOString().split("T")[0],
      },
      trips: availableTrips.map((trip) => ({
        tripId: trip.tripId,
        startAddress: trip.startAddress,
        endAddress: trip.endAddress,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        tripDate: trip.tripDate,
        availableSeats: trip.availableSeats,
        totalSeats: trip.availableSeats,
        distanceFlexibility: trip.distanceFlexibility,
        timeFlexibility: trip.timeFlexibility,
        expectedFare: trip.expectedFare,
        status: trip.status,
        remarks: trip.remarks,

        // Distance information
        distances: {
          startDistance: `${(trip.startDistance / 1000).toFixed(2)} km`,
          endDistance: `${(trip.endDistance / 1000).toFixed(2)} km`,
          totalDistance: `${(trip.totalDistance / 1000).toFixed(2)} km`,
          driverTripDistance: `${(trip.driverTripDistance / 1000).toFixed(
            2
          )} km`,
        },

        // Driver information
        driver: {
          id: trip.driver.userId,
          name: `${trip.driver.firstname || ""} ${
            trip.driver.lastname || ""
          }`.trim(),
        },

        // Vehicle information
        vehicle: {
          id: trip.vehicle.vehicleId,
          model: trip.vehicle.model,
        },
      })),
    });
  } catch (error) {
    console.error("Error searching trips:", error);
    res.status(500).json({
      message: "Internal server error",
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
  }
};

export const updateTripStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { tripId } = req.params;
    const { status } = req.body;

    if (
      !status ||
      !["scheduled", "in_progress", "completed", "cancelled"].includes(status)
    ) {
      res.status(400).json({
        error:
          "Valid status (scheduled, in_progress, completed, cancelled) is required",
      });
      return;
    }

    // Check if trip exists and belongs to user
    const existingTrip = await db.query.trips.findFirst({
      where: and(
        eq(trips.tripId, parseInt(tripId)),
        eq(trips.driverId, req.user!.userId)
      ),
    });

    if (!existingTrip) {
      res.status(404).json({ error: "Trip not found or not owned by you" });
    }

    // Prevent status changes for completed or cancelled trips
    if (
      existingTrip.status &&
      ["completed", "cancelled"].includes(existingTrip.status)
    ) {
      res.status(400).json({
        error: `Cannot update status of a ${existingTrip.status} trip`,
      });
      return;
    }

    const [updatedTrip] = await db
      .update(trips)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(trips.tripId, parseInt(tripId)),
          eq(trips.driverId, req.user!.userId)
        )
      )
      .returning();

    res.json({
      message: "Trip status updated successfully",
      trip: {
        tripId: updatedTrip.tripId,
        status: updatedTrip.status,
        updatedAt: updatedTrip.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update trip status error:", error);
    res.status(500).json({ error: "Error updating trip status" });
  }
};

export const cancelTrip = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { tripId } = req.params;
    const { reason } = req.body;
    const userId = req.user!.userId;

    console.log(`\n🚫 TRIP CANCELLATION REQUEST`);
    console.log(`   Trip ID: ${tripId}`);
    console.log(`   Requested by User ID: ${userId}`);
    console.log(`   Cancellation reason: ${reason || "Not provided"}`);

    // Check if trip exists and belongs to user
    const existingTrip = await db.query.trips.findFirst({
      where: and(
        eq(trips.tripId, parseInt(tripId)),
        eq(trips.driverId, userId)
      ),
    });

    if (!existingTrip) {
      console.log(`   ❌ Trip not found or user ${userId} is not the owner`);
      res.status(404).json({ error: "Trip not found or not owned by you" });
      return;
    }

    console.log(`   Current trip status: ${existingTrip.status}`);

    // Prevent cancellation of completed or already cancelled trips
    if (
      existingTrip.status &&
      ["completed", "cancelled"].includes(existingTrip.status)
    ) {
      console.log(
        `   ❌ Cannot cancel - trip is already ${existingTrip.status}`
      );
      res.status(400).json({
        error: `Cannot cancel a ${existingTrip.status} trip`,
      });
      return;
    }

    // Update trip status to cancelled_by_rider
    const [cancelledTrip] = await db
      .update(trips)
      .set({
        status: "cancelled_by_rider",
        active: false,
        remarks: reason
          ? `${
              existingTrip.remarks || ""
            }\nCancellation reason: ${reason}`.trim()
          : existingTrip.remarks || "",
        updatedAt: new Date(),
      })
      .where(
        and(eq(trips.tripId, parseInt(tripId)), eq(trips.driverId, userId))
      )
      .returning();

    console.log(`   ✅ Trip cancelled successfully`);
    console.log(`   New status: ${cancelledTrip.status}`);
    console.log(`   Active: ${cancelledTrip.active}`);
    console.log(`   Updated at: ${cancelledTrip.updatedAt}`);

    // TODO: Notify all passengers about trip cancellation
    // Get all bookings for this trip and send notifications

    res.json({
      message: "Trip cancelled successfully",
      trip: {
        tripId: cancelledTrip.tripId,
        status: cancelledTrip.status,
        active: cancelledTrip.active,
        remarks: cancelledTrip.remarks,
        updatedAt: cancelledTrip.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Cancel trip error:", error);
    res.status(500).json({ error: "Error cancelling trip" });
  }
};

export const getTripDetails = async (
  req: express.Request,
  res: Response
): Promise<void> => {
  try {
    const { tripId } = req.params;

    if (!tripId) {
      res.status(400).json({ error: "Trip ID is required" });
      return;
    }

    const trip = await db.query.trips.findFirst({
      where: eq(trips.tripId, parseInt(tripId)),
      with: {
        vehicle: true,
        driver: true,
      },
    });

    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    res.json({
      trip: {
        tripId: trip.tripId,
        vehicleId: trip.vehicleId,
        driverId: trip.driverId,
        startLocation: trip.startLocation,
        endLocation: trip.endLocation,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        seats: trip.availableSeats,
        distanceFlexibility: trip.distanceFlexibility,
        timeFlexibility: trip.timeFlexibility,
        expectedFare: trip.expectedFare,
        status: trip.status,
        remarks: trip.remarks,
        active: trip.active,
        vehicle: trip.vehicle,
        driver: trip.driver,
        createdAt: trip.createdAt,
        updatedAt: trip.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get trip details error:", error);
    res.status(500).json({ error: "Error fetching trip details" });
  }
};


export const getOfferedRides = async (req: AuthRequest, res: Response) => {
  const userId = req.user.userId;

const rides = await db
  .select({
    tripId: trips.tripId,
    startAddress: trips.startAddress,
    endAddress: trips.endAddress,
    tripDate: trips.tripDate,
    departureTime: trips.departureTime,
    availableSeats: trips.availableSeats,
    expectedFare: trips.expectedFare,
    status: trips.status,
    requestCount: sql<number>`
      COUNT(${bookings.bookingId})
      FILTER (WHERE ${bookings.status} = 'requested')
    `.as("requestCount"),
  })
  .from(trips)
  .leftJoin(bookings, eq(bookings.tripId, trips.tripId))
  .where(eq(trips.driverId, userId))
  .groupBy(trips.tripId)
  .orderBy(asc(trips.tripDate));


  res.json({ rides });
};

export const getRideRequests = async (req, res) => {
  const { tripId } = req.params;

  const requests = await db
    .select({
      bookingId: bookings.bookingId,
      passengerName: users.userId,
      pickupAddress: bookings.pickAddress,
      dropAddress: bookings.dropAddress,
      seatsBooked: bookings.seatsBooked,
      pickupTime: bookings.pickupTime,
      amount: bookings.amount,
    })
    .from(bookings)
    .innerJoin(users, eq(users.userId, bookings.booked_by))
    .where(
      and(
        eq(bookings.tripId, Number(tripId)),
        eq(bookings.status, "requested")
      )
    );

  res.json({ requests });
};


