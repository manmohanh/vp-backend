import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db/index";
import { notifications } from "../db/schema";
import { eq, desc, and } from "drizzle-orm";

// Get all notifications for a user
export const getUserNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    return res.status(200).json({
      message: "Notifications fetched successfully",
      notifications: userNotifications,
    });
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({
      message: "Error fetching notifications",
      error: error.message,
    });
  }
};

// Get unread notifications count
export const getUnreadNotificationsCount = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const unreadNotifications = await db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      );

    return res.status(200).json({
      message: "Unread count fetched successfully",
      count: unreadNotifications.length,
    });
  } catch (error: any) {
    console.error("Error fetching unread count:", error);
    return res.status(500).json({
      message: "Error fetching unread count",
      error: error.message,
    });
  }
};

// Mark notification as read
export const markNotificationAsRead = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const { notificationId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Verify notification belongs to user
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.notificationId, parseInt(notificationId)));

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Update notification
    const [updatedNotification] = await db
      .update(notifications)
      .set({ isRead: true, updatedAt: new Date() })
      .where(eq(notifications.notificationId, parseInt(notificationId)))
      .returning();

    return res.status(200).json({
      message: "Notification marked as read",
      notification: updatedNotification,
    });
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({
      message: "Error marking notification as read",
      error: error.message,
    });
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    await db
      .update(notifications)
      .set({ isRead: true, updatedAt: new Date() })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      );

    return res.status(200).json({
      message: "All notifications marked as read",
    });
  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    return res.status(500).json({
      message: "Error marking all notifications as read",
      error: error.message,
    });
  }
};

// Helper function to create a notification
export const createNotification = async (
  userId: number,
  type: string,
  title: string,
  message: string,
  bookingId?: number,
  tripId?: number
) => {
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId,
        bookingId,
        tripId,
        type,
        title,
        message,
        isRead: false,
      })
      .returning();

    return notification;
  } catch (error: any) {
    console.error("Error creating notification:", error);
    throw error;
  }
};
