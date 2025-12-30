import { Response } from "express";
import { db } from "../db";
import { documents, users } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { eq, and } from "drizzle-orm";
import { sendFirebaseNotification } from "../services/firebaseAdmin.service";

// Admin: Verify/Approve a document (DL or RC)
export const verifyDocument = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { documentId } = req.params;
    const { status, remarks } = req.body; // status: 'verified' or 'rejected'

    // Check if admin
    const adminUser = await db.query.users.findFirst({
      where: eq(users.userId, req.user!.userId),
    });

    if (!adminUser || adminUser.usertype !== "admin") {
      res.status(403).json({ error: "Unauthorized. Admin access required." });
      return;
    }

    // Validate status
    if (!["verified", "rejected"].includes(status)) {
      res
        .status(400)
        .json({ error: "Invalid status. Must be 'verified' or 'rejected'" });
      return;
    }

    // Get the document
    const document = await db.query.documents.findFirst({
      where: eq(documents.documentId, parseInt(documentId)),
    });

    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Update document status
    const [updatedDocument] = await db
      .update(documents)
      .set({
        status: status,
        remarks:
          remarks ||
          (status === "verified" ? "Document verified" : "Document rejected"),
        updatedAt: new Date(),
      })
      .where(eq(documents.documentId, parseInt(documentId)))
      .returning();

    console.log(`✅ Document ${documentId} status updated to: ${status}`);

    // Send Firebase push notification to the user
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.userId, document.userId!));

      if (user?.expoPushToken) {
        const documentTypeName =
          document.type === "dl"
            ? "Driving License"
            : document.type === "rc"
            ? "RC (Registration Certificate)"
            : "Document";

        const notification =
          status === "verified"
            ? {
                title: "✅ Document Verified!",
                body: `Your ${documentTypeName} has been verified and approved by admin.`,
                data: {
                  type: "document_verified",
                  documentId: String(documentId),
                  documentType: document.type || "unknown",
                },
              }
            : {
                title: "❌ Document Rejected",
                body: `Your ${documentTypeName} was rejected. ${
                  remarks || "Please upload a clear and valid document."
                }`,
                data: {
                  type: "document_rejected",
                  documentId: String(documentId),
                  documentType: document.type || "unknown",
                },
              };

        const result = await sendFirebaseNotification({
          token: user.expoPushToken,
          ...notification,
          sound: "default",
          priority: "high",
        });

        if (result.success) {
          console.log("✅ Document verification notification sent to user");
        } else {
          console.error("⚠️ Failed to send notification:", result.error);
        }
      } else {
        console.log("⚠️ User has no push token registered");
      }
    } catch (notifError) {
      console.error("❌ Error sending Firebase notification:", notifError);
      // Don't fail the request if notification fails
    }

    res.status(200).json({
      message: `Document ${status} successfully`,
      document: {
        documentId: updatedDocument.documentId,
        type: updatedDocument.type,
        status: updatedDocument.status,
        remarks: updatedDocument.remarks,
        updatedAt: updatedDocument.updatedAt,
      },
    });
  } catch (error) {
    console.error("Verify document error:", error);
    res.status(500).json({ error: "Error verifying document" });
  }
};

// Admin: Get all pending documents for verification
export const getPendingDocuments = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Check if admin
    const adminUser = await db.query.users.findFirst({
      where: eq(users.userId, req.user!.userId),
    });

    if (!adminUser || adminUser.usertype !== "admin") {
      res.status(403).json({ error: "Unauthorized. Admin access required." });
      return;
    }

    // Get all pending documents
    const pendingDocs = await db.query.documents.findMany({
      where: eq(documents.status, "pending"),
      orderBy: (documents, { desc }) => [desc(documents.createdAt)],
    });

    // Get user details for each document
    const docsWithUserInfo = await Promise.all(
      pendingDocs.map(async (doc) => {
        const [user] = await db
          .select({
            userId: users.userId,
            firstname: users.firstname,
            lastname: users.lastname,
            mobile: users.mobile,
            email: users.email,
          })
          .from(users)
          .where(eq(users.userId, doc.userId!));

        return {
          ...doc,
          user: user || null,
        };
      })
    );

    res.status(200).json({
      message: "Pending documents retrieved successfully",
      documents: docsWithUserInfo,
      count: docsWithUserInfo.length,
    });
  } catch (error) {
    console.error("Get pending documents error:", error);
    res.status(500).json({ error: "Error fetching pending documents" });
  }
};

