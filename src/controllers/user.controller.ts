import { Request, Response } from "express";
import { eq, and, or, sql } from "drizzle-orm";
import { db } from "../db";
import { users, bookings, trips } from "../db/schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config";
import { AuthRequest } from "../middleware/auth";
import { OTPService } from "../services/otp.service";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstname, lastname, email, mobile, password, gender, pincode } =
      req.body;

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        firstname,
        lastname,
        email,
        mobile,
        password: hashedPassword,
        gender,
        pincode,
      })
      .returning();

    // Generate token
    const token = jwt.sign(
      {
        userId: newUser.userId,
        email: newUser.email,
        usertype: newUser.usertype,
      },
      config.jwt.secret!,
      { expiresIn: config.jwt.expiresIn }
    );

    res.status(201).json({
      user: {
        userId: newUser.userId,
        firstname: newUser.firstname,
        lastname: newUser.lastname,
        email: newUser.email,
        usertype: newUser.usertype,
      },
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Error registering user" });
  }
};

export const initiateLogin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { mobile } = req.body;

    console.log("Mobile ", mobile);

    if (!mobile) {
      res.status(400).json({ error: "Mobile number is required" });
      return;
    }

    // Check if user exists
    let user = await db.query.users.findFirst({
      where: eq(users.mobile, mobile),
    });

    if (!user) {
      // Create a new user with minimal information
      const [newUser] = await db
        .insert(users)
        .values({
          mobile,
          isVerified: false,
        })
        .returning();
      user = newUser;
    }

    // Generate and send OTP
    const otp = await OTPService.createOTP(mobile, user.userId);

    console.log("OTP ", otp);
    // In a production environment, you would send the OTP via SMS
    // For development, we'll just return it in the response
    res.json({
      message: "OTP sent successfully",
      userId: user.userId,
      // Remove this in production
      // otp,
    });
  } catch (error) {
    console.error("Login initiation error:", error);
    res.status(500).json({ error: "Error initiating login" });
  }
};

export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      res.status(400).json({ error: "Mobile and OTP are required" });
      return;
    }

    const otpRecord = await OTPService.verifyOTP(mobile, otp);

    if (!otpRecord) {
      res.status(400).json({ error: "Invalid or expired OTP" });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.userId, otpRecord.userId),
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Generate token
    const token = jwt.sign(
      {
        userId: user.userId,
        mobile: user.mobile,
        usertype: user.usertype,
      },
      config.jwt.secret!,
      { expiresIn: config.jwt.expiresIn }
    );

    // Update last login
    await db
      .update(users)
      .set({
        lastLoginTime: new Date(),
        lastLoginDevice: req.headers["user-agent"] || "web",
      })
      .where(eq(users.userId, user.userId));

    res.status(200).json({
      user: {
        userId: user.userId,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        mobile: user.mobile,
        usertype: user.usertype,
        gender: user.gender,
        pincode: user.pincode,
        dob: user.dob,
        expoPushToken: user.expoPushToken,
        isVerified: user.isVerified,
      },
      token,
      isNewUser: !user.firstname || !user.lastname,
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ error: "Error verifying OTP" });
  }
};

export const completeProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { firstname, lastname, email, gender, dob } = req.body;

    console.log(req.body);

    const [updatedUser] = await db
      .update(users)
      .set({
        firstname,
        lastname,
        email,
        gender,
        dob: dob ? new Date(dob) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.userId, req.user!.userId))
      .returning();

    res.status(200).json({
      user: {
        userId: updatedUser.userId,
        firstname: updatedUser.firstname,
        lastname: updatedUser.lastname,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        usertype: updatedUser.usertype,
        gender: updatedUser.gender,
        pincode: updatedUser.pincode,
        dob: updatedUser.dob,
        expoPushToken: updatedUser.expoPushToken,
        isVerified: updatedUser.isVerified,
      },
    });
  } catch (error) {
    console.error("Profile completion error:", error);
    res.status(500).json({ error: "Error completing profile" });
  }
};

export const getProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.userId, req.user!.userId),
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      userId: user.userId,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      mobile: user.mobile,
      photo: user.photo,
      pincode: user.pincode,
      usertype: user.usertype,
      gender: user.gender,
      dob: user.dob,
      isVerified: user.isVerified,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Error fetching profile" });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { firstname, lastname, mobile, photo, pincode, gender, dob } =
      req.body;

    const [updatedUser] = await db
      .update(users)
      .set({
        firstname,
        lastname,
        mobile,
        photo,
        pincode,
        gender,
        dob: dob ? new Date(dob) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.userId, req.user!.userId))
      .returning();

    res.json({
      userId: updatedUser.userId,
      firstname: updatedUser.firstname,
      lastname: updatedUser.lastname,
      email: updatedUser.email,
      mobile: updatedUser.mobile,
      photo: updatedUser.photo,
      pincode: updatedUser.pincode,
      usertype: updatedUser.usertype,
      gender: updatedUser.gender,
      dob: updatedUser.dob,
      isVerified: updatedUser.isVerified,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Error updating profile" });
  }
};

export const updatePushToken = async (req: AuthRequest, res: Response) => {
  try {
    const { expoPushToken } = req.body;

    // Allow null (logout / disable notifications)
    if (
      expoPushToken !== null &&
      typeof expoPushToken !== "string"
    ) {
      return res.status(400).json({
        error: "expoPushToken must be a string or null",
      });
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        expoPushToken, // can be string OR null
        updatedAt: new Date(),
      })
      .where(eq(users.userId, req.user!.userId))
      .returning();

    res.status(200).json({
      message: "Push token updated successfully",
      userId: updatedUser.userId,
    });
  } catch (error) {
    console.error("Update push token error:", error);
    res.status(500).json({ error: "Error updating push token" });
  }
};


export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Count bookings as passenger (completed rides)
    const passengerBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.tripId, userId),
          or(eq(bookings.status, "completed"), eq(bookings.status, "confirmed"))
        )
      );

    // Count trips as driver (completed trips)
    const driverTrips = await db
      .select()
      .from(trips)
      .where(and(eq(trips.driverId, userId), eq(trips.status, "completed")));

    const ridesAsPassenger = passengerBookings.length;
    const ridesAsDriver = driverTrips.length;
    const totalRides = ridesAsPassenger + ridesAsDriver;

    // For now, return 0 for total distance
    // TODO: Calculate actual distance from trip coordinates
    const totalDistance = 0;

    res.json({
      totalRides,
      ridesAsDriver,
      ridesAsPassenger,
      totalDistance,
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ error: "Error fetching user stats" });
  }
};
