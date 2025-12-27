const jwt = require("jsonwebtoken");

// The token from the mobile app logs
const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjksIm1vYmlsZSI6Ijk4ODUwMzkyODIiLCJ1c2VydHlwZSI6InVzZXIiLCJpYXQiOjE3NTQ3NzE3NTUsImV4cCI6MTc1NTM3NjU1NX0.o4xES-BOn5OrVpRyk-v7Dvdd9DFGH9lXoxQMLVJHjYo";

// JWT secret from backend .env
const jwtSecret = "my_own_jwt_secret_key";

try {
  // Decode without verification first to see the structure
  const decoded = jwt.decode(token);
  console.log("Decoded token payload:", decoded);

  // Try to verify with the secret
  const verified = jwt.verify(token, jwtSecret);
  console.log("Token verification successful:", verified);

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  const exp = decoded.exp;
  console.log("Current timestamp:", now);
  console.log("Token expires at:", exp);
  console.log("Token is expired:", now > exp);
} catch (error) {
  console.error("Token verification failed:", error.message);
}
