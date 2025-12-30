import express from "express";
import {
  verifyDocument,
  getPendingDocuments,
  getAllDocuments,
  addDLDocument,
  getDLDocument,
} from "../controllers/document.controller";
import { auth } from "../middleware/auth";

const router = express.Router();

// Admin routes - Document verification
router.put("/admin/documents/:documentId/verify", auth, verifyDocument);
router.get("/admin/documents/pending", auth, getPendingDocuments);
router.get("/admin/documents", auth, getAllDocuments);
router.post("/user/add-dl", auth, addDLDocument);
router.get("/user/get-dl", auth, getDLDocument);

export default router;
