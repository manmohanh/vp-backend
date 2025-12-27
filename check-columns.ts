import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function checkColumns() {
  try {
    console.log("Checking actual database columns...");

    // Check columns in coupons table
    const columns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'coupons' 
      ORDER BY ordinal_position;
    `);

    console.log("Coupons table columns:");
    console.log(columns.rows);

    // Try a simple select to see the structure
    const sampleData = await db.execute(sql`SELECT * FROM coupons LIMIT 1;`);
    console.log("Sample coupon data:");
    console.log(sampleData.rows);
  } catch (error) {
    console.error("Error checking columns:", error);
  } finally {
    process.exit(0);
  }
}

checkColumns();
