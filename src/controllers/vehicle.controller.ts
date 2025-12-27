import { Response } from "express";
import { db } from "../db";
import { vehicles, documents } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { eq, and } from "drizzle-orm";

export const addVehicle = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, licensePlate, capacity, type, rc } = req.body;

    console.log("vehicle ", req.body);

    // Validate required fields
    if (!name || !licensePlate || !capacity) {
      res.status(400).json({
        error: "Model, license plate, and capacity are required fields",
      });
      return;
    }

    // Check if license plate already exists
    const existingVehicle = await db.query.vehicles.findFirst({
      where: (vehicles, { eq }) => eq(vehicles.licensePlate, licensePlate),
    });

    if (existingVehicle) {
      res.status(400).json({
        error: "A vehicle with this license plate already exists",
      });
      return;
    }

    // Start a transaction to create both vehicle and document
    const result = await db.transaction(async (tx) => {
      // Create new vehicle
      const [newVehicle] = await tx
        .insert(vehicles)
        .values({
          userId: req.user!.userId,
          model: name,
          licensePlate,
          capacity,
          type: type || "car",
          active: true,
          verified: false,
        })
        .returning();

      // If RC URL is provided, create a document record
      if (rc && rc.trim()) {
        await tx.insert(documents).values({
          userId: req.user!.userId,
          documentNumber: licensePlate, // Use license plate as document number for RC
          type: "rc", // Set type as 'rc' for registration certificate
          url: rc,
          active: true,
          status: "pending",
          remarks: `RC document for vehicle ${name} (${licensePlate})`,
        });
      }

      return newVehicle;
    });

    res.status(201).json({
      message: "Vehicle added successfully",
      success: true,
      vehicle: {
        vehicleId: result.vehicleId,
        model: result.model,
        licensePlate: result.licensePlate,
        capacity: result.capacity,
        type: result.type,
        active: result.active,
        verified: result.verified,
        rcUploaded: !!rc,
      },
    });
  } catch (error) {
    console.error("Add vehicle error:", error);
    res.status(500).json({ error: "Error adding vehicle" });
  }
};

export const getMyVehicles = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Get vehicles with their associated documents
    const userVehicles = await db.query.vehicles.findMany({
      where: eq(vehicles.userId, req.user!.userId),
      orderBy: (vehicles, { desc }) => [desc(vehicles.createdAt)],
    });

    // Get all documents for this user
    const userDocuments = await db.query.documents.findMany({
      where: eq(documents.userId, req.user!.userId),
    });

    // Map vehicles with their RC documents
    const vehiclesWithDocs = userVehicles.map((vehicle) => {
      const rcDocument = userDocuments.find(
        (doc) =>
          doc.type === "rc" && doc.documentNumber === vehicle.licensePlate
      );

      return {
        id: vehicle.vehicleId,
        name: vehicle.model,
        licensePlate: vehicle.licensePlate,
        capacity: vehicle.capacity,
        type: vehicle.type,
        active: vehicle.active,
        verified: vehicle.verified,
        rcExpiry: vehicle.rcExpiry,
        pollutionExpiry: vehicle.pollutionExpiry,
        insuranceExpiry: vehicle.insuranceExpiry,
        createdAt: vehicle.createdAt,
        updatedAt: vehicle.updatedAt,
        rcDocument: rcDocument
          ? {
              id: rcDocument.documentId,
              url: rcDocument.url,
              status: rcDocument.status,
              uploadedAt: rcDocument.createdAt,
            }
          : null,
      };
    });

    res.status(200).json({
      success: true,
      vehicles: vehiclesWithDocs,
    });
  } catch (error) {
    console.error("Get vehicles error:", error);
    res.status(500).json({ error: "Error fetching vehicles" });
  }
};

export const updateVehicle = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { vehicleId } = req.params;
    const { model, licensePlate, capacity, type, active, rc } = req.body;

    // Check if vehicle exists and belongs to user
    const existingVehicle = await db.query.vehicles.findFirst({
      where: and(
        eq(vehicles.vehicleId, parseInt(vehicleId)),
        eq(vehicles.userId, req.user!.userId)
      ),
    });

    if (!existingVehicle) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }

    // If license plate is being updated, check for duplicates
    if (licensePlate && licensePlate !== existingVehicle.licensePlate) {
      const duplicateVehicle = await db.query.vehicles.findFirst({
        where: eq(vehicles.licensePlate, licensePlate),
      });

      if (duplicateVehicle) {
        res.status(400).json({
          error: "A vehicle with this license plate already exists",
        });
        return;
      }
    }

    // Start a transaction to update both vehicle and document
    const result = await db.transaction(async (tx) => {
      // Update vehicle
      const [updatedVehicle] = await tx
        .update(vehicles)
        .set({
          model: model || existingVehicle.model,
          licensePlate: licensePlate || existingVehicle.licensePlate,
          capacity: capacity || existingVehicle.capacity,
          type: type || existingVehicle.type,
          active: active !== undefined ? active : existingVehicle.active,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(vehicles.vehicleId, parseInt(vehicleId)),
            eq(vehicles.userId, req.user!.userId)
          )
        )
        .returning();

      // If RC URL is provided, update or create document record
      if (rc && rc.trim()) {
        // Check if RC document already exists
        const existingDoc = await tx.query.documents.findFirst({
          where: and(
            eq(documents.userId, req.user!.userId),
            eq(documents.type, "rc"),
            eq(documents.documentNumber, existingVehicle.licensePlate)
          ),
        });

        if (existingDoc) {
          // Update existing document
          await tx
            .update(documents)
            .set({
              url: rc,
              documentNumber: updatedVehicle.licensePlate, // Update document number if license plate changed
              updatedAt: new Date(),
            })
            .where(eq(documents.documentId, existingDoc.documentId));
        } else {
          // Create new document
          await tx.insert(documents).values({
            userId: req.user!.userId,
            documentNumber: updatedVehicle.licensePlate,
            type: "rc",
            url: rc,
            active: true,
            status: "pending",
            remarks: `RC document for vehicle ${updatedVehicle.model} (${updatedVehicle.licensePlate})`,
          });
        }
      }

      return updatedVehicle;
    });

    res.json({
      message: "Vehicle updated successfully",
      vehicle: {
        vehicleId: result.vehicleId,
        model: result.model,
        licensePlate: result.licensePlate,
        capacity: result.capacity,
        type: result.type,
        active: result.active,
        verified: result.verified,
        updatedAt: result.updatedAt,
        rcUploaded: !!rc,
      },
    });
  } catch (error) {
    console.error("Update vehicle error:", error);
    res.status(500).json({ error: "Error updating vehicle" });
  }
};

