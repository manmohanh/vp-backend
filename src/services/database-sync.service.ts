import { eq } from "drizzle-orm";
import { users, otps, documents } from "../db/schema";
import { db, client } from "../db";

export class DatabaseSyncService {
  private static adminDb = db;

  /**
   * Sync user data to admin database
   */
  static async syncUserToAdmin(userData: any) {
    try {
      const existingUser = await this.adminDb.query.users.findFirst({
        where: eq(users.mobile, userData.mobile),
      });

      if (existingUser) {
        const updateData: any = {
          updatedAt: new Date(),
        };

        Object.entries(userData).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            updateData[key] = value;
          }
        });

        await this.adminDb
          .update(users)
          .set(updateData)
          .where(eq(users.userId, existingUser.userId));
      } else {
        await this.adminDb.insert(users).values({
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      return true;
    } catch (error) {
      console.error("Error syncing user:", error);
      return false;
    }
  }

  /**
   * Sync OTP
   */
  static async syncOtpToAdmin(otpData: any) {
    try {
      await this.adminDb.insert(otps).values({
        ...otpData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return true;
    } catch (error) {
      console.error("Error syncing OTP:", error);
      return false;
    }
  }

  /**
   * Sync document
   */
  static async syncDocumentToAdmin(documentData: any) {
    try {
      const existingDoc = await this.adminDb.query.documents.findFirst({
        where: eq(documents.documentId, documentData.documentId),
      });

      if (existingDoc) {
        await this.adminDb
          .update(documents)
          .set({
            ...documentData,
            updatedAt: new Date(),
          })
          .where(eq(documents.documentId, existingDoc.documentId));
      } else {
        await this.adminDb.insert(documents).values({
          ...documentData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      return true;
    } catch (error) {
      console.error("Error syncing document:", error);
      return false;
    }
  }

  /**
   * Close connection
   */
  static async closeAdminDb() {
    await client.end();
  }
}
