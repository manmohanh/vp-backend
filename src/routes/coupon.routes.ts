import { Router } from "express";
import { auth } from "../middleware/auth";
import { couponController } from "../controllers/coupon.controller";

const router = Router();

// Public routes (no auth required for viewing available coupons)
router.get("/list", couponController.getAvailableCoupons);
router.post("/validate", couponController.validateCoupon);

// Protected routes (require authentication)
router.use(auth);
router.post("/apply", couponController.applyCoupon);

export default router;
