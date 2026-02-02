import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// import { migrate } from "drizzle-orm/node-postgres/migrator";
// import db from "./db";
// aadding for deployment
import userRoutes from "./routes/user.routes";
import vehicleRoutes from "./routes/vehicle.routes";
import tripRoutes from "./routes/trip.routes";
import couponRoutes from "./routes/coupon.routes";
import bookingRoutes from "./routes/booking.routes";
import notificationRoutes from "./routes/notification.routes";
import documentRoutes from "./routes/document.routes";
import paymentRoutes from "./routes/payment.routes";
import walletRoutes from "./routes/wallet.routes";
import config from "./config";
import { verifyPayment } from "./controllers/payment.controller";

dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: "*",
  }),
);

app.post(
  "/api/payments/verify",
  express.raw({ type: "application/json" }),
  verifyPayment,
);

app.use(express.json());

// Routes
app.get("/", (_req, res) => {
  res.json({ message: "Welcome to VehiclePool API" });
});

// API routes
app.use("/api/users", userRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/wallet", walletRoutes);

// Error handling middleware
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
  },
);

// Start server
const startServer = async () => {
  try {
    // Skip migrations for now since the database is already up to date
    console.log("Skipping migrations - database is already synced");

    // Start the server
    app.listen(parseInt(config.port.toString()), "0.0.0.0", () => {
      console.log(`Server is running on port ${config.port}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
};

// startServer();

export default app;
