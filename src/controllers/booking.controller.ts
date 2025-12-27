import { Response, Request } from "express";
import { db } from "../db";
import { bookings, trips, users } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { eq, and, desc, sql } from "drizzle-orm";
import { sendFirebaseNotification } from "../services/firebaseAdmin.service";
import { reverseGeocode } from "../utils/geoUtils";

// Create a new booking with COD payment
export const createBooking = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      tripId,
      seatsBooked,
      appliedCoupon,
      finalAmount = 100,
      pickupLocation,
      dropLocation,
      pickupTime,
      dropTime,
    } = req.body;

    const userId = req.user!.userId;

    const parsedTripId = parseInt(tripId);

    const shortPickupAddress = await reverseGeocode(
      pickupLocation.y,
      pickupLocation.x
    );
    const shortDropAddress = await reverseGeocode(
      dropLocation.y,
      dropLocation.x
    );

    if (!parsedTripId || !Number.isInteger(parsedTripId)) {
      res.status(400).json({ error: "Invalid tripId" });
      return;
    }

    if (!Number.isInteger(seatsBooked) || seatsBooked <= 0) {
      res.status(400).json({ error: "Invalid seatsBooked value" });
      return;
    }

    if (!Number.isInteger(finalAmount) || finalAmount <= 0) {
      res.status(400).json({
        error: "Final amount must be a positive integer (in paise)",
      });
      return;
    }

    if (!pickupLocation || !dropLocation) {
      res.status(400).json({
        error: "Pickup and drop locations are required",
      });
      return;
    }

    const parsedPickupTime = pickupTime ? new Date(pickupTime) : null;
    const parsedDropTime = dropTime ? new Date(dropTime) : null;

    if (
      (parsedPickupTime && isNaN(parsedPickupTime.getTime())) ||
      (parsedDropTime && isNaN(parsedDropTime.getTime()))
    ) {
      res.status(400).json({ error: "Invalid pickup or drop time" });
      return;
    }

    const trip = await db.query.trips.findFirst({
      where: eq(trips.tripId, parsedTripId),
    });

    if (!trip) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    if (!trip.active || trip.status !== "scheduled") {
      res.status(400).json({
        error: "This trip is not available for booking",
      });
      return;
    }

    if (trip.availableSeats < seatsBooked) {
      res.status(400).json({
        error: `Only ${trip.availableSeats} seat(s) available`,
      });
      return;
    }

    if (trip.driverId === userId) {
      res.status(400).json({
        error: "You cannot book your own trip",
      });
      return;
    }

    const [newBooking] = await db
      .insert(bookings)
      .values({
        tripId: parsedTripId,
        booked_by: userId,
        seatsBooked: parseInt(seatsBooked),
        pickAddress: shortPickupAddress.shortAddress,
        dropAddress: shortDropAddress.shortAddress,
        pickupLocation,
        dropLocation,
        pickupTime: parsedPickupTime,
        dropTime: parsedDropTime,
        amount: finalAmount,
        paymentMethod: "cod",
        paymentStatus: "pending",
        remarks: appliedCoupon ? `Coupon applied: ${appliedCoupon}` : null,
      })
      .returning();

    res.status(201).json({
      message: "Booking created successfully",
      booking: {
        bookingId: newBooking.bookingId,
        tripId: newBooking.tripId,
        bookedBy: newBooking.booked_by,
        seatsBooked: newBooking.seatsBooked,
        status: newBooking.status,
        pickupAddress: newBooking.pickAddress,
        dropAddress: newBooking.dropAddress,
        pickupLatitude: newBooking.pickupLocation?.y,
        pickupLongitude: newBooking.pickupLocation?.x,
        dropLatitude: newBooking.dropLocation?.y,
        dropLongitude: newBooking.dropLocation?.x,
        amount: newBooking.amount,
        paymentMethod: newBooking.paymentMethod,
        paymentStatus: newBooking.paymentStatus,
        createdAt: newBooking.createdAt,
      },
    });
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({
      error:
        "Error creating booking: " +
        (error instanceof Error ? error.message : "Unknown error"),
    });
  }
};

