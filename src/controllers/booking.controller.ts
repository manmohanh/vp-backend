import { Response, Request } from "express";
import { db } from "../db";
import { bookings, trips, users, notifications } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { eq, and, desc, sql, getTableColumns, asc } from "drizzle-orm";
import { sendFirebaseNotification } from "../services/firebaseAdmin.service";
import { reverseGeocode } from "../utils/geoUtils";

// Create a new booking with COD payment
export const createBooking = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      tripId,
      seatsBooked,
      appliedCoupon,
      finalAmount,
      pickupLocation,
      dropLocation,
    } = req.body;

    const userId = req.user!.userId;

    const parsedTripId = parseInt(tripId);

    console.log(seatsBooked);

    const shortPickupAddress = await reverseGeocode(
      pickupLocation.y,
      pickupLocation.x,
    );
    const shortDropAddress = await reverseGeocode(
      dropLocation.y,
      dropLocation.x,
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

    const [newBooking, newNotification] = await db.transaction(async (tx) => {
      const [booking] = await tx
        .insert(bookings)
        .values({
          tripId: parsedTripId,
          booked_by: userId,
          seatsBooked: parseInt(seatsBooked),
          pickAddress: shortPickupAddress.fullAddress,
          dropAddress: shortDropAddress.fullAddress,
          pickupLocation,
          dropLocation,
          amount: finalAmount,
          paymentMethod: "cod",
          paymentStatus: "pending",
          remarks: appliedCoupon ? `Coupon applied: ${appliedCoupon}` : null,
        })
        .returning();

      // await tx
      //   .update(trips)
      //   .set({
      //     availableSeats: sql`${trips.availableSeats} - ${booking.seatsBooked}`,
      //   })
      //   .where(eq(trips.tripId, booking.tripId));

      const [trip] = await tx
        .select({
          driverId: trips.driverId,
          startAddress: trips.startAddress,
          endAddress: trips.endAddress,
        })
        .from(trips)
        .where(eq(trips.tripId, booking.tripId));

      if (!trip) throw new Error("Trip not found");

      const [notification] = await tx
        .insert(notifications)
        .values({
          receiver: trip.driverId,
          sender: booking.booked_by,
          bookingId: booking.bookingId,
          tripId: booking.tripId,
          type: "ride_requested",
          title: "New Ride Request",
          message: `A passenger requested ${booking.seatsBooked} ${
            booking.seatsBooked > 1 ? "seats" : "seat"
          }  from ${booking.pickAddress} to ${booking.dropAddress}`,
        })
        .returning();

      const result = await db.query.users.findFirst({
        where: eq(users.userId, trip.driverId),
        columns: {
          expoPushToken: true,
        },
      });

      if (result?.expoPushToken) {
        const pushData = {
          to: result?.expoPushToken,
          sound: "default",
          title: "New Ride Request",
          body: `A passenger requested ${booking.seatsBooked} ${
            booking.seatsBooked > 1 ? "seats" : "seat"
          }  from ${booking.pickAddress} to ${booking.dropAddress}.`,
          data: {
            tripId,
          },
        };

        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(pushData),
        });
      }

      return [booking, notification];
    });

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
      notification: {
        notificationId: newNotification.notificationId,
        sender: newNotification.sender,
        receiver: newNotification.receiver,
        type: newNotification.type,
        title: newNotification.title,
        message: newNotification.message,
        isRead: newNotification.isRead,
        createdAt: newNotification.createdAt,
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
  res: Response,
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
  res: Response,
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
  res: Response,
): Promise<void> => {
  try {
    const { tripId } = req.params;
    const driverId = req.user!.userId;

    // Verify the trip belongs to the driver
    const trip = await db.query.trips.findFirst({
      where: and(
        eq(trips.tripId, parseInt(tripId)),
        eq(trips.driverId, driverId),
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
        eq(bookings.status, "confirmed"),
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
      }),
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
  res: Response,
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

export const startTrip = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { tripId } = req.params;
    const driverId = req.user!.userId;

    // Verify the trip belongs to the driver
    const trip = await db.query.trips.findFirst({
      where: and(
        eq(trips.tripId, parseInt(tripId)),
        eq(trips.driverId, driverId),
      ),
    });

    if (!trip) {
      res.status(404).json({
        error: "Trip not found or you are not authorized",
      });
      return;
    }

    // Check if trip can be started
    if (trip.status === "completed") {
      res.status(400).json({
        error: "Trip is already completed",
      });
      return;
    }

    if (trip.status === "cancelled") {
      res.status(400).json({
        error: "Cannot start a cancelled trip",
      });
      return;
    }

    if (trip.status === "in_progress") {
      res.status(400).json({
        error: "Trip is already in progress",
      });
      return;
    }

    // Check if trip date is today or in the past
    const tripDate = new Date(trip.tripDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    tripDate.setHours(0, 0, 0, 0);

    if (tripDate > today) {
      res.status(400).json({
        error: "Cannot start a trip scheduled for a future date",
        tripDate: trip.tripDate,
      });
      return;
    }

    // Get all accepted bookings for this trip
    const acceptedBookings = await db.query.bookings.findMany({
      where: and(
        eq(bookings.tripId, parseInt(tripId)),
        eq(bookings.status, "accepted"),
      ),
    });

    if (acceptedBookings.length === 0) {
      res.status(400).json({
        error: "Cannot start trip without any accepted passengers",
      });
      return;
    }

    // Update trip status to in_progress
    const [startedTrip] = await db
      .update(trips)
      .set({
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(eq(trips.tripId, parseInt(tripId)))
      .returning();

    // Update all accepted bookings status to in_progress
    await db
      .update(bookings)
      .set({
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookings.tripId, parseInt(tripId)),
          eq(bookings.status, "accepted"),
        ),
      );

    res.status(200).json({
      message: "Trip started successfully",
      trip: {
        tripId: startedTrip.tripId,
        status: startedTrip.status,
        updatedAt: startedTrip.updatedAt,
        passengersCount: acceptedBookings.length,
      },
    });
  } catch (error) {
    console.error("Start trip error:", error);
    res.status(500).json({ error: "Error starting trip" });
  }
};

// Complete trip (driver action)
export const completeTrip = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { tripId } = req.params;
    const driverId = req.user!.userId;

    console.log(tripId);

    // Verify the trip belongs to the driver
    const trip = await db.query.trips.findFirst({
      where: and(
        eq(trips.tripId, parseInt(tripId)),
        eq(trips.driverId, driverId),
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
      (booking) => booking.paymentStatus !== "received",
    );

    // if (pendingPayments.length > 0) {
    //   res.status(400).json({
    //     error: `Cannot complete trip. ${pendingPayments.length} payment(s) still pending`,
    //     pendingPayments: pendingPayments.length,
    //   });
    //   return;
    // }

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

export const cancelTrip = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const tripId = Number(req.params.tripId);
    const driverId = req.user!.userId;

    const trip = await db
      .select({
        tripId: trips.tripId,
        status: trips.status,
        driverId: trips.driverId,
      })
      .from(trips)
      .where(and(eq(trips.tripId, tripId), eq(trips.driverId, driverId)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!trip) {
      res.status(404).json({
        error: "Trip not found or you are not authorized",
      });
      return;
    }

    if (trip.status === "completed") {
      res.status(400).json({
        error: "Completed trip cannot be cancelled",
      });
      return;
    }

    if (trip.status === "cancelled") {
      res.status(400).json({
        error: "Trip already cancelled",
      });
      return;
    }

    const tripBookings = await db
      .select({
        bookingId: bookings.bookingId,
        bookedBy: bookings.booked_by,
        pickAddress: bookings.pickAddress,
        dropAddress: bookings.dropAddress,
      })
      .from(bookings)
      .where(eq(bookings.tripId, tripId));

    await db.transaction(async (tx) => {
      // Cancel trip
      await tx
        .update(trips)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(trips.tripId, tripId));

      // Cancel all bookings
      await tx
        .update(bookings)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(bookings.tripId, tripId));
    });

    try {
      for (const booking of tripBookings) {
        const bookedUser = await db
          .select()
          .from(users)
          .where(eq(users.userId, booking.bookedBy))
          .limit(1)
          .then((rows) => rows[0]);

        if (!bookedUser) continue;

        await db.insert(notifications).values({
          receiver: booking.bookedBy,
          sender: driverId,
          bookingId: booking.bookingId,
          tripId,
          type: "trip_cancelled",
          title: "Trip Cancelled",
          message: `Your trip from ${booking.pickAddress} to ${booking.dropAddress} has been cancelled by the driver.`,
        });

        if (bookedUser.expoPushToken) {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: bookedUser.expoPushToken,
              sound: "default",
              title: "Trip Cancelled ❌",
              body: `Your trip from ${booking.pickAddress} to ${booking.dropAddress} has been cancelled.`,
              data: {
                type: "trip_cancelled",
                tripId: String(tripId),
                bookingId: String(booking.bookingId),
              },
            }),
          });
        }
      }
    } catch (notificationError) {
      console.error("❌ Notification error:", notificationError);
    }

    res.status(200).json({
      message: "Trip cancelled successfully",
      trip: {
        tripId,
        status: "cancelled",
      },
    });
  } catch (error) {
    console.error("❌ Cancel trip error:", error);
    res.status(500).json({ error: "Error cancelling trip" });
  }
};

