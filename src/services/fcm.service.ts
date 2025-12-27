import axios from "axios";

// Firebase Cloud Messaging Configuration
// You'll need to get your Server Key from Firebase Console
// https://console.firebase.google.com/project/_/settings/cloudmessaging

const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || "";
const FCM_SEND_URL = "https://fcm.googleapis.com/fcm/send";

interface FCMNotification {
  token: string; // FCM device token
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  sound?: string;
  badge?: number;
  priority?: "high" | "normal";
  channelId?: string;
}

interface FCMResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a push notification via Firebase Cloud Messaging
 */
export async function sendFCMNotification(
  notification: FCMNotification
): Promise<FCMResponse> {
  try {
    if (!FCM_SERVER_KEY) {
      console.warn("FCM_SERVER_KEY not configured. Add it to your .env file.");
      return { success: false, error: "FCM not configured" };
    }

    const message = {
      to: notification.token,
      notification: {
        title: notification.title,
        body: notification.body,
        sound: notification.sound || "default",
        badge: notification.badge,
        image: notification.imageUrl,
      },
      data: notification.data || {},
      priority: notification.priority || "high",
      android: {
        notification: {
          channelId: notification.channelId || "vehiclepool-notifications",
          sound: notification.sound || "default",
          priority: "high",
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

    const response = await axios.post(FCM_SEND_URL, message, {
      headers: {
        Authorization: `key=${FCM_SERVER_KEY}`,
        "Content-Type": "application/json",
      },
    });

    console.log("FCM notification sent successfully:", response.data);
    return {
      success: true,
      messageId: response.data.results?.[0]?.message_id,
    };
  } catch (error: any) {
    console.error(
      "Error sending FCM notification:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
}

/**
 * Send notifications to multiple devices
 */
export async function sendMultipleFCMNotifications(
  notifications: FCMNotification[]
): Promise<FCMResponse[]> {
  try {
    const promises = notifications.map((notification) =>
      sendFCMNotification(notification)
    );
    return await Promise.all(promises);
  } catch (error: any) {
    console.error("Error sending multiple FCM notifications:", error.message);
    throw error;
  }
}

/**
 * Send notification to multiple tokens (broadcast)
 */
export async function sendFCMBroadcast(
  tokens: string[],
  notification: Omit<FCMNotification, "token">
): Promise<FCMResponse[]> {
  try {
    if (!FCM_SERVER_KEY) {
      console.warn("FCM_SERVER_KEY not configured");
      return tokens.map(() => ({
        success: false,
        error: "FCM not configured",
      }));
    }

    const notifications = tokens.map((token) => ({
      ...notification,
      token,
    }));

    return await sendMultipleFCMNotifications(notifications);
  } catch (error: any) {
    console.error("Error sending FCM broadcast:", error.message);
    throw error;
  }
}

/**
 * Send notification using topic (for group messaging)
 */
export async function sendFCMTopicNotification(
  topic: string,
  notification: Omit<FCMNotification, "token">
): Promise<FCMResponse> {
  try {
    if (!FCM_SERVER_KEY) {
      console.warn("FCM_SERVER_KEY not configured");
      return { success: false, error: "FCM not configured" };
    }

    const message = {
      to: `/topics/${topic}`,
      notification: {
        title: notification.title,
        body: notification.body,
        sound: notification.sound || "default",
        badge: notification.badge,
        image: notification.imageUrl,
      },
      data: notification.data || {},
      priority: notification.priority || "high",
    };

    const response = await axios.post(FCM_SEND_URL, message, {
      headers: {
        Authorization: `key=${FCM_SERVER_KEY}`,
        "Content-Type": "application/json",
      },
    });

    console.log("FCM topic notification sent:", response.data);
    return {
      success: true,
      messageId: response.data.message_id,
    };
  } catch (error: any) {
    console.error(
      "Error sending FCM topic notification:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
}

export default {
  sendFCMNotification,
  sendMultipleFCMNotifications,
  sendFCMBroadcast,
  sendFCMTopicNotification,
};