// Get all bookings for a user (passenger view)
export const getUserBookings = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const userBookings = await db.query.bookings.findMany({
      where: eq(bookings.booked_by, userId),
      with: {
        trip: {
          with: {
            driver: {
              columns: {
                firstname: true,
                lastname: true,
                mobile: true,
                photo: true,
              },
            },
            vehicle: {
              columns: {
                model: true,
                licensePlate: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: [desc(bookings.createdAt)],
    });

    res.status(200).json({
      bookings: userBookings.map((booking) => ({
        bookingId: booking.bookingId,
        tripId: booking.tripId,
        seatsBooked: booking.seatsBooked,
        status: booking.status,
        startLocation: booking.pickupLocation,
        endLocation: booking.dropLocation,
        departureTime: booking.dropTime,
        amount: booking.amount,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
        paymentReceivedAt: booking.paymentReceivedAt,
        trip: booking.trip,
        createdAt: booking.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get user bookings error:", error);
    res.status(500).json({ error: "Error fetching bookings" });
  }
};

// Get a single booking by ID
export const getBookingById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { bookingId } = req.params;

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.bookingId, parseInt(bookingId)),
      with: {
        trip: {
          with: {
            driver: {
              columns: {
                firstname: true,
                lastname: true,
                mobile: true,
                photo: true,
              },
            },
            vehicle: {
              columns: {
                model: true,
                licensePlate: true,
                type: true,
            
              },
            },
          },
        },
      },
    });

    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    // Check if user is authorized to view this booking (simplified check)
    if (booking.booked_by !== userId) {
      res.status(403).json({ error: "Unauthorized to view this booking" });
      return;
    }

    res.status(200).json({
      booking: {
        bookingId: booking.bookingId,
        tripId: booking.tripId,
        user: booking.booked_by,
        seatsBooked: booking.seatsBooked,
        status: booking.status,
        startLocation: booking.pickupLocation,
        endLocation: booking.dropLocation,
        departureTime: booking.dropTime,
        arrivalTime: booking.pickupLocation,
        amount: booking.amount,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
        paymentReceivedAt: booking.paymentReceivedAt,
        paymentConfirmedBy: booking.paymentConfirmedBy,
        remarks: booking.remarks,
        trip: booking.trip,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get booking by ID error:", error);
    res.status(500).json({ error: "Error fetching booking details" });
  }
};

// Get all bookings for a specific trip (driver view)
export const getTripBookings = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { tripId } = req.params;
    const driverId = req.user!.userId;

    // Verify the trip belongs to the driver
    const trip = await db.query.trips.findFirst({
      where: and(
        eq(trips.tripId, parseInt(tripId)),
        eq(trips.driverId, driverId)
      ),
    });

    if (!trip) {
      res.status(404).json({
        error: "Trip not found or you are not authorized to view bookings",
      });
      return;
    }

    // Get only confirmed bookings for this trip with passenger details
    const tripBookings = await db.query.bookings.findMany({
      where: and(
        eq(bookings.tripId, parseInt(tripId)),
        eq(bookings.status, "confirmed")
      ),
      orderBy: [desc(bookings.createdAt)],
    });

    // Get passenger details separately
    const bookingsWithPassengers = await Promise.all(
      tripBookings.map(async (booking) => {
        const passenger = await db.query.users.findFirst({
          where: eq(users.userId, booking.tripId!),
        });
        return { ...booking, passenger };
      })
    );

    res.status(200).json({
      trip: {
        tripId: trip.tripId,
        startLocation: trip.startLocation,
        endLocation: trip.endLocation,
        departureTime: trip.departureTime,
        status: trip.status,
      },
      bookings: bookingsWithPassengers.map((booking) => ({
        bookingId: booking.bookingId,
        seatsBooked: booking.seatsBooked,
        status: booking.status,
        amount: booking.amount,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
        paymentReceivedAt: booking.paymentReceivedAt,
        passenger: {
          userId: booking.passenger?.userId,
          name: `${booking.passenger?.firstname || ""} ${
            booking.passenger?.lastname || ""
          }`.trim(),
          mobile: booking.passenger?.mobile,
          photo: booking.passenger?.photo,
        },
        createdAt: booking.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get trip bookings error:", error);
    res.status(500).json({ error: "Error fetching trip bookings" });
  }
};

// Mark payment as received (driver action)
export const confirmPaymentReceived = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const driverId = req.user!.userId;

    // Get booking details
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.bookingId, parseInt(bookingId)),
      with: {
        trip: true,
      },
    });

    if (!booking) {
      res.status(404).json({
        error: "Booking not found",
      });
      return;
    }

    // Verify the driver owns this trip
    if (!booking.trip || (booking.trip as any).driverId !== driverId) {
      res.status(403).json({
        error: "You are not authorized to confirm payment for this booking",
      });
      return;
    }

    // Check if payment is already confirmed
    if (booking.paymentStatus === "received") {
      res.status(400).json({
        error: "Payment has already been confirmed for this booking",
      });
      return;
    }

    // Update booking payment status
    const [updatedBooking] = await db
      .update(bookings)
      .set({
        paymentStatus: "received",
        paymentReceivedAt: new Date(),
        paymentConfirmedBy: driverId,
        updatedAt: new Date(),
      })
      .where(eq(bookings.bookingId, parseInt(bookingId)))
      .returning();

    res.status(200).json({
      message: "Payment confirmed successfully",
      booking: {
        bookingId: updatedBooking.bookingId,
        paymentStatus: updatedBooking.paymentStatus,
        paymentReceivedAt: updatedBooking.paymentReceivedAt,
        updatedAt: updatedBooking.updatedAt,
      },
    });
  } catch (error) {
    console.error("Confirm payment error:", error);
    res.status(500).json({ error: "Error confirming payment" });
  }
};

// Complete trip (driver action)
export const completeTrip = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { tripId } = req.params;
    const driverId = req.user!.userId;

    // Verify the trip belongs to the driver
    const trip = await db.query.trips.findFirst({
      where: and(
        eq(trips.tripId, parseInt(tripId)),
        eq(trips.driverId, driverId)
      ),
    });

    if (!trip) {
      res.status(404).json({
        error: "Trip not found or you are not authorized",
      });
      return;
    }

    // Check if trip can be completed
    if (trip.status === "completed") {
      res.status(400).json({
        error: "Trip is already completed",
      });
      return;
    }

    if (trip.status === "cancelled") {
      res.status(400).json({
        error: "Cannot complete a cancelled trip",
      });
      return;
    }

    // Get all bookings for this trip
    const tripBookings = await db.query.bookings.findMany({
      where: eq(bookings.tripId, parseInt(tripId)),
    });

    // Check if all payments are received
    const pendingPayments = tripBookings.filter(
      (booking) => booking.paymentStatus !== "received"
    );

    if (pendingPayments.length > 0) {
      res.status(400).json({
        error: `Cannot complete trip. ${pendingPayments.length} payment(s) still pending`,
        pendingPayments: pendingPayments.length,
      });
      return;
    }

    // Update trip status to completed
    const [completedTrip] = await db
      .update(trips)
      .set({
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(trips.tripId, parseInt(tripId)))
      .returning();

    // Update all bookings status to completed
    await db
      .update(bookings)
      .set({
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(bookings.tripId, parseInt(tripId)));

    res.status(200).json({
      message: "Trip completed successfully",
      trip: {
        tripId: completedTrip.tripId,
        status: completedTrip.status,
        updatedAt: completedTrip.updatedAt,
      },
    });
  } catch (error) {
    console.error("Complete trip error:", error);
    res.status(500).json({ error: "Error completing trip" });
  }
};

// Get pending ride requests for driver
export const getPendingRideRequests = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const driverId = req.user!.userId;

    // Get all driver's trips
    const driverTrips = await db.query.trips.findMany({
      where: eq(trips.driverId, driverId),
    });

    const tripIds = driverTrips.map((trip) => trip.tripId);

    if (tripIds.length === 0) {
      res.status(200).json({ requests: [] });
      return;
    }

    // Get all pending bookings for driver's trips
    const pendingRequests = await db.query.bookings.findMany({
      where: eq(bookings.status, "requested"),
      orderBy: [desc(bookings.createdAt)],
    });

    // Filter for driver's trips and get rider details
    const requestsWithDetails = await Promise.all(
      pendingRequests
        .filter((booking) => tripIds.includes(booking.tripId!))
        .map(async (booking) => {
          const [rider, trip] = await Promise.all([
            db.query.users.findFirst({
              where: eq(users.userId, booking.tripId!),
            }),
            db.query.trips.findFirst({
              where: eq(trips.tripId, booking.tripId!),
            }),
          ]);

          return {
            bookingId: booking.bookingId,
            tripId: booking.tripId,
            seatsBooked: booking.seatsBooked,
            amount: booking.amount,
            startLocation: booking.pickupLocation,
            endLocation: booking.dropLocation,
            departureTime: booking.dropTime,
            createdAt: booking.createdAt,
            rider: {
              userId: rider?.userId,
              name:
                `${rider?.firstname || ""} ${rider?.lastname || ""}`.trim() ||
                rider?.mobile,
              mobile: rider?.mobile,
              photo: rider?.photo,
            },
            trip: {
              startLocation: trip?.startLocation,
              endLocation: trip?.endLocation,
              departureTime: trip?.departureTime,
            },
          };
        })
    );

    res.status(200).json({ requests: requestsWithDetails });
  } catch (error) {
    console.error("Get pending ride requests error:", error);
    res.status(500).json({ error: "Error fetching ride requests" });
  }
};

// Accept ride request (driver action)
export const acceptRideRequest = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const driverId = req.user!.userId;

    // Get booking with trip details
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.bookingId, parseInt(bookingId)),
      with: { trip: true },
    });

    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    // Verify driver owns this trip
    if (!booking.trip || (booking.trip as any).driverId !== driverId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    // Check if already processed
    if (booking.status !== "requested") {
      res.status(400).json({ error: `Booking already ${booking.status}` });
      return;
    }

    // Check if enough seats are still available
    const currentTrip = booking.trip as any;
    if (currentTrip.seats < (booking.seatsBooked || 0)) {
      res.status(400).json({
        error: `Not enough seats available. Only ${currentTrip.seats} seat(s) remaining.`,
      });
      return;
    }

    // Update booking status to confirmed AND decrease available seats
    const [updatedBooking] = await db
      .update(bookings)
      .set({
        status: "confirmed",
        updatedAt: new Date(),
      })
      .where(eq(bookings.bookingId, parseInt(bookingId)))
      .returning();

    // Decrease available seats in the trip
    await db
      .update(trips)
      .set({
        availableSeats: currentTrip.seats - (booking.seatsBooked || 0),
        updatedAt: new Date(),
      })
      .where(eq(trips.tripId, booking.tripId!));

    // Send Firebase push notification to passenger
    try {
      const [rider] = await db
        .select()
        .from(users)
        .where(eq(users.userId, booking.tripId!));

      if (rider?.expoPushToken) {
        const result = await sendFirebaseNotification({
          token: rider.expoPushToken,
          title: "Ride Request Accepted! 🎉",
          body: `Your ride request from ${booking.pickAddress} to ${booking.dropAddress} has been accepted by the driver.`,
          data: {
            type: "ride_accepted",
            bookingId: String(booking.bookingId),
            tripId: String(booking.tripId),
          },
          sound: "default",
          priority: "high",
        });

        if (result.success) {
          console.log("✅ Notification sent to passenger");
        } else {
          console.error("⚠️ Failed to send notification:", result.error);
        }
      }
    } catch (notifError) {
      console.error("❌ Error sending Firebase notification:", notifError);
      // Don't fail the request if notification fails
    }

    res.status(200).json({
      message: "Ride request accepted successfully",
      booking: {
        bookingId: updatedBooking.bookingId,
        status: updatedBooking.status,
        seatsConfirmed: booking.seatsBooked,
        updatedAt: updatedBooking.updatedAt,
      },
    });
  } catch (error) {
    console.error("Accept ride request error:", error);
    res.status(500).json({ error: "Error accepting ride request" });
  }
};

