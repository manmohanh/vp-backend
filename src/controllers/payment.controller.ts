import { Request, Response } from "express";
import Razorpay from "razorpay";
import { db } from "../db";
import { bookings, payments, trips, users, wallets } from "../db/schema";
import { eq } from "drizzle-orm";
import { AuthRequest } from "../middleware/auth";
import crypto from "crypto";
import { sql } from "drizzle-orm";

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY as string,
  key_secret: process.env.RAZORPAY_SECRET as string,
});

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { bookingId, amount, tripId } = req.body;

    const userId = req.user!.userId;

    if (!userId) {
      return res.status(400).json({ message: "Unauthorized" });
    }

    if (!amount || !tripId) {
      return res.status(400).json({ message: "amount & tripId are required" });
    }

    const platformFee = 10;
    const walletAmount = amount - platformFee;

    const trip = await db.query.trips.findFirst({
      where: eq(trips.tripId, tripId),
      columns: {
        driverId: true,
      },
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const driverId = trip.driverId;

    const order = await instance.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `trip_${tripId}_${Date.now()}`,
    });

    await db.insert(payments).values({
      bookingId,
      amount,
      orderId: order.id,
      paymentMode: "online",
      status: "created",
      walletUsed: walletAmount > 0,
      walletAmount,
      remarks: `Driver ID: ${driverId}`,
    });

    return res.status(201).json({
      success: true,
      order,
      driverId,
      bookingId,
      userId,
    });
  } catch (err) {
    console.error("Razorpay Order Error:", err);

    return res.status(500).json({
      message: err instanceof Error ? err.message : "Something went wrong",
    });
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;

    const rawBody = req.body;

    const mySignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest("hex");

    if (signature !== mySignature) {
      console.log("Invalid signature");
      return res.status(400).json({ message: "Invalid signature" });
    }

    const event = JSON.parse(rawBody.toString());

    if (
      event.event === "payment.captured" ||
      event.event === "payment.authorized"
    ) {
      const payment = event.payload.payment.entity;

      const platform = 1000;
      const amountToAdd = payment.amount - platform;

      const userId = payment.notes.user_id;
      const driverId = payment.notes.driver_id;

      const result = await db.transaction(async (tx) => {
        await tx
          .update(payments)
          .set({
            transactionId: payment.id,
            orderId: payment.notes.order_id,
            status: "success",
            paymentMethod: "razorpay",
            updatedAt: new Date(),
          })
          .where(eq(payments.orderId, payment.notes.order_id));

        const booking = await tx
          .update(bookings)
          .set({
            paymentStatus: "paid",
            paymentMethod: "online",
            paymentReceivedAt: new Date(),
            paymentConfirmedBy: userId,
          })
          .where(eq(bookings.bookingId, payment.notes.booking_id))
          .returning();

        await tx
          .insert(wallets)
          .values({
            userId: Number(driverId),
            balance: amountToAdd,
          })
          .onConflictDoUpdate({
            target: wallets.userId,
            set: {
              balance: sql`${wallets.balance} + ${amountToAdd}`,
              updatedAt: new Date(),
            },
          });

        const rider = await tx
          .select()
          .from(users)
          .where(eq(users.userId, Number(driverId)))
          .limit(1);

        return {
          rider: rider[0],
          booking: booking[0],
        };
      });

      //send push notification
      if (result.rider.expoPushToken) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: result.rider.expoPushToken,
            sound: "default",
            title: "Payment Completed Successfully",
            body: `Your payment from ${result.booking.pickAddress} to ${result.booking.dropAddress} is paid.`,
          }),
        });
      }
    }

    if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity;

      await db
        .update(payments)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(payments.orderId, payment.notes.order_id));
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ message: "Webhook processing failed" });
  }
};
