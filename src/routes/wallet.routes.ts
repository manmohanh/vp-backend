import { Router } from "express";
import {
  getWalletBalance,
  getWalletTransactions,
} from "../controllers/wallet.controllers";
import { auth } from "../middleware/auth";

const router = Router();

router.get("/balance", auth, getWalletBalance);
router.get("/transactions", auth, getWalletTransactions);

export default router;
