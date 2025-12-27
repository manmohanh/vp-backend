const { Pool } = require("pg");
require("dotenv").config();

async function testConnection() {
  console.log("Testing database connection...");
  console.log(
    "DATABASE_URL:",
    process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@")
  );

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const client = await pool.connect();
    console.log("✅ Connected successfully!");

    const result = await client.query("SELECT NOW()");
    console.log("✅ Query executed:", result.rows[0]);

    client.release();
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    console.error("Error code:", error.code);
    console.error(
      "\n🔧 Fix: Update DATABASE_URL in .env with correct Supabase password"
    );
    console.error(
      "Format: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
    );
  } finally {
    await pool.end();
  }
}

testConnection();
