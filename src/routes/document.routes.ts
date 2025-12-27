import express from "express";
import {
  verifyDocument,
  getPendingDocuments,
  getAllDocuments,
} from "../controllers/document.controller";
import { auth } from "../middleware/auth";

const router = express.Router();

// Admin routes - Document verification
router.put("/admin/documents/:documentId/verify", auth, verifyDocument);
router.get("/admin/documents/pending", auth, getPendingDocuments);
router.get("/admin/documents", auth, getAllDocuments);

export default router;
