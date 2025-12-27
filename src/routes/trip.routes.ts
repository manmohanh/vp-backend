import { Router } from "express";
import {
  createTrip,
  getMyTrips,
  searchTrips,
  updateTripStatus,
  cancelTrip,
  getTripDetails,
  getOfferedRides,
  getRideRequests,
} from "../controllers/trip.controller";
import { auth } from "../middleware/auth";

const router = Router();

// Create trip route (protected)
router.post("/", auth, createTrip);

// Get user's trips (protected)
router.get("/my-trips", auth, getMyTrips);

// Search available trips (public)
router.get("/search",auth, searchTrips);

// Get trip details by ID (public)
router.get("/details/:tripId", getTripDetails);

// Update trip status (protected)
router.patch("/:tripId/status", auth, updateTripStatus);

// Cancel trip (protected)
router.post("/:tripId/cancel", auth, cancelTrip);

router.get("/offered-ride",auth,getOfferedRides)
router.get("/:tripId/ride-requests",auth,getRideRequests)

export default router;