// Reject ride request (driver action)
export const rejectRideRequest = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const driverId = req.user!.userId;

    // Get booking with trip details
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.bookingId, parseInt(bookingId)),
      with: { trip: true },
    });

    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    // Verify driver owns this trip
    if (!booking.trip || (booking.trip as any).driverId !== driverId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    // Check if already processed
    if (booking.status !== "requested") {
      res.status(400).json({ error: `Booking already ${booking.status}` });
      return;
    }

    // Update booking status to rejected
    const [updatedBooking] = await db
      .update(bookings)
      .set({
        status: "rejected",
        updatedAt: new Date(),
      })
      .where(eq(bookings.bookingId, parseInt(bookingId)))
      .returning();

    // NOTE: No need to return seats since they were never decreased when booking was created

    // Send Firebase push notification to passenger
    try {
      const [rider] = await db
        .select()
        .from(users)
        .where(eq(users.userId, booking.tripId!));

      if (rider?.expoPushToken) {
        const result = await sendFirebaseNotification({
          token: rider.expoPushToken,
          title: "Ride Request Declined",
          body: `Your ride request from ${booking.pickAddress} to ${booking.dropAddress} was declined by the driver. Please search for another ride.`,
          data: {
            type: "ride_rejected",
            bookingId: String(booking.bookingId),
            tripId: String(booking.tripId),
          },
          sound: "default",
          priority: "high",
        });

        if (result.success) {
          console.log("✅ Notification sent to passenger");
        } else {
          console.error("⚠️ Failed to send notification:", result.error);
        }
      }
    } catch (notifError) {
      console.error("❌ Error sending Firebase notification:", notifError);
      // Don't fail the request if notification fails
    }

    res.status(200).json({
      message: "Ride request rejected successfully",
      booking: {
        bookingId: updatedBooking.bookingId,
        status: updatedBooking.status,
        updatedAt: updatedBooking.updatedAt,
      },
    });
  } catch (error) {
    console.error("Reject ride request error:", error);
    res.status(500).json({ error: "Error rejecting ride request" });
  }
};

