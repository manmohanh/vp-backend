import { Router } from "express";
import {
  initiateLogin,
  verifyOTP,
  getProfile,
  completeProfile,
  updatePushToken,
  getStats,
} from "../controllers/user.controller";
import { auth } from "../middleware/auth";

const router = Router();

// Public routes
router.post("/request-otp", initiateLogin);
router.post("/verify-otp", verifyOTP);

// Protected routes
router.get("/profile", auth, getProfile);
router.put("/profile", auth, completeProfile);
router.post("/push-token", auth, updatePushToken);
router.get("/stats", auth, getStats);

export default router;
