import { DatabaseSyncService } from "../services/database-sync.service";
import dotenv from "dotenv";

dotenv.config();

const testCompleteFlow = async () => {
  console.log("Testing complete user flow with data preservation...");
  
  try {
    const testMobile = "8888777666";
    
    // Step 1: Simulate initial login (minimal data)
    console.log("\n1. Simulating initial login (minimal data)...");
    const initialUser = {
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
      deviceId: "mobile-123",
      isVerified: false,
    };

    const result1 = await DatabaseSyncService.syncUserToAdmin(initialUser);
    console.log(result1 ? "✅ Initial login synced" : "❌ Initial login sync failed");

    // Step 2: Complete profile
    console.log("\n2. Completing profile...");
    const profileData = {
      firstname: "John",
      lastname: "Doe",
      gender: "male",
      dob: new Date("1995-08-15"),
    };

    const result2 = await DatabaseSyncService.syncProfileUpdate(1, profileData);
    console.log(result2 ? "✅ Profile completion synced" : "❌ Profile completion sync failed");

    // Step 3: Additional profile updates
    console.log("\n3. Updating additional profile fields...");
    const additionalProfile = {
      email: "john.doe@example.com",
      photo: "https://example.com/john.jpg",
      pincode: 411001,
    };

    const result3 = await DatabaseSyncService.syncProfileUpdate(1, additionalProfile);
    console.log(result3 ? "✅ Additional profile update synced" : "❌ Additional profile update sync failed");

    // Step 4: Subsequent login
    console.log("\n4. Simulating subsequent login...");
    const loginUpdate = {
      lastLoginTime: new Date(),
      lastLoginDevice: "mobile-app",
      deviceId: "mobile-456",
    };

    const result4 = await DatabaseSyncService.syncLoginEvent(1, loginUpdate);
    console.log(result4 ? "✅ Login event synced" : "❌ Login event sync failed");

    // Step 5: Final complete user sync
    console.log("\n5. Syncing complete user data...");
    const completeUser = {
      mobile: testMobile,
      firstname: "John",
      lastname: "Doe",
      email: "john.doe@example.com",
      photo: "https://example.com/john.jpg",
      pincode: 411001,
      dob: new Date("1995-08-15"),
      usertype: "user",
      gender: "male",
      password: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginTime: new Date(),
      lastLoginDevice: "mobile-app",
      deviceId: "mobile-456",
      isVerified: true,
    };

    const result5 = await DatabaseSyncService.syncUserToAdmin(completeUser);
    console.log(result5 ? "✅ Complete user sync successful" : "❌ Complete user sync failed");

    console.log("\n🎉 Complete flow test successful!");
    console.log("\nExpected admin database data:");
    console.log("- mobile: 8888777666");
    console.log("- firstname: John");
    console.log("- lastname: Doe");
    console.log("- email: john.doe@example.com");
    console.log("- photo: https://example.com/john.jpg");
    console.log("- pincode: 411001");
    console.log("- gender: male");
    console.log("- lastLoginDevice: mobile-app");
    console.log("- isVerified: true");

    // Close connection
    await DatabaseSyncService.closeAdminDb();
    
  } catch (error) {
    console.error("Error testing complete flow:", error);
  }
};

testCompleteFlow();
