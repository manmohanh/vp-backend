# Notification System Implementation

## Overview

This notification system allows passengers to receive real-time updates when drivers accept or reject their ride requests. Notifications are stored in the database and displayed in an in-app notification center.

## Features Implemented

### 1. Backend Features

- ✅ Notifications database table
- ✅ Create notification on ride acceptance
- ✅ Create notification on ride rejection
- ✅ Get all notifications for user
- ✅ Get unread notification count
- ✅ Mark notification as read
- ✅ Mark all notifications as read

### 2. Mobile App Features

- ✅ Notifications screen with list view
- ✅ Notification bell icon on home screen
- ✅ Notification bell icon on rides tab
- ✅ Color-coded notification icons (green for accepted, red for rejected)
- ✅ Unread notification indicator
- ✅ Pull-to-refresh functionality
- ✅ Mark individual notifications as read
- ✅ Mark all notifications as read

## Database Schema

### Notifications Table

```sql
CREATE TABLE notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  booking_id INTEGER REFERENCES bookings(booking_id),
  trip_id INTEGER REFERENCES trips(trip_id),
  type VARCHAR(50) NOT NULL,           -- 'ride_accepted', 'ride_rejected', etc.
  title VARCHAR(255) NOT NULL,         -- Notification title
  message VARCHAR(1000) NOT NULL,      -- Notification message
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

## Backend Implementation

### 1. Notification Controller

**File:** `src/controllers/notification.controller.ts`

**Functions:**

- `getUserNotifications()` - Get all notifications for logged-in user
- `getUnreadNotificationsCount()` - Get count of unread notifications
- `markNotificationAsRead()` - Mark a single notification as read
- `markAllNotificationsAsRead()` - Mark all user's notifications as read
- `createNotification()` - Helper function to create notifications

### 2. Notification Routes

**File:** `src/routes/notification.routes.ts`

**Endpoints:**

```
GET    /api/notifications              - Get all notifications
GET    /api/notifications/unread-count - Get unread count
PATCH  /api/notifications/:id/read     - Mark as read
PATCH  /api/notifications/read-all     - Mark all as read
```

### 3. Integration with Booking Controller

**File:** `src/controllers/booking.controller.ts`

**Accept Ride Request:**

```typescript
// After accepting ride request
await createNotification(
  booking.riderId!,
  "ride_accepted",
  "Ride Request Accepted! 🎉",
  `Your ride request from ${booking.startLocation} to ${booking.endLocation} has been accepted by the driver.`,
  booking.bookingId,
  booking.tripId
);
```

**Reject Ride Request:**

```typescript
// After rejecting ride request
await createNotification(
  booking.riderId!,
  "ride_rejected",
  "Ride Request Declined",
  `Your ride request from ${booking.startLocation} to ${booking.endLocation} was declined by the driver. Please search for another ride.`,
  booking.bookingId,
  booking.tripId
);
```

## Mobile App Implementation

### 1. API Service

**File:** `services/api.ts`

```typescript
const notifications = {
  getNotifications: async () => {...},
  getUnreadCount: async () => {...},
  markAsRead: async (notificationId: number) => {...},
  markAllAsRead: async () => {...},
};
```

### 2. Notifications Screen

**File:** `app/notifications.tsx`

**Features:**

- Card-based UI with color-coded icons
- Unread indicator (blue dot)
- Timestamp display
- Pull-to-refresh
- Mark all as read button
- Navigation to booking details
- Empty state with icon

**Notification Types:**

- `ride_accepted` - Green checkmark icon
- `ride_rejected` - Red X icon
- `payment_confirmed` - Blue cash icon
- `trip_completed` - Purple flag icon

### 3. UI Integration

**Updated Files:**

- `app/(tabs)/index.tsx` - Added notification bell to home header
- `app/(tabs)/rides.tsx` - Added notification bell next to requests button

## Setup Instructions

### 1. Run Database Migration

```bash
cd vehicle-pool-backend
node run-notifications-migration.js
```

This will create the notifications table with indexes.

### 2. Start Backend Server

```bash
cd vehicle-pool-backend
npm run dev
```

### 3. Test the Flow

1. **Passenger creates a ride request:**

   - Go to search screen
   - Find a ride and book it
   - Status will be "requested"

2. **Driver accepts/rejects the request:**

   - Driver opens "Requests" button on Rides tab
   - Driver sees pending request
   - Driver clicks "Accept" or "Reject"

3. **Passenger receives notification:**
   - Passenger sees notification bell icon highlighted
   - Tap bell icon to open notifications screen
   - See "Ride Request Accepted!" or "Ride Request Declined" notification
   - Tap notification to view booking details

## API Examples

### Get All Notifications

```bash
GET /api/notifications
Authorization: Bearer <token>

