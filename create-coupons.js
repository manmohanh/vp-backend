const axios = require("axios");

async function createSampleCoupons() {
  const baseUrl = "http://localhost:5001/api";

  const sampleCoupons = [
    {
      shortcode: "WELCOME10",
      type: "percentage",
      value: 10,
      maxDiscountAmount: 50,
      minOrderValue: 100,
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2025-12-31T23:59:59Z",
      isValidForNewusers: true,
      maxUsageLimit: 100,
    },
    {
      shortcode: "FLAT50",
      type: "flat",
      value: 50,
      maxDiscountAmount: null,
      minOrderValue: 200,
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2025-12-31T23:59:59Z",
      isValidForNewusers: false,
      maxUsageLimit: 50,
    },
    {
      shortcode: "SAVE20",
      type: "percentage",
      value: 20,
      maxDiscountAmount: 100,
      minOrderValue: 300,
      startDate: "2024-01-01T00:00:00Z",
      endDate: "2025-12-31T23:59:59Z",
      isValidForNewusers: false,
      maxUsageLimit: null,
    },
  ];

  // First test if the API is reachable
  try {
    console.log("Testing coupon list API...");
    const listResponse = await axios.get(`${baseUrl}/coupons/list`);
    console.log("Coupon list response:", listResponse.data);

    if (listResponse.data.data && listResponse.data.data.length > 0) {
      console.log("Coupons already exist, skipping creation");
      return;
    }
  } catch (error) {
    console.log("Error testing API:", error.message);
    console.log("Continuing with coupon creation...");
  }

  // Test each coupon creation
  for (const coupon of sampleCoupons) {
    try {
      console.log(`Creating coupon: ${coupon.shortcode}`);

      // For backend API, we need to use a different endpoint or method
      // Let's try directly inserting into database using a different approach
      console.log("Coupon data:", coupon);
    } catch (error) {
      console.error(
        `Error creating coupon ${coupon.shortcode}:`,
        error.response?.data || error.message
      );
    }
  }
}

createSampleCoupons();
