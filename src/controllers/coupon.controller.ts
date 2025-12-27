import express, { Response } from "express";
import { db } from "../db";
import { coupons, couponUsage } from "../db/schema";
import { eq, and, lte, gte, sql } from "drizzle-orm";
import { AuthRequest } from "../middleware/auth";

export const couponController = {
  // Get available coupons for the user
  getAvailableCoupons: async (
    req: express.Request,
    res: Response
  ): Promise<void> => {
    try {
      console.log("Getting available coupons...");

      // Get active coupons that are currently valid
      const now = new Date().toISOString();
      const availableCoupons = await db
        .select({
          id: coupons.id,
          shortcode: coupons.shortcode,
          type: coupons.type,
          value: coupons.value,
          startDate: coupons.startDate,
          endDate: coupons.endDate,
          maxUsageLimit: coupons.maxUsageLimit,
          isActive: coupons.isActive,
          maxDiscountAmount: coupons.maxDiscountAmount,
          minOrderValue: coupons.minOrderValue,
        })
        .from(coupons)
        .where(
          and(
            eq(coupons.isActive, true),
            lte(coupons.startDate, now),
            gte(coupons.endDate, now)
          )
        )
        .limit(10);

      console.log("Found coupons:", availableCoupons);

      res.json({
        success: true,
        data: availableCoupons,
      });
    } catch (error) {
      console.error("Error fetching available coupons:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch available coupons",
      });
    }
  },

  // Validate a coupon code
  validateCoupon: async (req: express.Request, res: Response): Promise<any> => {
    try {
      const { shortcode, orderValue } = req.body;

      if (!shortcode || !orderValue) {
        res.status(400).json({
          success: false,
          error: "Shortcode and order value are required",
        });
        return;
      }

      // Find the coupon
      const coupon = await db.query.coupons.findFirst({
        where: eq(coupons.shortcode, shortcode),
      });

      if (!coupon) {
        res.status(404).json({
          success: false,
          error: "Coupon not found",
        });
        return;
      }

      // Check if coupon is active
      if (!coupon.isActive) {
        res.status(400).json({
          success: false,
          error: "Coupon is no longer active",
        });
        return;
      }

      // Check if coupon is within valid date range
      const now = new Date();
      const startDate = new Date(coupon.startDate);
      const endDate = new Date(coupon.endDate);
      if (now < startDate || now > endDate) {
        res.status(400).json({
          success: false,
          error: "Coupon is not valid at this time",
        });
        return;
      }

      // Check minimum order value
      if (orderValue < (coupon.minOrderValue || 0)) {
        res.status(400).json({
          success: false,
          error: `Minimum order value is ₹${coupon.minOrderValue || 0}`,
        });
        return;
      }

      // Check usage limit
      if (coupon.maxUsageLimit) {
        const usageCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(couponUsage)
          .where(eq(couponUsage.couponId, coupon.id));

        if (usageCount[0].count >= coupon.maxUsageLimit) {
          res.status(400).json({
            success: false,
            error: "Coupon usage limit exceeded",
          });
          return;
        }
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.type === "flat") {
        discountAmount = coupon.value;
      } else if (coupon.type === "percentage") {
        discountAmount = Math.floor((orderValue * coupon.value) / 100);
        if (
          coupon.maxDiscountAmount &&
          discountAmount > coupon.maxDiscountAmount
        ) {
          discountAmount = coupon.maxDiscountAmount;
        }
      }

      const finalAmount = Math.max(0, orderValue - discountAmount);

      res.json({
        success: true,
        data: {
          coupon: {
            id: coupon.id,
            shortcode: coupon.shortcode,
            type: coupon.type,
            value: coupon.value,
          },
          orderValue,
          discountAmount,
          finalAmount,
        },
      });
      return;
    } catch (error) {
      console.error("Error validating coupon:", error);
      res.status(500).json({
        success: false,
        error: "Failed to validate coupon",
      });
      return;
    }
  },

  // Apply a coupon (create usage record)
  applyCoupon: async (req: AuthRequest, res: Response): Promise<any> => {
    try {
      const { shortcode, orderValue, bookingId } = req.body;
      const userId = req.user?.userId;

      if (!shortcode || !orderValue || !userId) {
        res.status(400).json({
          success: false,
          error: "Shortcode, order value, and user authentication are required",
        });
        return;
      }

      // Find the coupon
      const coupon = await db.query.coupons.findFirst({
        where: eq(coupons.shortcode, shortcode),
      });

      if (!coupon) {
        res.status(404).json({
          success: false,
          error: "Coupon not found",
        });
        return;
      }

      // Validate the coupon manually here
      if (!coupon.isActive) {
        res.status(400).json({
          success: false,
          error: "Coupon is no longer active",
        });
        return;
      }

      const now = new Date();
      const startDate = new Date(coupon.startDate);
      const endDate = new Date(coupon.endDate);
      if (now < startDate || now > endDate) {
        res.status(400).json({
          success: false,
          error: "Coupon is not valid at this time",
        });
        return;
      }

      if (orderValue < (coupon.minOrderValue || 0)) {
        res.status(400).json({
          success: false,
          error: `Minimum order value is ₹${coupon.minOrderValue || 0}`,
        });
        return;
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.type === "flat") {
        discountAmount = coupon.value;
      } else if (coupon.type === "percentage") {
        discountAmount = Math.floor((orderValue * coupon.value) / 100);
        if (
          coupon.maxDiscountAmount &&
          discountAmount > coupon.maxDiscountAmount
        ) {
          discountAmount = coupon.maxDiscountAmount;
        }
      }

      // Create usage record
      const usageRecord = await db
        .insert(couponUsage)
        .values({
          userId,
          couponId: coupon.id,
          bookingId: bookingId || null,
          discountApplied: discountAmount,
          status: "used",
        })
        .returning();

      const finalAmount = Math.max(0, orderValue - discountAmount);

      res.json({
        success: true,
        data: {
          usageId: usageRecord[0].id,
          coupon: {
            id: coupon.id,
            shortcode: coupon.shortcode,
            type: coupon.type,
            value: coupon.value,
          },
          orderValue,
          discountAmount,
          finalAmount,
        },
      });
      return;
    } catch (error) {
      console.error("Error applying coupon:", error);
      res.status(500).json({
        success: false,
        error: "Failed to apply coupon",
      });
      return;
    }
  },
};
