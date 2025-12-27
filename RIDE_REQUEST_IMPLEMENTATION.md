# Ride Request System Implementation

## Overview

This carpooling application implements a driver-approval-based booking system where passengers must wait for driver acceptance before their ride is confirmed.

## Architecture

### Status Flow

```
PASSENGER BOOKS → "requested" → DRIVER ACCEPTS → "confirmed" (seats decreased)
                              ↘ DRIVER REJECTS → "rejected" (no seat change)
```

## Implementation Details

### 1. Create Booking (Passenger Action)

**File:** `src/controllers/booking.controller.ts`
**Function:** `createBooking()`

**What happens:**

- ✅ Validates ride availability and passenger eligibility
- ✅ Creates booking with `status = "requested"`
- ✅ **Does NOT decrease seats** (seats reserved only after driver accepts)
- ✅ Returns booking details to passenger

**Key Code:**

```typescript
const [newBooking] = await db.insert(bookings).values({
  status: "requested", // Awaiting driver approval
  seatsBooked: numberOfSeats,
  // ... other fields
});

// NOTE: Seats NOT decreased here - happens on acceptance
```

**API Endpoint:** `POST /api/bookings`

---

### 2. Get Pending Ride Requests (Driver View)

**Function:** `getPendingRideRequests()`

**What happens:**

- ✅ Fetches all bookings with `status = "requested"` for driver's trips
- ✅ Returns rider details, pickup/drop locations, seats, amount
- ✅ Ordered by creation time (newest first)

**API Endpoint:** `GET /api/bookings/ride-requests/pending`

**Response:**

```json
{
  "requests": [
    {
      "bookingId": 123,
      "tripId": 45,
      "seatsBooked": 2,
      "amount": 500,
      "rider": {
        "name": "John Doe",
        "mobile": "9876543210",
        "photo": "url"
      },
      "startLocation": "Location A",
      "endLocation": "Location B"
    }
  ]
}
```

---

### 3. Accept Ride Request (Driver Action)

**Function:** `acceptRideRequest()`

**What happens:**

1. ✅ Verifies driver owns the trip
2. ✅ Checks booking status is "requested"
3. ✅ Validates enough seats are still available
4. ✅ Updates booking status to "confirmed"
5. ✅ **Decreases available seats in trip**
6. ✅ Returns success with confirmed seat count

**Key Code:**

```typescript
// Check seat availability
if (currentTrip.seats < booking.seatsBooked) {
  return error("Not enough seats");
}

// Update booking status
await db
  .update(bookings)
  .set({ status: "confirmed" })
  .where(eq(bookings.bookingId, bookingId));

// Decrease available seats
await db
  .update(trips)
  .set({ seats: currentTrip.seats - booking.seatsBooked })
  .where(eq(trips.tripId, tripId));
```

**API Endpoint:** `POST /api/bookings/:bookingId/accept`

---

### 4. Reject Ride Request (Driver Action)

**Function:** `rejectRideRequest()`

**What happens:**

1. ✅ Verifies driver owns the trip
2. ✅ Checks booking status is "requested"
3. ✅ Updates booking status to "rejected"
4. ✅ **No seat adjustment** (seats were never reserved)

**Key Code:**

```typescript
await db
  .update(bookings)
  .set({ status: "rejected" })
  .where(eq(bookings.bookingId, bookingId));

// NOTE: No seat return needed - seats never decreased
```

**API Endpoint:** `POST /api/bookings/:bookingId/reject`

---

## Database Schema

### Bookings Table