export const deleteVehicle = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { vehicleId } = req.params;

    // Check if vehicle exists and belongs to user
    const existingVehicle = await db.query.vehicles.findFirst({
      where: and(
        eq(vehicles.vehicleId, parseInt(vehicleId)),
        eq(vehicles.userId, req.user!.userId)
      ),
    });

    if (!existingVehicle) {
      res.status(404).json({ error: "Vehicle not found" });
      return;
    }

    // Start a transaction to delete both vehicle and associated documents
    await db.transaction(async (tx) => {
      // Delete associated documents first
      await tx
        .delete(documents)
        .where(
          and(
            eq(documents.userId, req.user!.userId),
            eq(documents.type, "rc"),
            eq(documents.documentNumber, existingVehicle.licensePlate)
          )
        );

      // Delete vehicle
      await tx
        .delete(vehicles)
        .where(
          and(
            eq(vehicles.vehicleId, parseInt(vehicleId)),
            eq(vehicles.userId, req.user!.userId)
          )
        );
    });

    res.json({
      message: "Vehicle and associated documents deleted successfully",
    });
  } catch (error) {
    console.error("Delete vehicle error:", error);
    res.status(500).json({ error: "Error deleting vehicle" });
  }
};

// Get driving license document status
export const getDLDocument = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Check if DL document exists for this user
    const existingDoc = await db.query.documents.findFirst({
      where: and(
        eq(documents.userId, req.user!.userId),
        eq(documents.type, "dl")
      ),
    });

    if (existingDoc) {
      res.status(200).json({
        success: true,
        exists: true,
        document: {
          documentId: existingDoc.documentId,
          type: existingDoc.type,
          url: existingDoc.url,
          status: existingDoc.status,
          documentNumber: existingDoc.documentNumber,
        },
      });
    } else {
      res.status(200).json({
        success: true,
        exists: false,
        document: null,
      });
    }
  } catch (error) {
    console.error("Get DL document error:", error);
    res.status(500).json({ error: "Error fetching DL document" });
  }
};

// Add driving license document
export const addDLDocument = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { documentNumber, url, remarks } = req.body;

    console.log("DL document request:", req.body);

    // Validate required fields
    if (!url) {
      res.status(400).json({
        error: "Document URL is required",
      });
      return;
    }

    // Check if DL document already exists for this user
    const existingDoc = await db.query.documents.findFirst({
      where: and(
        eq(documents.userId, req.user!.userId),
        eq(documents.type, "dl")
      ),
    });

    if (existingDoc) {
      // Update existing DL document
      const [updatedDoc] = await db
        .update(documents)
        .set({
          url,
          documentNumber: documentNumber || req.user!.userId.toString(),
          remarks: remarks || "Driving License document",
          updatedAt: new Date(),
        })
        .where(eq(documents.documentId, existingDoc.documentId))
        .returning();

      res.status(200).json({
        message: "DL document updated successfully",
        success: true,
        document: {
          documentId: updatedDoc.documentId,
          type: updatedDoc.type,
          url: updatedDoc.url,
          status: updatedDoc.status,
        },
      });
    } else {
      // Create new DL document
      const [newDoc] = await db
        .insert(documents)
        .values({
          userId: req.user!.userId,
          documentNumber: documentNumber || req.user!.userId.toString(),
          type: "dl",
          url,
          active: true,
          status: "pending",
          remarks: remarks || "Driving License document",
        })
        .returning();

      res.status(201).json({
        message: "DL document added successfully",
        success: true,
        document: {
          documentId: newDoc.documentId,
          type: newDoc.type,
          url: newDoc.url,
          status: newDoc.status,
        },
      });
    }
  } catch (error) {
    console.error("Add DL document error:", error);
    res.status(500).json({ error: "Error adding DL document" });
  }
};
