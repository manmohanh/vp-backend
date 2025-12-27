import { db } from "./src/db/index.js";
import { coupons } from "./src/db/schema.js";

async function testDatabase() {
  try {
    console.log("Testing database connection...");

    // Try a simple query first
    const result = await db.select().from(coupons).limit(5);
    console.log("Query successful! Found coupons:", result);
  } catch (error) {
    console.error("Database error:", error);

    // Try to check what tables exist
    try {
      const tables = await db.execute(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%coupon%'
      `);
      console.log("Coupon-related tables:", tables);
    } catch (tableError) {
      console.error("Error checking tables:", tableError);
    }
  }
}

testDatabase();
