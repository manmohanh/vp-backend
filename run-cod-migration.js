const { Pool } = require("postgres");
require("dotenv").config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔄 Starting migration: Adding COD payment fields...");

    // Read the migration SQL
    const migrationSQL = `
-- Migration to add COD payment tracking fields to bookings table

-- Add payment_status and payment_method to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cod',
ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_confirmed_by INTEGER REFERENCES users(user_id);

-- Add index for faster queries on payment status
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_payment ON bookings(trip_id, payment_status);

-- Update existing bookings to have COD as payment method
UPDATE bookings SET payment_method = 'cod' WHERE payment_method IS NULL;
`;

    await pool.query(migrationSQL);

    console.log("✅ Migration completed successfully!");
    console.log("");
    console.log("New columns added to bookings table:");
    console.log('  - payment_status (VARCHAR(20), default: "pending")');
    console.log('  - payment_method (VARCHAR(20), default: "cod")');
    console.log("  - payment_received_at (TIMESTAMP)");
    console.log("  - payment_confirmed_by (INTEGER)");
    console.log("");
    console.log("✅ Your backend is now ready to handle COD bookings!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error("");
    console.error("Error details:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