Response:
{
  "message": "Notifications fetched successfully",
  "notifications": [
    {
      "notificationId": 1,
      "userId": 123,
      "bookingId": 456,
      "tripId": 789,
      "type": "ride_accepted",
      "title": "Ride Request Accepted! 🎉",
      "message": "Your ride request from Mumbai to Pune has been accepted by the driver.",
      "isRead": false,
      "createdAt": "2025-11-17T10:30:00Z",
      "updatedAt": "2025-11-17T10:30:00Z"
    }
  ]
}
```

### Get Unread Count

```bash
GET /api/notifications/unread-count
Authorization: Bearer <token>

Response:
{
  "message": "Unread count fetched successfully",
  "count": 3
}
```

### Mark Notification as Read

```bash
PATCH /api/notifications/1/read
Authorization: Bearer <token>

Response:
{
  "message": "Notification marked as read",
  "notification": {
    "notificationId": 1,
    "isRead": true,
    ...
  }
}
```

### Mark All as Read

```bash
PATCH /api/notifications/read-all
Authorization: Bearer <token>

Response:
{
  "message": "All notifications marked as read"
}
```

## UI Screenshots Description

### Home Screen

- Notification bell icon in top-right corner
- Tapping opens notifications screen

### Rides Tab

- Two buttons in header:
  - Notification bell (left) - Opens notifications
  - Requests button (right) - Opens ride requests

### Notifications Screen

- Card-based layout
- Color-coded icons based on notification type
- Unread notifications have:
  - Light blue background
  - Blue left border
  - Blue dot indicator
- Timestamp in "MMM dd, yyyy • hh:mm a" format
- Pull-to-refresh support
- "Mark all read" button when unread notifications exist

## Notification Flow Diagram

```
PASSENGER BOOKS RIDE
        ↓
Status: "requested"
        ↓
Driver sees in "Requests"
        ↓
   Driver decides
    ↙         ↘
ACCEPT        REJECT
   ↓             ↓
Status:       Status:
"confirmed"   "rejected"
   ↓             ↓
   ↓             ↓
CREATE NOTIFICATION (both paths)
   ↓
Notification stored in DB
   ↓
Passenger sees bell icon
   ↓
Opens notifications screen
   ↓
Taps notification
   ↓
Opens booking detail screen
```

## Testing Checklist

### Backend Testing

- [ ] Create notifications table successfully
- [ ] Notification created when driver accepts request
- [ ] Notification created when driver rejects request
- [ ] GET /api/notifications returns all notifications
- [ ] GET /api/notifications/unread-count returns correct count
- [ ] PATCH /api/notifications/:id/read marks notification as read
- [ ] PATCH /api/notifications/read-all marks all as read

### Mobile App Testing

- [ ] Notification bell visible on home screen
- [ ] Notification bell visible on rides tab
- [ ] Tapping bell opens notifications screen
- [ ] Accepted ride notification shows green icon
- [ ] Rejected ride notification shows red icon
- [ ] Unread notifications have blue background and dot
- [ ] Tapping notification marks it as read
- [ ] Tapping notification navigates to booking detail
- [ ] Pull-to-refresh fetches new notifications
- [ ] "Mark all read" button works correctly
- [ ] Empty state displays when no notifications

## Future Enhancements

### Phase 1 - Push Notifications (Recommended)

- Install `expo-notifications`
- Request push notification permissions
- Store device push tokens in database
- Send push notifications from backend
- Handle notification taps when app is closed

### Phase 2 - Real-time Updates

- Implement WebSocket connection
- Push notifications instantly without refresh
- Show notification badge count on bell icon

### Phase 3 - Advanced Features

- Notification preferences/settings
- Notification categories (rides, payments, trips)
- Notification history archive
- Delete individual notifications
- Notification sound/vibration settings

### Phase 4 - Analytics

- Track notification open rates
- Monitor notification delivery success
- A/B test notification messages
- User engagement metrics

## Troubleshooting

### Notifications Not Appearing

1. Check if backend is running and deployed
2. Verify database migration ran successfully
3. Check API logs for errors during notification creation
4. Test API endpoints directly with Postman/curl
5. Check mobile app console for API errors

### TypeScript Errors

- Ensure `AuthRequest` type is imported correctly
- Run `npm run build` to check for compilation errors
- Verify all imports use `.js` extension for ESM

### UI Issues

- Clear app cache and restart
- Rebuild APK with latest changes
- Check console logs for render errors
- Verify all required packages are installed

## Summary

This implementation provides a complete in-app notification system that:

- ✅ Notifies passengers when rides are accepted/rejected
- ✅ Stores notifications in database for persistence
- ✅ Provides clean, intuitive UI
- ✅ Supports read/unread states
- ✅ Integrates seamlessly with existing booking flow
- ✅ Can be extended to push notifications in the future

The system is production-ready and can handle multiple notification types. Adding push notifications would be the next logical enhancement.
