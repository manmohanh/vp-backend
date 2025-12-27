import { Router } from "express";
import { auth } from "../middleware/auth";
import {
  getUserNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/notification.controller";

const router = Router();

// Get all notifications for logged-in user
router.get("/", auth, getUserNotifications);

// Get unread notifications count
router.get("/unread-count", auth, getUnreadNotificationsCount);

// Mark notification as read
router.patch("/:notificationId/read", auth, markNotificationAsRead);

// Mark all notifications as read
router.patch("/read-all", auth, markAllNotificationsAsRead);

export default router;
