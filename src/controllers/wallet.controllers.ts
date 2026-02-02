import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { wallets } from "../db/schema";
import { eq } from "drizzle-orm";

export const getWalletBalance = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const wallet = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1);

    if (!wallet || wallet.length === 0) {
      return res.json({
        balance: 0,
      });
    }

    return res.json({
      balance: wallet[0].balance,
    });
  } catch (err) {
    console.error("Error fetching wallet balance:", err);
    return res.status(500).json({ message: "Failed to fetch wallet balance" });
  }
};

export const getWalletTransactions = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    return res.json({
      balance: 0,
    });
  } catch (err) {
    console.error("Error fetching wallet balance:", err);
    return res.status(500).json({ message: "Failed to fetch wallet balance" });
  }
};
