import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import config from "../config";

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
    usertype: string;
  };
}

export const auth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, config.jwt.secret!) as {
      userId: number;
      email: string;
      usertype: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Please authenticate." });
  }
};

export const checkUserType = (allowedTypes: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Please authenticate." });
      return;
    }

    if (!allowedTypes.includes(req.user.usertype)) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    next();
  };
};
