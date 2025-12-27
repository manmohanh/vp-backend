import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pg;

async function updateCouponTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to database");

    // Check if coupons table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'coupons'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log("Creating coupons table...");
      await client.query(`
        CREATE TABLE coupons (
          id SERIAL PRIMARY KEY,
          shortcode VARCHAR(50) NOT NULL,
          "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
          "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
          type VARCHAR(20) NOT NULL,
          value INTEGER NOT NULL,
          "maxUsageLimit" INTEGER,
          "isValidForNewusers" BOOLEAN DEFAULT FALSE,
          "maxDiscountAmount" INTEGER,
          "minOrderValue" INTEGER DEFAULT 0,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          "isActive" BOOLEAN DEFAULT TRUE,
          CONSTRAINT coupons_shortcode_unique UNIQUE (shortcode)
        );
      `);
    } else {
      console.log("Coupons table exists, checking columns...");

      // Check current columns
      const columns = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'coupons' 
        ORDER BY ordinal_position;
      `);

      console.log(
        "Current columns:",
        columns.rows.map((r) => r.column_name)
      );

      // If table has wrong columns, recreate it
      const expectedColumns = [
        "id",
        "shortcode",
        "startDate",
        "endDate",
        "type",
        "value",
        "maxUsageLimit",
        "isValidForNewusers",
        "maxDiscountAmount",
        "minOrderValue",
        "createdAt",
        "updatedAt",
        "isActive",
      ];
      const currentColumns = columns.rows.map((r) => r.column_name);

      const hasCorrectSchema = expectedColumns.every((col) =>
        currentColumns.includes(col)
      );

      if (!hasCorrectSchema) {
        console.log("Recreating coupons table with correct schema...");
        await client.query("DROP TABLE IF EXISTS coupons CASCADE");
        await client.query(`
          CREATE TABLE coupons (
            id SERIAL PRIMARY KEY,
            shortcode VARCHAR(50) NOT NULL,
            "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
            "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
            type VARCHAR(20) NOT NULL,
            value INTEGER NOT NULL,
            "maxUsageLimit" INTEGER,
            "isValidForNewusers" BOOLEAN DEFAULT FALSE,
            "maxDiscountAmount" INTEGER,
            "minOrderValue" INTEGER DEFAULT 0,
            "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            "isActive" BOOLEAN DEFAULT TRUE,
            CONSTRAINT coupons_shortcode_unique UNIQUE (shortcode)
          );
        `);
      }
    }

    // Insert sample coupons
    const existingCoupons = await client.query("SELECT COUNT(*) FROM coupons");
    if (existingCoupons.rows[0].count === "0") {
      console.log("Adding sample coupons...");
      await client.query(`
        INSERT INTO coupons (shortcode, "startDate", "endDate", type, value, "maxUsageLimit", "isValidForNewusers", "maxDiscountAmount", "minOrderValue", "isActive")
        VALUES 
          ('WELCOME10', NOW(), NOW() + INTERVAL '30 days', 'percentage', 10, 100, TRUE, 50, 100, TRUE),
          ('FLAT50', NOW(), NOW() + INTERVAL '60 days', 'flat', 50, 50, FALSE, NULL, 200, TRUE),
          ('NEWUSER20', NOW(), NOW() + INTERVAL '90 days', 'percentage', 20, 200, TRUE, 100, 0, TRUE),
          ('SAVE15', NOW(), NOW() + INTERVAL '45 days', 'percentage', 15, NULL, FALSE, 75, 300, TRUE);
      `);
    }

    // Verify the data
    const result = await client.query("SELECT * FROM coupons ORDER BY id");
    console.log(`Found ${result.rows.length} coupons:`, result.rows);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

updateCouponTable();
