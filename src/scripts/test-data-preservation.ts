import { DatabaseSyncService } from "../services/database-sync.service";
import dotenv from "dotenv";

dotenv.config();

const testDataPreservation = async () => {
  console.log("Testing data preservation during sync...");
  
  try {
    const testMobile = "9999111222";
    
    // Step 1: Create a complete user profile
    console.log("\n1. Creating complete user profile...");
    const completeUser = {
      firstname: "Alice",
      lastname: "Johnson",
      email: "alice@example.com",
      mobile: testMobile,
      photo: "https://example.com/photo.jpg",
      pincode: 560001,
      dob: new Date("1990-01-01"),
      usertype: "user",
      gender: "female",
      password: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginTime: new Date(),
      lastLoginDevice: "web",
      deviceId: "web-device-1",
      isVerified: true,
    };

    const result1 = await DatabaseSyncService.syncUserToAdmin(completeUser);
    console.log(result1 ? "✅ Complete user created" : "❌ Failed to create complete user");

    // Step 2: Simulate login sync with minimal data (like during mobile login)
    console.log("\n2. Simulating login with minimal data...");
    const minimalLoginData = {
      mobile: testMobile,
      firstname: null,
      lastname: null,
      email: null,
      photo: null,
      pincode: null,
      dob: null,
      usertype: "user",
      gender: null,
      password: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginTime: new Date(),
      lastLoginDevice: "mobile",
      deviceId: "mobile-device-1",
      isVerified: true,
    };

    const result2 = await DatabaseSyncService.syncUserToAdmin(minimalLoginData);
    console.log(result2 ? "✅ Login sync completed" : "❌ Login sync failed");

    // Step 3: Update profile with some data
    console.log("\n3. Updating profile with new data...");
    const profileUpdate = {
      firstname: "Alice Updated",
      lastname: "Johnson Updated",
      gender: "female",
      dob: new Date("1990-01-01"),
    };

    const result3 = await DatabaseSyncService.syncProfileUpdate(1, profileUpdate);
    console.log(result3 ? "✅ Profile update synced" : "❌ Profile update failed");

    // Step 4: Sync login event
    console.log("\n4. Syncing login event...");
    const loginEvent = {
      lastLoginTime: new Date(),
      lastLoginDevice: "mobile-app",
      deviceId: "mobile-device-2",
    };

    const result4 = await DatabaseSyncService.syncLoginEvent(1, loginEvent);
    console.log(result4 ? "✅ Login event synced" : "❌ Login event sync failed");

    console.log("\n🎉 Data preservation test completed!");
    console.log("Check your admin database - the user should have:");
    console.log("- firstname: Alice Updated");
    console.log("- lastname: Johnson Updated");
    console.log("- email: alice@example.com (preserved)");
    console.log("- mobile: 9999111222");
    console.log("- photo: https://example.com/photo.jpg (preserved)");
    console.log("- pincode: 560001 (preserved)");
    console.log("- lastLoginDevice: mobile-app (updated)");

    // Close connection
    await DatabaseSyncService.closeAdminDb();
    
  } catch (error) {
    console.error("Error testing data preservation:", error);
  }
};

testDataPreservation();