// Get pending ride requests for driver
export const getPendingRideRequests = async (
  req: AuthRequest,
  res: Response,
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
        }),
    );

    res.status(200).json({ requests: requestsWithDetails });
  } catch (error) {
    console.error("Get pending ride requests error:", error);
    res.status(500).json({ error: "Error fetching ride requests" });
  }
};

export const acceptRideRequest = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const bookingId = Number(req.params.bookingId);
    const driverId = req.user!.userId;

    const booking = await db
      .select({
        bookingId: bookings.bookingId,
        status: bookings.status,
        seatsBooked: bookings.seatsBooked,
        bookedBy: bookings.booked_by,
        pickAddress: bookings.pickAddress,
        dropAddress: bookings.dropAddress,
        tripId: bookings.tripId,
        tripDriverId: trips.driverId,
        availableSeats: trips.availableSeats,
      })
      .from(bookings)
      .innerJoin(trips, eq(bookings.tripId, trips.tripId))
      .where(eq(bookings.bookingId, bookingId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    if (booking.tripDriverId !== driverId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    if (booking.status !== "requested") {
      res.status(400).json({
        error: `Booking already ${booking.status}`,
      });
      return;
    }

    const seatsNeeded = booking.seatsBooked ?? 0;

    if (booking.availableSeats < seatsNeeded) {
      res.status(400).json({
        error: `Not enough seats available. Only ${booking.availableSeats} seat(s) left.`,
      });
      return;
    }

    let updatedBooking;

    await db.transaction(async (tx) => {
      [updatedBooking] = await tx
        .update(bookings)
        .set({
          status: "accepted",
          updatedAt: new Date(),
        })
        .where(eq(bookings.bookingId, bookingId))
        .returning();

      await tx
        .update(trips)
        .set({
          availableSeats: booking.availableSeats - seatsNeeded,
          updatedAt: new Date(),
        })
        .where(eq(trips.tripId, booking.tripId));
    });

    try {
      const rider = await db
        .select()
        .from(users)
        .where(eq(users.userId, booking.bookedBy))
        .limit(1)
        .then((rows) => rows[0]);

      if (rider) {
        await db.insert(notifications).values({
          receiver: booking.bookedBy,
          sender: driverId,
          bookingId: booking.bookingId,
          tripId: booking.tripId,
          type: "ride_accepted",
          title: "Ride Request Accepted",
          message: `Your ride request from ${booking.pickAddress} to ${booking.dropAddress} has been accepted.`,
        });

        if (rider.expoPushToken) {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: rider.expoPushToken,
              sound: "default",
              title: "Ride Accepted 🚗",
              body: `Your ride from ${booking.pickAddress} to ${booking.dropAddress} is confirmed.`,
              data: {
                type: "ride_accepted",
                bookingId: String(booking.bookingId),
                tripId: String(booking.tripId),
              },
            }),
          });
        }
      }
    } catch (notificationError) {
      console.error("❌ Notification error:", notificationError);
    }

    res.status(200).json({
      message: "Ride request accepted successfully",
      booking: {
        bookingId: updatedBooking.bookingId,
        status: updatedBooking.status,
        seatsConfirmed: seatsNeeded,
        updatedAt: updatedBooking.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Accept ride request error:", error);
    res.status(500).json({ error: "Error accepting ride request" });
  }
};

// Reject ride request (driver action)
export const rejectRideRequest = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const bookingId = Number(req.params.bookingId);
    const driverId = req.user!.userId;

    const booking = await db
      .select({
        bookingId: bookings.bookingId,
        status: bookings.status,
        bookedBy: bookings.booked_by,
        pickAddress: bookings.pickAddress,
        dropAddress: bookings.dropAddress,
        tripId: bookings.tripId,
        tripDriverId: trips.driverId,
      })
      .from(bookings)
      .innerJoin(trips, eq(bookings.tripId, trips.tripId))
      .where(eq(bookings.bookingId, bookingId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    if (booking.tripDriverId !== driverId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    if (booking.status !== "requested") {
      res.status(400).json({
        error: `Booking already ${booking.status}`,
      });
      return;
    }

    let updatedBooking;

    await db.transaction(async (tx) => {
      [updatedBooking] = await tx
        .update(bookings)
        .set({
          status: "rejected",
          updatedAt: new Date(),
        })
        .where(eq(bookings.bookingId, bookingId))
        .returning();
    });

    try {
      const bookedUser = await db
        .select()
        .from(users)
        .where(eq(users.userId, booking.bookedBy))
        .limit(1)
        .then((rows) => rows[0]);

      if (bookedUser) {
        await db.insert(notifications).values({
          receiver: booking.bookedBy,
          sender: driverId,
          bookingId: booking.bookingId,
          tripId: booking.tripId,
          type: "ride_rejected",
          title: "Ride Request Rejected",
          message: `Your ride request from ${booking.pickAddress} to ${booking.dropAddress} was declined by the driver.`,
        });

        if (bookedUser.expoPushToken) {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: bookedUser.expoPushToken,
              sound: "default",
              title: "Ride Request Declined ❌",
              body: `Your ride from ${booking.pickAddress} to ${booking.dropAddress} was declined. Please try another ride.`,
              data: {
                type: "ride_rejected",
                bookingId: String(booking.bookingId),
                tripId: String(booking.tripId),
              },
            }),
          });
        }
      }
    } catch (notifError) {
      console.error("❌ Notification error:", notifError);
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
    console.error("❌ Reject ride request error:", error);
    res.status(500).json({ error: "Error rejecting ride request" });
  }
};

