/**
 * Test Script for Push Notifications
 *
 * This script allows you to manually test sending push notifications
 * without going through the full booking flow.
 *
 * Usage:
 * node test-push-notification.js <userId> <notificationType>
 *
 * Example:
 * node test-push-notification.js 1 new_ride_request
 */

require("dotenv").config();

// Import from compiled dist folder
const {
  sendFirebaseNotification,
} = require("./dist/services/firebaseAdmin.service");
const { db } = require("./dist/db/index");
const { users } = require("./dist/db/schema");
const { eq } = require("drizzle-orm");

// Notification templates
const NOTIFICATION_TEMPLATES = {
  new_ride_request: {
    title: "🚗 New Ride Request! (TEST)",
    body: "Test User wants to book 2 seat(s) from Test Pickup to Test Dropoff",
    data: {
      type: "new_ride_request",
      bookingId: "999",
      tripId: "888",
      riderId: "777",
    },
  },
  ride_accepted: {
    title: "Ride Request Accepted! 🎉 (TEST)",
    body: "Your ride request from Test Pickup to Test Dropoff has been accepted by the driver.",
    data: {
      type: "ride_accepted",
      bookingId: "999",
      tripId: "888",
    },
  },
  ride_rejected: {
    title: "Ride Request Declined (TEST)",
    body: "Your ride request from Test Pickup to Test Dropoff was declined by the driver. Please search for another ride.",
    data: {
      type: "ride_rejected",
      bookingId: "999",
      tripId: "888",
    },
  },
  booking_cancelled_by_passenger: {
    title: "🚫 Booking Cancelled (TEST)",
    body: "Test User has cancelled their booking for 2 seat(s). The seats have been made available again.",
    data: {
      type: "booking_cancelled_by_passenger",
      bookingId: "999",
      tripId: "888",
      riderId: "777",
    },
  },
  document_verified: {
    title: "✅ Document Verified! (TEST)",
    body: "Your Driving License has been verified and approved by admin.",
    data: {
      type: "document_verified",
      documentId: "999",
      documentType: "dl",
    },
  },
  document_rejected: {
    title: "❌ Document Rejected (TEST)",
    body: "Your Driving License was rejected. Please upload a clear and valid document.",
    data: {
      type: "document_rejected",
      documentId: "999",
      documentType: "dl",
    },
  },
};

async function testPushNotification(userId, notificationType) {
  try {
    console.log("\n🧪 TESTING PUSH NOTIFICATION");
    console.log("═".repeat(60));
    console.log(`User ID: ${userId}`);
    console.log(`Notification Type: ${notificationType}`);
    console.log("═".repeat(60));

    // Get user from database
    console.log("\n📋 Step 1: Fetching user from database...");
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.userId, parseInt(userId)));

    if (!user) {
      console.error(`❌ User with ID ${userId} not found`);
      process.exit(1);
    }

    console.log(
      `✅ User found: ${user.firstname || ""} ${user.lastname || ""} (${
        user.mobile
      })`
    );
    console.log(
      `   Push Token: ${
        user.expoPushToken ? "✅ Registered" : "❌ Not registered"
      }`
    );

    if (!user.expoPushToken) {
      console.error("\n❌ ERROR: User has no FCM push token registered!");
      console.log("\n💡 Solution:");
      console.log("   1. Login to the mobile app with this user");
      console.log("   2. The app will automatically register the FCM token");
      console.log("   3. Try this test again");
      process.exit(1);
    }

    // Get notification template
    console.log("\n📋 Step 2: Preparing notification...");
    const template = NOTIFICATION_TEMPLATES[notificationType];

    if (!template) {
      console.error(`❌ Unknown notification type: ${notificationType}`);
      console.log("\n✅ Available types:");
      Object.keys(NOTIFICATION_TEMPLATES).forEach((type) => {
        console.log(`   - ${type}`);
      });
      process.exit(1);
    }

    console.log(`✅ Notification template: ${template.title}`);

    // Send notification
    console.log("\n📋 Step 3: Sending push notification...");
    console.log("   Token:", user.expoPushToken.substring(0, 20) + "...");
    console.log("   Title:", template.title);
    console.log("   Body:", template.body);

    const result = await sendFirebaseNotification({
      token: user.expoPushToken,
      title: template.title,
      body: template.body,
      data: template.data,
      sound: "default",
      priority: "high",
    });

    console.log("\n📋 Step 4: Result");
    console.log("═".repeat(60));
    if (result.success) {
      console.log("✅ SUCCESS! Notification sent successfully!");
      console.log(`   Message ID: ${result.messageId}`);
      console.log("\n📱 Check your mobile device for the notification!");
      console.log("   - If app is in foreground: Check console logs");
      console.log("   - If app is in background: Check notification tray");
      console.log("   - If app is closed: Check notification tray");
    } else {
      console.log("❌ FAILED! Notification was not sent");
      console.log(`   Error: ${result.error}`);

      if (
        result.error?.includes("invalid") ||
        result.error?.includes("not registered")
      ) {
        console.log("\n💡 Solution:");
        console.log("   1. The FCM token may be expired or invalid");
        console.log("   2. Login to the mobile app again to refresh the token");
        console.log("   3. Try this test again");
      }
    }
    console.log("═".repeat(60));
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("📚 USAGE:");
  console.log("   node test-push-notification.js <userId> <notificationType>");
  console.log("\n✅ Available notification types:");
  Object.keys(NOTIFICATION_TEMPLATES).forEach((type) => {
    console.log(`   - ${type}`);
  });
  console.log("\n📝 Example:");
  console.log("   node test-push-notification.js 1 new_ride_request");
  console.log("   node test-push-notification.js 2 ride_accepted");
  console.log("   node test-push-notification.js 3 document_verified");
  process.exit(1);
}

const [userId, notificationType] = args;

// Run test
testPushNotification(userId, notificationType);
