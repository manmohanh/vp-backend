import axios from "axios";

const API_BASE_URL = "http://localhost:5001/api";

async function testVehiclesAPI() {
  try {
    console.log("Testing Vehicles API...");

    // First test without auth (should fail)
    console.log("\n1. Testing without authentication:");
    try {
      const response = await axios.get(`${API_BASE_URL}/vehicles`);
      console.log("Response:", response.data);
    } catch (error: any) {
      console.log("Expected error:", error.response?.data);
    }

    // Test with sample auth token (you'll need to provide a real token)
    console.log("\n2. Testing with authentication:");
    console.log(
      "NOTE: You need to provide a valid token to test this properly"
    );

    // You can manually add a token here for testing
    const token = "YOUR_AUTH_TOKEN_HERE";

    if (token !== "YOUR_AUTH_TOKEN_HERE") {
      try {
        const response = await axios.get(`${API_BASE_URL}/vehicles`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        console.log("Response status:", response.status);
        console.log("Response data:", response.data);
      } catch (error: any) {
        console.log("Error:", error.response?.data);
      }
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testVehiclesAPI();
