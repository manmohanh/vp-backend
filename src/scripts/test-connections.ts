import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

const testDatabaseConnections = async () => {
  console.log("Testing database connections...");
  
  // Test backend database
  console.log("\n1. Testing Backend Database Connection:");
  console.log("URL:", process.env.DATABASE_URL);
  
  const backendClient = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await backendClient.connect();
    console.log("✅ Backend database connected successfully");
    await backendClient.end();
  } catch (error) {
    console.log("❌ Backend database connection failed:", error);
  }
  
  // Test admin database
  console.log("\n2. Testing Admin Database Connection:");
  console.log("URL:", process.env.ADMIN_DATABASE_URL);
  
  const adminClient = new Client({
    connectionString: process.env.ADMIN_DATABASE_URL,
  });
  
  try {
    await adminClient.connect();
    console.log("✅ Admin database connected successfully");
    await adminClient.end();
  } catch (error) {
    console.log("❌ Admin database connection failed:", error);
  }
};

testDatabaseConnections();
