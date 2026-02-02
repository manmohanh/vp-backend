import express, { Router } from "express";
import {
  createOrder,
  verifyPayment,
} from "./../controllers/payment.controller";
import { auth } from "../middleware/auth";

const router = Router();

router.post("/create", auth, createOrder);
router.post(
  "/verify",
  express.raw({ type: "application/json" }),
  verifyPayment,
);

export default router;
