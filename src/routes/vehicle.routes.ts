import { Router } from "express";
import {
  addVehicle,
  getMyVehicles,
  updateVehicle,
  deleteVehicle,
  addDLDocument,
  getDLDocument,
} from "../controllers/vehicle.controller";
import { auth } from "../middleware/auth";

const router = Router();

// Add vehicle route (protected)
router.post("/", auth, addVehicle);

// Get user's vehicles (protected)
router.get("/", auth, getMyVehicles);

// Update vehicle (protected)
router.put("/:vehicleId", auth, updateVehicle);

// Delete vehicle (protected)
router.delete("/:vehicleId", auth, deleteVehicle);

// Get DL document status (protected)
router.get("/documents/dl", auth, getDLDocument);

// Add DL document (protected)
router.post("/documents/dl", auth, addDLDocument);

export default router;
