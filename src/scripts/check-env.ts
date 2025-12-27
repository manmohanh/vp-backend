import dotenv from "dotenv";

dotenv.config();

console.log("Environment Variables:");
console.log("DATABASE_URL:", process.env.DATABASE_URL);
console.log("ADMIN_DATABASE_URL:", process.env.ADMIN_DATABASE_URL);
console.log("JWT_SECRET:", process.env.JWT_SECRET);
