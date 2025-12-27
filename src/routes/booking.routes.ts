import { Router } from "express";
import { auth } from "../middleware/auth";
import {
  createBooking,
  getUserBookings,
  getBookingById,
  getTripBookings,
  confirmPaymentReceived,
  completeTrip,
  cancelBooking,
  getPendingRideRequests,
  acceptRideRequest,
  rejectRideRequest,
  updateBookingStatus,
  getMyBookedRides,
} from "../controllers/booking.controller";

const router = Router();

// Create a new booking (passenger)
router.post("/", auth, createBooking);

// Get user's bookings (passenger)
router.get("/my-bookings", auth, getUserBookings);

// Get pending ride requests (driver)
router.get("/ride-requests/pending", auth, getPendingRideRequests);

// Get a single booking by ID (passenger or driver)
// router.get("/:bookingId", auth, getBookingById);

// Get bookings for a specific trip (driver)
router.get("/trip/:tripId", auth, getTripBookings);

// Accept ride request (driver)
router.post("/:bookingId/accept", auth, acceptRideRequest);

// Reject ride request (driver)
router.post("/:bookingId/reject", auth, rejectRideRequest);

// Confirm payment received for a booking (driver)
router.post("/:bookingId/confirm-payment", auth, confirmPaymentReceived);

// Complete a trip (driver)
router.post("/trip/:tripId/complete", auth, completeTrip);

// Cancel a booking (passenger)
router.post("/:bookingId/cancel", auth, cancelBooking);

router.put("/:bookingId/status", auth, updateBookingStatus);
router.get("/my-rides", auth, getMyBookedRides);

export default router;
