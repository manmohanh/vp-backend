import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

// Initialize Firebase Admin SDK
let firebaseApp: admin.app.App;

try {
  // Option 1: Use full JSON from environment variable (for Vercel - single variable)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log(
      "✅ Firebase Admin SDK initialized from FIREBASE_SERVICE_ACCOUNT"
    );
  }
  // Option 2: Use individual environment variables (for Vercel - split variables)
  else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  ) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    console.log(
      "✅ Firebase Admin SDK initialized from individual environment variables"
    );
  }
  // Option 3: Use service account file (for local development)
  else {
    const serviceAccountPath = path.join(
      __dirname,
      "../../credentials/vehiclepooling-f9bc8-771912438278.json"
    );

    // Read and parse the service account file
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf8")
    );

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin SDK initialized from file");
  }
} catch (error) {
  console.error("❌ Error initializing Firebase Admin SDK:", error);
  throw error;
}
interface FirebaseNotification {
  token: string; // FCM device token
  title: string;
  body: string;
  data?: Record<string, string>; // Must be string key-value pairs
  imageUrl?: string;
  sound?: string;
  badge?: number;
  priority?: "high" | "normal"; // Android config priority
  notificationPriority?: "default" | "min" | "low" | "high" | "max"; // Notification display priority
  channelId?: string;
}

interface FirebaseNotificationResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a push notification via Firebase Cloud Messaging using Admin SDK
 */
export async function sendFirebaseNotification(
  notification: FirebaseNotification
): Promise<FirebaseNotificationResponse> {
  try {
    // Validate token
    if (!notification.token || notification.token.trim() === "") {
      console.warn("Empty or invalid FCM token provided");
      return { success: false, error: "Invalid token" };
    }

    // Prepare the message
    const message: admin.messaging.Message = {
      token: notification.token,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: notification.data || {},
      android: {
        priority: notification.priority || "high",
        notification: {
          channelId: notification.channelId || "vehiclepool-notifications",
          sound: notification.sound || "default",
          priority: notification.notificationPriority || "high",
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: notification.sound || "default",
            badge: notification.badge,
            contentAvailable: true,
          },
        },
      },
    };

    // Send the message
    const response = await admin.messaging().send(message);

    console.log("✅ Firebase notification sent successfully:", response);
    return {
      success: true,
      messageId: response,
    };
  } catch (error: any) {
    console.error("❌ Error sending Firebase notification:", error);

    // Handle specific Firebase errors
    if (error.code === "messaging/invalid-registration-token") {
      return {
        success: false,
        error: "Invalid or expired FCM token",
      };
    } else if (error.code === "messaging/registration-token-not-registered") {
      return {
        success: false,
        error: "FCM token not registered",
      };
    }

    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Send notifications to multiple devices
 */
export async function sendMultipleFirebaseNotifications(
  notifications: FirebaseNotification[]
): Promise<FirebaseNotificationResponse[]> {
  try {
    const promises = notifications.map((notification) =>
      sendFirebaseNotification(notification)
    );
    return await Promise.all(promises);
  } catch (error: any) {
    console.error("❌ Error sending multiple Firebase notifications:", error);
    throw error;
  }
}

/**
 * Send notification to multiple tokens (broadcast)
 */
export async function sendFirebaseBroadcast(
  tokens: string[],
  notification: Omit<FirebaseNotification, "token">
): Promise<admin.messaging.BatchResponse> {
  try {
    // Filter out empty tokens
    const validTokens = tokens.filter((token) => token && token.trim() !== "");

    if (validTokens.length === 0) {
      console.warn("No valid tokens provided for broadcast");
      return {
        successCount: 0,
        failureCount: 0,
        responses: [],
      };
    }

    // Prepare multicast message
    const message: admin.messaging.MulticastMessage = {
      tokens: validTokens,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: notification.data || {},
      android: {
        priority: notification.priority || "high",
        notification: {
          channelId: notification.channelId || "vehiclepool-notifications",
          sound: notification.sound || "default",
          priority: notification.notificationPriority || "high",
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: notification.sound || "default",
            badge: notification.badge,
            contentAvailable: true,
          },
        },
      },
    };

    // Send to multiple devices
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(
      `✅ Firebase broadcast sent: ${response.successCount}/${validTokens.length} successful`
    );

    // Log failed tokens for debugging
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(
            `Failed to send to token ${validTokens[idx]}: ${resp.error?.message}`
          );
        }
      });
    }

    return response;
  } catch (error: any) {
    console.error("❌ Error sending Firebase broadcast:", error);
    throw error;
  }
}

/**
 * Send notification using topic (for group messaging)
 */
export async function sendFirebaseTopicNotification(
  topic: string,
  notification: Omit<FirebaseNotification, "token">
): Promise<FirebaseNotificationResponse> {
  try {
    const message: admin.messaging.Message = {
      topic: topic,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: notification.data || {},
      android: {
        priority: notification.priority || "high",
        notification: {
          channelId: notification.channelId || "vehiclepool-notifications",
          sound: notification.sound || "default",
          priority: notification.notificationPriority || "high",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: notification.sound || "default",
            badge: notification.badge,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);

    console.log("✅ Firebase topic notification sent:", response);
    return {
      success: true,
      messageId: response,
    };
  } catch (error: any) {
    console.error("❌ Error sending Firebase topic notification:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Subscribe tokens to a topic
 */
export async function subscribeToTopic(
  tokens: string[],
  topic: string
): Promise<void> {
  try {
    const validTokens = tokens.filter((token) => token && token.trim() !== "");

    if (validTokens.length === 0) {
      console.warn("No valid tokens to subscribe");
      return;
    }

    const response = await admin
      .messaging()
      .subscribeToTopic(validTokens, topic);
    console.log(
      `✅ Subscribed ${response.successCount} tokens to topic: ${topic}`
    );

    if (response.failureCount > 0) {
      console.error(
        `❌ Failed to subscribe ${response.failureCount} tokens to topic`
      );
    }
  } catch (error) {
    console.error("❌ Error subscribing to topic:", error);
    throw error;
  }
}

/**
 * Unsubscribe tokens from a topic
 */
export async function unsubscribeFromTopic(
  tokens: string[],
  topic: string
): Promise<void> {
  try {
    const validTokens = tokens.filter((token) => token && token.trim() !== "");

    if (validTokens.length === 0) {
      console.warn("No valid tokens to unsubscribe");
      return;
    }

    const response = await admin
      .messaging()
      .unsubscribeFromTopic(validTokens, topic);
    console.log(
      `✅ Unsubscribed ${response.successCount} tokens from topic: ${topic}`
    );

    if (response.failureCount > 0) {
      console.error(
        `❌ Failed to unsubscribe ${response.failureCount} tokens from topic`
      );
    }
  } catch (error) {
    console.error("❌ Error unsubscribing from topic:", error);
    throw error;
  }
}

export default {
  sendFirebaseNotification,
  sendMultipleFirebaseNotifications,
  sendFirebaseBroadcast,
  sendFirebaseTopicNotification,
  subscribeToTopic,
  unsubscribeFromTopic,
};
