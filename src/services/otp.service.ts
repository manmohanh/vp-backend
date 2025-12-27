import { db } from "../db";
import { otps } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { DatabaseSyncService } from "./database-sync.service";
import axios from "axios";

export class OTPService {
  // MSG91 Configuration
  private static readonly MSG91_AUTH_KEY =
    process.env.MSG91_AUTH_KEY || "475488AzWDOEtwW6909856bP1";
  private static readonly MSG91_TEMPLATE_ID =
    process.env.MSG91_TEMPLATE_ID || "69084001cacda84efa664923";
  private static readonly MSG91_API_URL =
    "https://control.msg91.com/api/v5/otp";

  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP via MSG91 SMS service
   */
  static async sendOTPviaSMS(mobile: string, otp: string): Promise<boolean> {
    try {
      // Remove +91 if present and ensure it's a valid Indian mobile number
      const cleanMobile = mobile.replace(/^\+?91/, "");

      if (cleanMobile.length !== 10) {
        console.error("Invalid mobile number format:", mobile);
        return false;
      }

      // MSG91 API call
      const response = await axios.post(
        `${this.MSG91_API_URL}?template_id=${this.MSG91_TEMPLATE_ID}&mobile=91${cleanMobile}&authkey=${this.MSG91_AUTH_KEY}`,
        {
          OTP: otp,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("MSG91 Response:", response.data);

      // Check if MSG91 returned success
      if (response.data && response.data.type === "success") {
        console.log(`✅ OTP sent successfully to ${cleanMobile}`);
        return true;
      } else {
        console.error(
          "MSG91 API returned non-success response:",
          response.data
        );
        return false;
      }
    } catch (error: any) {
      console.error(
        "Error sending OTP via MSG91:",
        error.response?.data || error.message
      );

      // In development, log the OTP to console as fallback
      if (process.env.NODE_ENV === "development") {
        console.log(`📱 DEV MODE - OTP for ${mobile}: ${otp}`);
        return true; // Return true in dev mode even if SMS fails
      }

      return false;
    }
  }

  static async createOTP(mobile: string, userId: number) {
    const otp = this.generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP valid for 10 minutes

    const [otpRecord] = await db
      .insert(otps)
      .values({
        userId,
        mobile,
        otp,
        expiresAt,
        verified: false,
      })
      .returning();

    // Send OTP via SMS using MSG91
     const smsSent = await this.sendOTPviaSMS(mobile, otp);

    // if (!smsSent) {
    //   console.warn(`⚠️ SMS failed for ${mobile}, but OTP created in database`);
    // }

    // Sync OTP data to admin database
    await DatabaseSyncService.syncOtpToAdmin(otpRecord);

    return otp;
  }

  static async verifyOTP(mobile: string, otp: string) {
    const now = new Date();

    const otpRecord = await db.query.otps.findFirst({
      where: and(
        eq(otps.mobile, mobile),
        eq(otps.otp, otp),
        gt(otps.expiresAt, now),
        eq(otps.verified, false)
      ),
    });

    if (!otpRecord) {
      return null;
    }

    // Mark OTP as verified
    await db
      .update(otps)
      .set({ verified: true })
      .where(eq(otps.otpId, otpRecord.otpId));

    return otpRecord;
  }

  static async isOTPVerified(mobile: string) {
    const otpRecord = await db.query.otps.findFirst({
      where: and(eq(otps.mobile, mobile), eq(otps.verified, true)),
      orderBy: (otps, { desc }) => [desc(otps.createdAt)],
    });

    return !!otpRecord;
  }
}
