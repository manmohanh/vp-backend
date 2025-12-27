import axios from "axios";

interface DistanceMatrixResult {
  distance: number; // in kilometers
  duration: number; // in seconds
  status: string;
}

class GoogleMapsService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
    if (!this.apiKey) {
      console.warn("⚠️  GOOGLE_MAPS_API_KEY not set in environment variables");
    }
  }

  /**
   * Calculate distance between two addresses using Google Distance Matrix API
   */
  async calculateDistance(
    origin: string,
    destination: string
  ): Promise<DistanceMatrixResult | null> {
    if (!this.apiKey) {
      console.error("Google Maps API key not configured");
      return null;
    }

    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/distancematrix/json",
        {
          params: {
            origins: origin,
            destinations: destination,
            key: this.apiKey,
            units: "metric",
          },
        }
      );

      const element = response.data.rows?.[0]?.elements?.[0];

      if (element?.status === "OK") {
        return {
          distance: element.distance.value / 1000, // Convert meters to kilometers
          duration: element.duration.value, // in seconds
          status: "OK",
        };
      }

      console.warn(`Distance Matrix API error: ${element?.status}`);
      return null;
    } catch (error) {
      console.error("Error calling Google Distance Matrix API:", error);
      return null;
    }
  }

  /**
   * Calculate distance between two coordinate pairs
   */
  async calculateDistanceByCoordinates(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<DistanceMatrixResult | null> {
    if (!this.apiKey) {
      console.error("Google Maps API key not configured");
      return null;
    }

    try {
      const origin = `${originLat},${originLng}`;
      const destination = `${destLat},${destLng}`;

      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/distancematrix/json",
        {
          params: {
            origins: origin,
            destinations: destination,
            key: this.apiKey,
            units: "metric",
          },
        }
      );

      const element = response.data.rows?.[0]?.elements?.[0];

      if (element?.status === "OK") {
        return {
          distance: element.distance.value / 1000, // Convert meters to kilometers
          duration: element.duration.value,
          status: "OK",
        };
      }

      console.warn(`Distance Matrix API error: ${element?.status}`);
      return null;
    } catch (error) {
      console.error("Error calling Google Distance Matrix API:", error);
      return null;
    }
  }
}

export default new GoogleMapsService();