```sql
CREATE TABLE bookings (
  booking_id SERIAL PRIMARY KEY,
  trip_id INTEGER REFERENCES trips(trip_id),
  rider_id INTEGER REFERENCES users(user_id),
  seats_booked SMALLINT,
  status VARCHAR(20) DEFAULT 'requested', -- 'requested', 'confirmed', 'rejected', 'cancelled', 'completed'
  amount INTEGER,
  payment_status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(20) DEFAULT 'cod',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Trips Table

```sql
CREATE TABLE trips (
  trip_id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES users(user_id),
  vehicle_id INTEGER REFERENCES vehicles(vehicle_id),
  seats SMALLINT NOT NULL, -- Available seats (decreases on acceptance)
  start_location VARCHAR(255),
  end_location VARCHAR(255),
  departure_time TIMESTAMP,
  status VARCHAR(20) DEFAULT 'scheduled',
  active BOOLEAN DEFAULT TRUE
);
```

---

## API Routes

### Booking Routes (`src/routes/booking.routes.ts`)

```typescript
router.post("/", auth, createBooking); // Passenger: Create request
router.get("/ride-requests/pending", auth, getPendingRideRequests); // Driver: View requests
router.post("/:bookingId/accept", auth, acceptRideRequest); // Driver: Accept request
router.post("/:bookingId/reject", auth, rejectRideRequest); // Driver: Reject request
router.post("/:bookingId/cancel", auth, cancelBooking); // Passenger: Cancel booking
```

---

## Mobile App Integration

### API Service (`services/api.ts`)

```typescript
const bookings = {
  createBooking: async (bookingData) => {
    const response = await apiClient.post("/bookings", bookingData);
    return response; // Returns { status: 201, booking with status="requested" }
  },

  getPendingRideRequests: async () => {
    const response = await apiClient.get("/bookings/ride-requests/pending");
    return response; // Returns { status: 200, requests: [...] }
  },

  acceptRideRequest: async (bookingId) => {
    const response = await apiClient.post(`/bookings/${bookingId}/accept`);
    return response; // Returns { status: 200, message, booking }
  },

  rejectRideRequest: async (bookingId) => {
    const response = await apiClient.post(`/bookings/${bookingId}/reject`);
    return response; // Returns { status: 200, message, booking }
  },
};
```

### Ride Requests Screen (`app/ride-requests.tsx`)

- Displays pending ride requests with rider info
- Accept button (green) with 5-second undo option
- Reject button (red) with 5-second undo option
- Pull-to-refresh support
- Real-time UI updates

---

## Key Features

### ✅ Implemented Requirements

1. **No immediate confirmation** - Bookings created with `status="requested"`
2. **Driver approval required** - Separate endpoints for accept/reject
3. **Seat management** - Seats decreased only on acceptance, not on request
4. **Status tracking** - Clear status progression (requested → confirmed/rejected)
5. **Clean modular code** - Separate controller functions, reusable API endpoints
6. **Mobile UI** - Complete ride request screen with accept/reject buttons

### 🎨 UI Features

- Modern card-based design
- 5-second undo functionality
- Prevent accidental taps with proper spacing
- Visual feedback (green for accept, red for reject)
- Loading states and error handling

### 🔒 Security

- Authentication required for all endpoints
- Driver ownership verification
- Seat availability validation
- Duplicate action prevention

---

## Testing

### Test Scenario 1: Successful Acceptance

```bash
# 1. Passenger creates booking
POST /api/bookings
{
  "rideId": 1,
  "numberOfSeats": 2,
  "finalAmount": 500
}
# Response: { booking: { status: "requested" } }
# Trip seats: UNCHANGED (e.g., still 4 seats)

# 2. Driver accepts
POST /api/bookings/123/accept
# Response: { message: "Ride request accepted", booking: { status: "confirmed" } }
# Trip seats: DECREASED (e.g., now 2 seats)
```

### Test Scenario 2: Rejection

```bash
# 1. Passenger creates booking (seats: 4)
POST /api/bookings → status: "requested", trip.seats = 4

# 2. Driver rejects
POST /api/bookings/123/reject → status: "rejected", trip.seats = 4 (unchanged)
```

### Test Scenario 3: Race Condition

```bash
# 1. Two passengers book last 2 seats
Passenger A: POST /api/bookings (2 seats) → requested
Passenger B: POST /api/bookings (2 seats) → requested
# Trip.seats = 2 (unchanged)

# 2. Driver accepts first request
POST /api/bookings/A/accept → confirmed, trip.seats = 0

# 3. Driver tries to accept second request
POST /api/bookings/B/accept → ERROR: "Not enough seats available. Only 0 seat(s) remaining."
```

---

## Future Enhancements

- [ ] Push notifications for acceptance/rejection
- [ ] Automatic expiry of pending requests after X hours
- [ ] Driver can see passenger ratings before accepting
- [ ] Bulk accept/reject multiple requests
- [ ] Analytics dashboard for acceptance rates

---

## Deployment Notes

### Backend (Vercel)

1. Push changes to GitHub
2. Vercel auto-deploys (or manual trigger)
3. Verify endpoints: `https://vehicle-pool-backend.vercel.app/api/bookings/ride-requests/pending`

### Mobile App (EAS Build)

1. Run: `eas build --platform android --profile preview`
2. Wait 15-20 minutes for build
3. Download APK from build link
4. Share with testers

---

## Conclusion

This implementation provides a complete, production-ready ride request system with proper seat management, status tracking, and a user-friendly mobile interface. The modular code structure allows easy integration of notifications, analytics, and other features in the future.
