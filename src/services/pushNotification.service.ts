import axios from "axios";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushNotification {
  to: string; // Expo push token
  title: string;
  body: string;
  data?: any;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
  channelId?: string;
}

export async function sendPushNotification(notification: PushNotification) {
  try {
    const message = {
      to: notification.to,
      sound: notification.sound || "default",
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: notification.badge,
      priority: notification.priority || "high",
      channelId: notification.channelId || "default",
    };

    const response = await axios.post(EXPO_PUSH_URL, message, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
    });

    console.log("Push notification sent:", response.data);
    return response.data;
  } catch (error: any) {
    console.error(
      "Error sending push notification:",
      error.response?.data || error.message
    );
    throw error;
  }
}

export async function sendMultiplePushNotifications(
  notifications: PushNotification[]
) {
  try {
    const messages = notifications.map((notification) => ({
      to: notification.to,
      sound: notification.sound || "default",
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: notification.badge,
      priority: notification.priority || "high",
      channelId: notification.channelId || "default",
    }));

    const response = await axios.post(EXPO_PUSH_URL, messages, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
    });

    console.log("Multiple push notifications sent:", response.data);
    return response.data;
  } catch (error: any) {
    console.error(
      "Error sending multiple push notifications:",
      error.response?.data || error.message
    );
    throw error;
  }
}
