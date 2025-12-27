import {
  pgTable,
  serial,
  varchar,
  timestamp,
  boolean,
  integer,
  smallint,
  numeric,
  unique,
  geometry,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users Table
export const users = pgTable("users", {
  userId: serial("user_id").primaryKey(),
  firstname: varchar("firstname", { length: 255 }),
  lastname: varchar("lastname", { length: 255 }),
  email: varchar("email", { length: 255 }),
  mobile: varchar("mobile", { length: 15 }),
  photo: varchar("photo", { length: 500 }),
  pincode: integer("pincode"),
  dob: timestamp("dob", { withTimezone: true }),
  usertype: varchar("usertype", { length: 20 }).default("user"),
  gender: varchar("gender", { length: 20 }),
  password: varchar("password", { length: 255 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  lastLoginTime: timestamp("last_login_time", {
    withTimezone: true,
  }).defaultNow(),
  lastLoginDevice: varchar("last_login_device", { length: 255 })
    .default("web")
    .notNull(),
  deviceId: varchar("device_id", { length: 255 }),
  expoPushToken: varchar("expo_push_token", { length: 255 }), // Stores FCM device token for push notifications
  isVerified: boolean("is_verified").default(false),
});

// Vehicles Table
export const vehicles = pgTable(
  "vehicles",
  {
    vehicleId: serial("vehicle_id").primaryKey(),
    userId: integer("user_id").references(() => users.userId),
    model: varchar("model", { length: 255 }),
    licensePlate: varchar("license_plate", { length: 20 }),
    capacity: smallint("capacity"),
    active: boolean("active").default(true),
    verified: boolean("verified").default(false),
    rcExpiry: timestamp("rc_expiry"),
    pollutionExpiry: timestamp("pollution_expiry"),
    insuranceExpiry: timestamp("insurance_expiry"),
    type: varchar("type", { length: 20 }).default("car"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    licensePlateUnique: unique("vehicles_license_plate_unique").on(
      table.licensePlate
    ),
  })
);

// Define vehicle relations
export const vehiclesRelations = relations(
  vehicles,
  ({ one, many }: { one: any; many: any }) => ({
    owner: one(users, {
      fields: [vehicles.userId],
      references: [users.userId],
    }),
    trips: many(trips),
  })
);

// Trips Table
export const trips = pgTable(
  "trips",
  {
    tripId: serial("trip_id").primaryKey(),
    vehicleId: integer("vehicle_id").references(() => vehicles.vehicleId),
    driverId: integer("driver_id").references(() => users.userId),
    startAddress: varchar("start_address", { length: 255 }),
    endAddress: varchar("end_address", { length: 255 }),
    startLocation: geometry("start_location", {
      type: "point",
      mode: "xy",
      srid: 4326,
    }).notNull(),
    endLocation: geometry("end_location", {
      type: "point",
      mode: "xy",
      srid: 4326,
    }).notNull(),
    departureTime: timestamp("departure_time", { withTimezone: true }),
    arrivalTime: timestamp("arrival_time", { withTimezone: true }),
    availableSeats: smallint("available_seats").default(1),
    tripDate: timestamp("trip_date", { withTimezone: true }),
    distanceFlexibility: smallint("distance_flexibility").default(0), // in kilometers
    timeFlexibility: smallint("time_flexibility").default(0), // in minutes
    expectedFare: integer("expected_fare"), // in paise (1 rupee = 100 paise)
    active: boolean("active").default(true).notNull(),
    status: varchar("status", { length: 30 }).default("scheduled"),
    remarks: varchar("remarks", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_start_location").using("gist", t.startLocation),
    index("idx_end_location").using("gist", t.endLocation),
    index("idx_distance_flex").on(t.distanceFlexibility),
    index("idx_trip_date").on(t.tripDate),
  ]
);

// Define trip relations
export const tripsRelations = relations(trips, ({ one, many }) => ({
  vehicle: one(vehicles, {
    fields: [trips.vehicleId],
    references: [vehicles.vehicleId],
  }),
  driver: one(users, {
    fields: [trips.driverId],
    references: [users.userId],
  }),
  bookings: many(bookings),
}));

// Define user relations
export const usersRelations = relations(users, ({ many }) => ({
  vehicles: many(vehicles),

  trips: many(trips),

  bookingsMade: many(bookings, {
    relationName: "bookedBy",
  }),

  paymentsConfirmed: many(bookings, {
    relationName: "paymentConfirmedBy",
  }),

  couponUsages: many(couponUsage),
}));


// Bookings Table
export const bookings = pgTable("bookings", {
  bookingId: serial("booking_id").primaryKey(),
  tripId: integer("trip_id")
    .notNull()
    .references(() => trips.tripId),
  booked_by: integer("booked_by")
    .notNull()
    .references(() => users.userId),
  seatsBooked: smallint("seats_booked").notNull(),
  status: varchar("status", { length: 30 }).default("requested"),
  pickAddress: varchar("pickup_address", { length: 255 }),
  dropAddress: varchar("drop_address", { length: 255 }),
  pickupLocation: geometry("pickup_location", {
    type: "point",
    mode: "xy",
    srid: 4326,
  }).notNull(),
  dropLocation: geometry("drop_location", {
    type: "point",
    mode: "xy",
    srid: 4326,
  }).notNull(),
  pickupTime: timestamp("pickup_time"),
  dropTime: timestamp("drop_time"),
  amount: integer("amount"),
  paymentStatus: varchar("payment_status", { length: 20 }).default("pending"),
  paymentMethod: varchar("payment_method", { length: 20 }).default("cod"),
  paymentReceivedAt: timestamp("payment_received_at", { withTimezone: true }),
  paymentConfirmedBy: integer("payment_confirmed_by").references(
    () => users.userId
  ),
  remarks: varchar("remarks", { length: 1000 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Define booking relations
export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  trip: one(trips, {
    fields: [bookings.tripId],
    references: [trips.tripId],
  }),

  bookedBy: one(users, {
    fields: [bookings.booked_by],
    references: [users.userId],
    relationName: "bookedBy",
  }),

  paymentConfirmedByUser: one(users, {
    fields: [bookings.paymentConfirmedBy],
    references: [users.userId],
    relationName: "paymentConfirmedBy",
  }),
  payments: many(payments),

  couponUsages: many(couponUsage),
}));

// Payments Table
export const payments = pgTable("payments", {
  paymentId: serial("payment_id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.bookingId),
  amount: integer("amount"),
  orderId: varchar("order_id", { length: 20 }),
  transactionId: varchar("transaction_id", { length: 20 }),
  paymentMode: varchar("payment_mode", { length: 20 }).default("cash"),
  paymentMethod: varchar("payment_method", { length: 20 }),
  status: varchar("status", { length: 20 }).default("pending"),
  couponId: integer("coupon_id").references(() => coupons.id),
  couponDiscount: integer("coupon_discount").default(0),
  walletUsed: boolean("wallet_used").default(false),
  walletAmount: integer("wallet_amount").default(0),
  remarks: varchar("remarks", { length: 1000 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Coupons Table
export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    shortcode: varchar("shortcode", { length: 50 }).notNull(),
    startDate: timestamp("startDate", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    endDate: timestamp("endDate", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    type: varchar("type", { length: 20 }).notNull(), // "flat" or "percentage"
    value: integer("value").notNull(), // discount value (amount in paise for flat, percentage for percentage)
    maxUsageLimit: integer("maxUsageLimit"), // total usage limit across all users
    isValidForNewusers: boolean("isValidForNewusers").default(false), // true/false
    maxDiscountAmount: integer("maxDiscountAmount"), // max discount cap for percentage coupons
    minOrderValue: integer("minOrderValue").default(0), // minimum order amount to apply coupon
    createdAt: timestamp("createdAt", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    updatedAt: timestamp("updatedAt", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    isActive: boolean("isActive").default(true),
  },
  (table) => ({
    shortcodeUnique: unique("coupons_shortcode_unique").on(table.shortcode),
  })
);

// Coupon Usage Table - to track which users have used which coupons
export const couponUsage = pgTable("coupon_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.userId)
    .notNull(),
  couponId: integer("coupon_id")
    .references(() => coupons.id)
    .notNull(),
  bookingId: integer("booking_id").references(() => bookings.bookingId),
  discountApplied: integer("discount_applied").notNull(), // actual discount amount applied
  usedAt: timestamp("used_at", { withTimezone: true }).defaultNow(),
  status: varchar("status", { length: 20 }).default("used"), // used, refunded, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Ratings Table
export const ratings = pgTable("ratings", {
  ratingId: serial("rating_id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.tripId),
  userId: integer("user_id").references(() => users.userId),
  rating: smallint("rating"),
  review: varchar("review", { length: 1000 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Documents Table
export const documents = pgTable("documents", {
  documentId: serial("document_id").primaryKey(),
  userId: integer("user_id").references(() => users.userId),
  documentNumber: varchar("document_number", { length: 255 }),
  type: varchar("type", { length: 20 }).default("dl"),
  url: varchar("url", { length: 255 }),
  active: boolean("active").default(true).notNull(),
  status: varchar("status", { length: 20 }).default("pending"),
  remarks: varchar("remarks", { length: 1000 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Referral Transactions Table
export const referralTransactions = pgTable("referral_transactions", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id")
    .references(() => users.userId)
    .notNull(),
  referredId: integer("referred_id")
    .references(() => users.userId)
    .notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"),
  remarks: varchar("remarks", { length: 1000 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Wallets Table
export const wallets = pgTable(
  "wallets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.userId)
      .notNull(),
    balance: integer("balance").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdUnique: unique("wallets_user_id_unique").on(table.userId),
  })
);

// Wallet Transactions Table
export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id")
    .references(() => wallets.id)
    .notNull(),
  transactionType: varchar("transaction_type", { length: 20 }).notNull(),
  amount: integer("amount").notNull(),
  referenceId: integer("reference_id"),
  status: varchar("status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// OTP Table
export const otps = pgTable("otps", {
  otpId: serial("otp_id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.userId)
    .notNull(),
  email: varchar("email", { length: 200 }),
  mobile: varchar("mobile", { length: 15 }),
  otp: varchar("otp", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  verified: boolean("verified").default(false).notNull(),
  deviceId: varchar("device_id", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Notifications Table
export const notifications = pgTable("notifications", {
  notificationId: serial("notification_id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.userId)
    .notNull(),
  bookingId: integer("booking_id").references(() => bookings.bookingId),
  tripId: integer("trip_id").references(() => trips.tripId),
  type: varchar("type", { length: 50 }).notNull(), // 'ride_accepted', 'ride_rejected', 'payment_confirmed', etc.
  title: varchar("title", { length: 255 }).notNull(),
  message: varchar("message", { length: 1000 }).notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Define coupon relations
export const couponsRelations = relations(
  coupons,
  ({ many }: { many: any }) => ({
    couponUsages: many(couponUsage),
    payments: many(payments),
  })
);

// Define coupon usage relations
export const couponUsageRelations = relations(
  couponUsage,
  ({ one }: { one: any }) => ({
    user: one(users, {
      fields: [couponUsage.userId],
      references: [users.userId],
    }),
    coupon: one(coupons, {
      fields: [couponUsage.couponId],
      references: [coupons.id],
    }),
    booking: one(bookings, {
      fields: [couponUsage.bookingId],
      references: [bookings.bookingId],
    }),
  })
);

// Define payment relations
export const paymentsRelations = relations(
  payments,
  ({ one }: { one: any }) => ({
    booking: one(bookings, {
      fields: [payments.bookingId],
      references: [bookings.bookingId],
    }),
    coupon: one(coupons, {
      fields: [payments.couponId],
      references: [coupons.id],
    }),
  })
);
