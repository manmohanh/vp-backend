import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { coupons } from "./src/db/schema.js";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

async function testCoupons() {
  try {
    console.log("Testing coupon functionality...");

    // Check if coupons table exists and has data
    console.log("1. Checking existing coupons...");
    const existingCoupons = await db.select().from(coupons).limit(5);
    console.log("Existing coupons:", existingCoupons);

    // Create a test coupon
    console.log("2. Creating test coupon...");
    const testCoupon = {
      shortcode: "TEST10",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      type: "percentage",
      value: 10,
      maxUsageLimit: 100,
      isValidForNewusers: false,
      maxDiscountAmount: 20,
      minOrderValue: 100,
      isActive: true,
    };

    // Check if TEST10 already exists
    const existingTest = await db
      .select()
      .from(coupons)
      .where(eq(coupons.shortcode, "TEST10"))
      .limit(1);

    if (existingTest.length === 0) {
      const newCoupon = await db.insert(coupons).values(testCoupon).returning();
      console.log("Created test coupon:", newCoupon[0]);
    } else {
      console.log("TEST10 coupon already exists:", existingTest[0]);
    }

    // Test validation logic manually
    console.log("3. Testing validation for TEST10 with order value 116.84...");
    const testCouponData = await db
      .select()
      .from(coupons)
      .where(eq(coupons.shortcode, "TEST10"))
      .limit(1);

    if (testCouponData.length > 0) {
      const coupon = testCouponData[0];
      const orderValue = 116.84;

      console.log("Coupon data:", coupon);
      console.log("Order value:", orderValue);
      console.log("Min order value:", coupon.minOrderValue);
      console.log("Is active:", coupon.isActive);
      console.log("Is valid for new users:", coupon.isValidForNewusers);

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

      console.log("Calculated discount:", discountAmount);
      console.log("Final amount:", orderValue - discountAmount);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

testCoupons();