// Cancel booking (passenger action)
export const cancelBooking = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const bookingId = Number(req.params.bookingId);
    const userId = req.user!.userId;

    const booking = await db
      .select({
        bookingId: bookings.bookingId,
        status: bookings.status,
        seatsBooked: bookings.seatsBooked,
        bookedBy: bookings.booked_by,
        tripId: bookings.tripId,
        pickAddress: bookings.pickAddress,
        dropAddress: bookings.dropAddress,
        tripDriverId: trips.driverId,
        availableSeats: trips.availableSeats,
      })
      .from(bookings)
      .innerJoin(trips, eq(bookings.tripId, trips.tripId))
      .where(
        and(eq(bookings.bookingId, bookingId), eq(bookings.booked_by, userId)),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!booking) {
      res.status(404).json({
        error: "Booking not found or you are not authorized",
      });
      return;
    }

    if (booking.status === "completed") {
      res.status(400).json({
        error: "Cannot cancel a completed booking",
      });
      return;
    }

    if (booking.status.startsWith("cancelled")) {
      res.status(400).json({
        error: "Booking is already cancelled",
      });
      return;
    }

    const seatsToReturn = booking.seatsBooked ?? 0;

    let cancelledBooking;

    await db.transaction(async (tx) => {
      [cancelledBooking] = await tx
        .update(bookings)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(bookings.bookingId, bookingId))
        .returning();

      await tx
        .update(trips)
        .set({
          availableSeats: booking.availableSeats + seatsToReturn,
          updatedAt: new Date(),
        })
        .where(eq(trips.tripId, booking.tripId));
    });

    try {
      const driver = await db
        .select()
        .from(users)
        .where(eq(users.userId, trips.driverId))
        .limit(1)
        .then((rows) => rows[0]);

      const passenger = await db
        .select()
        .from(users)
        .where(eq(users.userId, userId))
        .limit(1)
        .then((rows) => rows[0]);

      const passengerName =
        passenger?.firstname || passenger?.mobile || "A passenger";

      if (driver) {
        await db.insert(notifications).values({
          receiver: driver.userId,
          sender: userId,
          bookingId: booking.bookingId,
          tripId: booking.tripId,
          type: "booking_cancelled_by_passenger",
          title: "Booking Cancelled",
          message: `${passengerName} cancelled their booking (${seatsToReturn} seat(s)). Seats are now available again.`,
        });

        if (driver.expoPushToken) {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: driver.expoPushToken,
              sound: "default",
              title: "Booking Cancelled 🚫",
              body: `${passengerName} cancelled their booking. ${seatsToReturn} seat(s) are now available.`,
              data: {
                type: "booking_cancelled_by_passenger",
                bookingId: String(booking.bookingId),
                tripId: String(booking.tripId),
                riderId: String(userId),
              },
            }),
          });
        }
      }
    } catch (notifError) {
      console.error("❌ Notification error:", notifError);
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

export const getMyBookedRides = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const data = await db
      .select({
        ...getTableColumns(bookings),
        totalDistance: sql<number>`ROUND(ST_Distance(${bookings.pickupLocation}::geography, ${bookings.dropLocation}::geography)::numeric, 2)`,
        bookingId: bookings.bookingId,
        status: bookings.status,
        seatsBooked: bookings.seatsBooked,
        amount: bookings.amount,
        pickAddress: bookings.pickAddress,
        dropAddress: bookings.dropAddress,
        pickLocation: bookings.pickupLocation,
        dropLocation: bookings.dropLocation,
        pickupTime: bookings.pickupTime,
        dropTime: bookings.dropTime,
        tripDate: trips.tripDate,
        departureTime: trips.departureTime,
        arrivalTime: trips.arrivalTime,
      })
      .from(bookings)
      .innerJoin(trips, eq(bookings.tripId, trips.tripId))
      .where(eq(bookings.booked_by, userId))
      .orderBy(desc(bookings.createdAt));

    res.json(data);
  } catch (error) {
    console.error("getMyBookedRides error:", error);
    res.status(500).json({ message: "Failed to fetch booked rides" });
  }
};

export const pickup = async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId } = req.params;

    console.log({ bookingId });

    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.bookingId, Number(bookingId)))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const [updatedBooking] = await db
      .update(bookings)
      .set({
        status: "picked_up",
        updatedAt: new Date(),
      })
      .where(eq(bookings.bookingId, parseInt(bookingId)))
      .returning();

    return res.status(200).json({
      success: true,
      message: "Passenger picked up successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("pickup passenger error:", error);
    res.status(500).json({ error: "Error picking up the passenger" });
  }
};

export const dropOff = async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId } = req.params;

    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.bookingId, Number(bookingId)))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const [updatedBooking] = await db
      .update(bookings)
      .set({
        status: "dropped_off",
        updatedAt: new Date(),
      })
      .where(eq(bookings.bookingId, Number(bookingId)))
      .returning();

    return res.status(200).json({
      success: true,
      message: "Passenger dropped off successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("dropOff passenger error:", error);
    res.status(500).json({ error: "Error droping off the passenger" });
  }
};
