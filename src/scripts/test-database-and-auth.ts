import jwt from "jsonwebtoken";
import { Client } from "pg";

const config = {
  database: {
    host: "localhost",
    port: 5432,
    database: "vehiclepool",
    user: "postgres",
    password: "admin",
  },
  jwt: {
    secret: "your-super-secret-jwt-key-here-change-in-production",
  },
};

async function testDatabase() {
  const client = new Client(config.database);

  try {
    console.log("Connecting to database...");
    await client.connect();

    // Check if there are any users
    const usersResult = await client.query("SELECT * FROM users LIMIT 5");
    console.log("Users in database:", usersResult.rows.length);
    if (usersResult.rows.length > 0) {
      console.log("Sample user:", usersResult.rows[0]);

      // Check vehicles for the first user
      const userId = usersResult.rows[0].userId;
      const vehiclesResult = await client.query(
        "SELECT * FROM vehicles WHERE userId = $1",
        [userId]
      );
      console.log(`Vehicles for user ${userId}:`, vehiclesResult.rows.length);
      console.log("Sample vehicles:", vehiclesResult.rows);

      // Generate a test JWT token for this user
      const token = jwt.sign(
        {
          userId: userId,
          email: usersResult.rows[0].email,
          usertype: usersResult.rows[0].usertype || "user",
        },
        config.jwt.secret
      );
      console.log("\nTest JWT token for user:", token);
      console.log(
        "\nYou can use this token to test the API manually with curl:"
      );
      console.log(
        `curl -X GET "http://localhost:5001/api/vehicles" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json"`
      );
    }
  } catch (error) {
    console.error("Database test failed:", error);
  } finally {
    await client.end();
  }
}

testDatabase();
