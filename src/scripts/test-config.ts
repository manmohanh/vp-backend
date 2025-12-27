const config = {
  database: {
    host: "localhost",
    port: 5432,
    name: "vehiclepool",
    user: "postgres",
    password: "admin",
  },
  jwt: {
    secret: "your-super-secret-jwt-key-here-change-in-production",
  },
};

export default config;