// Cancel booking (passenger action)
export const cancelBooking = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.userId;

    console.log(`\n🚫 BOOKING CANCELLATION REQUEST`);
    console.log(`   Booking ID: ${bookingId}`);
    console.log(`   Requested by User ID: ${userId} (passenger)`);

    // Get booking details
    const booking = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.bookingId, parseInt(bookingId)),
        eq(bookings.tripId, userId)
      ),
      with: {
        trip: true,
      },
    });

    if (!booking) {
      console.log(
        `   ❌ Booking not found or user ${userId} is not authorized`
      );
      res.status(404).json({
        error: "Booking not found or you are not authorized",
      });
      return;
    }

    console.log(`   Current booking status: ${booking.status}`);
    console.log(`   Trip ID: ${booking.tripId}`);
    console.log(`   Seats booked: ${booking.seatsBooked}`);

    // Check if booking can be cancelled
    if (booking.status === "completed") {
      console.log(`   ❌ Cannot cancel - booking is already completed`);
      res.status(400).json({
        error: "Cannot cancel a completed booking",
      });
      return;
    }

    if (booking.status === "cancelled") {
      console.log(`   ❌ Booking is already cancelled`);
      res.status(400).json({
        error: "Booking is already cancelled",
      });
      return;
    }

    // Update booking status to cancelled_by_passenger
    const [cancelledBooking] = await db
      .update(bookings)
      .set({
        status: "cancelled_by_passenger",
        updatedAt: new Date(),
      })
      .where(eq(bookings.bookingId, parseInt(bookingId)))
      .returning();

    console.log(`   ✅ Booking status updated to: ${cancelledBooking.status}`);

    // Return seats to the trip
    if (booking.trip) {
      const currentSeats = (booking.trip as any).seats;
      const seatsToReturn = booking.seatsBooked || 0;
      const newSeats = currentSeats + seatsToReturn;

      console.log(
        `   🔄 Returning ${seatsToReturn} seat(s) to trip ${booking.tripId}`
      );
      console.log(`   Current seats: ${currentSeats} → New seats: ${newSeats}`);

      await db
        .update(trips)
        .set({
          availableSeats: newSeats,
          updatedAt: new Date(),
        })
        .where(eq(trips.tripId, booking.tripId!));

      console.log(`   ✅ Seats returned successfully`);
    }

    // Send Firebase push notification to driver about cancellation
    try {
      if (booking.trip) {
        const driverId = (booking.trip as any).driverId;
        const [driver] = await db
          .select()
          .from(users)
          .where(eq(users.userId, driverId));

        if (driver?.expoPushToken) {
          const [passenger] = await db
            .select()
            .from(users)
            .where(eq(users.userId, userId));

          const passengerName = passenger
            ? `${passenger.firstname || ""} ${
                passenger.lastname || ""
              }`.trim() || passenger.mobile
            : "A passenger";

          const result = await sendFirebaseNotification({
            token: driver.expoPushToken,
            title: "🚫 Booking Cancelled",
            body: `${passengerName} has cancelled their booking for ${booking.seatsBooked} seat(s). The seats have been made available again.`,
            data: {
              type: "booking_cancelled_by_passenger",
              bookingId: String(booking.bookingId),
              tripId: String(booking.tripId),
              riderId: String(userId),
            },
            sound: "default",
            priority: "high",
          });

          if (result.success) {
            console.log("✅ Cancellation notification sent to driver");
          } else {
            console.error("⚠️ Failed to send notification:", result.error);
          }
        } else {
          console.log("⚠️ Driver has no push token registered");
        }
      }
    } catch (notifError) {
      console.error("❌ Error sending Firebase notification:", notifError);
      // Don't fail the request if notification fails
    }

    res.status(200).json({
      message: "Booking cancelled successfully",
      booking: {
        bookingId: cancelledBooking.bookingId,
        status: cancelledBooking.status,
        updatedAt: cancelledBooking.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Cancel booking error:", error);
    res.status(500).json({ error: "Error cancelling booking" });
  }
};

export const updateBookingStatus = async (req: Request, res: Response) => {
  const bookingId = Number(req.params.bookingId);
  const { status } = req.body; // accepted | rejected | cancelled

  if (!["accepted", "rejected", "cancelled"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    await db.transaction(async (tx) => {
      /* 1️⃣ Lock booking row */
      const [booking] = await tx.execute(sql`
        SELECT * FROM bookings
        WHERE booking_id = ${bookingId}
        FOR UPDATE
      `)

      console.log(booking)

      if (!booking) {
        throw new Error("Booking not found");
      }

      /* 2️⃣ Lock trip row */
      const [trip] = await tx.execute(sql`
        SELECT * FROM trips
        WHERE trip_id = ${booking.trip_id}
        FOR UPDATE
      `);

      if (!trip) {
        throw new Error("Trip not found");
      }

      /* 3️⃣ Handle seat logic */
      const wasAccepted = booking.status === "accepted";
      const isAccepting = status === "accepted";

      // Accepting booking
      if (!wasAccepted && isAccepting) {
        if (trip.available_seats < booking.seats_booked) {
          throw new Error("Not enough seats available");
        }

        await tx
          .update(trips)
          .set({
            availableSeats: sql`${trips.availableSeats} - ${booking.seats_booked}`,
          })
          .where(eq(trips.tripId, Number(booking.trip_id)));
      }

      // Reverting accepted booking
      if (wasAccepted && status !== "accepted") {
        await tx
          .update(trips)
          .set({
            availableSeats: sql`${trips.availableSeats} + ${booking.seats_booked}`,
          })
          .where(eq(trips.tripId, Number(booking.trip_id)));
      }

      /* 4️⃣ Update booking status */
      await tx
        .update(bookings)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(bookings.bookingId, bookingId));
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("updateBookingStatus error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};


export const getMyBookedRides = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.userId;



    if(!userId){
      return res.status(404).json({
        message:"User not found"
      })
    }

    const data = await db
      .select({
        bookingId: bookings.bookingId,
        status: bookings.status,
        seatsBooked: bookings.seatsBooked,
        amount: bookings.amount,
        pickAddress: bookings.pickAddress,
        dropAddress: bookings.dropAddress,
        pickupTime: bookings.pickupTime,
        dropTime: bookings.dropTime,
        tripDate:trips.tripDate,
        departureTime: trips.departureTime,
        arrivalTime: trips.arrivalTime,
      })
      .from(bookings)
      .innerJoin(trips,eq(bookings.tripId,trips.tripId))
      .where(eq(bookings.booked_by, userId))
      .orderBy(desc(bookings.createdAt));

      console.log(data)

    res.json(data);
  } catch (error) {
    console.error("getMyBookedRides error:", error);
    res.status(500).json({ message: "Failed to fetch booked rides" });
  }
};