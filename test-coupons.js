import { db } from "./src/db/index";
import { coupons } from "./src/db/schema";

async function testCouponAPI() {
  try {
    console.log("Testing coupon API...");

    // Check if there are any coupons in the database
    const existingCoupons = await db.select().from(coupons);
    console.log(
      `Found ${existingCoupons.length} coupons in database:`,
      existingCoupons
    );

    // If no coupons exist, let's create some sample ones
    if (existingCoupons.length === 0) {
      console.log("No coupons found. Creating sample coupons...");

      const sampleCoupons = await db
        .insert(coupons)
        .values([
          {
            shortcode: "WELCOME10",
            startDate: new Date("2024-01-01"),
            endDate: new Date("2025-12-31"),
            type: "percentage",
            value: 10,
            maxUsageLimit: 100,
            isValidForNewusers: true,
            maxDiscountAmount: 50,
            minOrderValue: 100,
            isActive: true,
          },
          {
            shortcode: "FLAT50",
            startDate: new Date("2024-01-01"),
            endDate: new Date("2025-12-31"),
            type: "flat",
            value: 50,
            maxUsageLimit: 50,
            isValidForNewusers: false,
            maxDiscountAmount: null,
            minOrderValue: 200,
            isActive: true,
          },
          {
            shortcode: "SAVE20",
            startDate: new Date("2024-01-01"),
            endDate: new Date("2025-12-31"),
            type: "percentage",
            value: 20,
            maxUsageLimit: null,
            isValidForNewusers: false,
            maxDiscountAmount: 100,
            minOrderValue: 300,
            isActive: true,
          },
        ])
        .returning();

      console.log("Created sample coupons:", sampleCoupons);
    }

    // Test the API endpoint
    console.log("\nTesting coupon API endpoint...");
    const response = await fetch(
      "http://localhost:5001/api/coupons/list?minOrderValue=100"
    );
    const data = await response.json();
    console.log("API Response:", data);
  } catch (error) {
    console.error("Error testing coupon API:", error);
  } finally {
    process.exit(0);
  }
}

testCouponAPI();