// Admin: Get all documents (with optional filters)
export const getAllDocuments = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Check if admin
    const adminUser = await db.query.users.findFirst({
      where: eq(users.userId, req.user!.userId),
    });

    if (!adminUser || adminUser.usertype !== "admin") {
      res.status(403).json({ error: "Unauthorized. Admin access required." });
      return;
    }

    const { status, type } = req.query;

    // Build query conditions
    let conditions = [];
    if (status) {
      conditions.push(eq(documents.status, status as string));
    }
    if (type) {
      conditions.push(eq(documents.type, type as string));
    }

    // Get documents
    const allDocs =
      conditions.length > 0
        ? await db.query.documents.findMany({
            where: and(...conditions),
            orderBy: (documents, { desc }) => [desc(documents.createdAt)],
          })
        : await db.query.documents.findMany({
            orderBy: (documents, { desc }) => [desc(documents.createdAt)],
          });

    // Get user details for each document
    const docsWithUserInfo = await Promise.all(
      allDocs.map(async (doc) => {
        const [user] = await db
          .select({
            userId: users.userId,
            firstname: users.firstname,
            lastname: users.lastname,
            mobile: users.mobile,
            email: users.email,
          })
          .from(users)
          .where(eq(users.userId, doc.userId!));

        return {
          ...doc,
          user: user || null,
        };
      })
    );

    res.status(200).json({
      message: "Documents retrieved successfully",
      documents: docsWithUserInfo,
      count: docsWithUserInfo.length,
    });
  } catch (error) {
    console.error("Get all documents error:", error);
    res.status(500).json({ error: "Error fetching documents" });
  }
};

export const addDLDocument = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { dlNumber, dlUrl } = req.body;

    if (!dlNumber || typeof dlNumber !== "string") {
      res.status(400).json({
        error: "Driver license number is required",
      });
      return;
    }

    if (!dlUrl || typeof dlUrl !== "string") {
      res.status(400).json({
        error: "Driver license document URL is required",
      });
      return;
    }

    const existingDL = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          eq(documents.type, "dl"),
          eq(documents.active, true)
        )
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (existingDL) {
      res.status(409).json({
        error: "An active driver license already exists",
      });
      return;
    }

    const [newDocument] = await db
      .insert(documents)
      .values({
        userId,
        documentNumber: dlNumber.trim(),
        type: "dl",
        url: dlUrl.trim(),
        active: true,
        status: "pending",
        remarks: "Driver License",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json({
      message: "Driver license submitted successfully",
      document: {
        id: newDocument.documentId,
        status: newDocument.status,
        active: newDocument.active,
        createdAt: newDocument.createdAt,
      },
    });
  } catch (error) {
    console.error("Add DL document error:", error);
    res.status(500).json({
      error: "Failed to submit driver license document",
    });
  }
};

export const getDLDocument = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const dlDocument = await db
      .select({
        id: documents.documentId,
        documentNumber: documents.documentNumber,
        url: documents.url,
        status: documents.status,
        remarks: documents.remarks,
        active: documents.active,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          eq(documents.type, "dl"),
          eq(documents.active, true)
        )
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!dlDocument) {
      res.status(404).json({
        error: "Driver license not found",
      });
      return;
    }

    res.status(200).json({
      message: "Driver license fetched successfully",
      document: dlDocument,
    });
  } catch (error) {
    console.error("Get DL document error:", error);
    res.status(500).json({
      error: "Failed to fetch driver license document",
    });
  }
};

export default {
  verifyDocument,
  getPendingDocuments,
  getAllDocuments,
  addDLDocument,
  getDLDocument
};
