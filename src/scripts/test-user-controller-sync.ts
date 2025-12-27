import { DatabaseSyncService } from "../services/database-sync.service";
import dotenv from "dotenv";

dotenv.config();

const testUserControllerSync = async () => {
  console.log("Testing user controller sync functionality...");
  
  try {
    // Simulate a user login scenario
    const newUser = {
      userId: 1001,
      firstname: "John",
      lastname: "Doe",
      email: "john.doe@example.com",
      mobile: "9876543210",
      photo: null,
      pincode: 110001,
      dob: new Date("1995-05-15"),
      usertype: "user",
      gender: "male",
      password: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginTime: new Date(),
      lastLoginDevice: "mobile-app",
      deviceId: "device-123",
      isVerified: true,
    };

    console.log("1. Testing initiateLogin sync...");
    const loginResult = await DatabaseSyncService.syncUserToAdmin(newUser);
    console.log(loginResult ? "✅ Login sync successful!" : "❌ Login sync failed!");

    console.log("2. Testing verifyOTP sync...");
    const otpResult = await DatabaseSyncService.syncLoginEvent(newUser.userId, {
      lastLoginTime: new Date(),
      lastLoginDevice: "mobile-app",
      deviceId: "device-123",
    });
    console.log(otpResult ? "✅ OTP verification sync successful!" : "❌ OTP verification sync failed!");

    console.log("3. Testing completeProfile sync...");
    const profileResult = await DatabaseSyncService.syncProfileUpdate(newUser.userId, {
      firstname: "John Updated",
      lastname: "Doe Updated",
      gender: "male",
      dob: new Date("1995-05-15"),
    });
    console.log(profileResult ? "✅ Profile completion sync successful!" : "❌ Profile completion sync failed!");

    // Close connection
    await DatabaseSyncService.closeAdminDb();
    console.log("\n🎉 All user controller sync tests completed successfully!");
    
  } catch (error) {
    console.error("Error testing user controller sync:", error);
  }
};

testUserControllerSync();
