import { DatabaseSyncService } from "../services/database-sync.service";
import dotenv from "dotenv";

dotenv.config();

const testDatabaseSync = async () => {
  console.log("Testing database sync functionality...");
  
  try {
    // Test user sync
    const testUser = {
      userId: 999,
      firstname: "Test",
      lastname: "User",
      email: "test@example.com",
      mobile: "9999999999",
      photo: null,
      pincode: 123456,
      dob: new Date("1990-01-01"),
      usertype: "user",
      gender: "male",
      password: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginTime: new Date(),
      lastLoginDevice: "test-device",
      deviceId: "test-device-id",
      isVerified: true,
    };

    console.log("Syncing test user to admin database...");
    const result = await DatabaseSyncService.syncUserToAdmin(testUser);
    
    if (result) {
      console.log("✅ User sync successful!");
    } else {
      console.log("❌ User sync failed!");
    }

    // Test login event sync
    console.log("Syncing login event to admin database...");
    const loginResult = await DatabaseSyncService.syncLoginEvent(testUser.userId, {
      lastLoginTime: new Date(),
      lastLoginDevice: "test-login-device",
      deviceId: "test-login-device-id",
    });

    if (loginResult) {
      console.log("✅ Login event sync successful!");
    } else {
      console.log("❌ Login event sync failed!");
    }

    // Close connection
    await DatabaseSyncService.closeAdminDb();
    console.log("Database sync test completed!");
    
  } catch (error) {
    console.error("Error testing database sync:", error);
  }
};

testDatabaseSync();
