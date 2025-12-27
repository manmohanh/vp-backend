import { db } from "./src/db";
import { coupons } from "./src/db/schema";

async function testCoupons() {
  try {
    console.log("Testing database connection and checking coupons...");

    // Fetch all coupons
    const allCoupons = await db.select().from(coupons).limit(10);
    console.log("Coupons found:", allCoupons.length);
    console.log("Coupon data:", JSON.stringify(allCoupons, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

testCoupons();
