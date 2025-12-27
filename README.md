# VehiclePool Backend

A backend service for the VehiclePool application built with Express.js, Drizzle ORM, and Supabase PostgreSQL.

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account with PostgreSQL database

## Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd vehiclepool-backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:

```
DATABASE_URL=your_supabase_postgres_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=3000
NODE_ENV=development
```

4. Generate database migrations:

```bash
npm run generate
```

5. Run database migrations:

```bash
npm run migrate
```

6. Start the development server:

```bash
npm run dev
```

## API Endpoints

### Authentication

- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user
- POST /api/auth/verify-otp - Verify OTP

### Users

- GET /api/users/profile - Get user profile
- PUT /api/users/profile - Update user profile
- GET /api/users/vehicles - Get user's vehicles

### Vehicles

- POST /api/vehicles - Add a new vehicle
- GET /api/vehicles/:id - Get vehicle details
- PUT /api/vehicles/:id - Update vehicle details
- DELETE /api/vehicles/:id - Delete vehicle

### Trips

- POST /api/trips - Create a new trip
- GET /api/trips - List all trips
- GET /api/trips/:id - Get trip details
- PUT /api/trips/:id - Update trip details
- DELETE /api/trips/:id - Cancel trip

### Bookings

- POST /api/bookings - Create a new booking
- GET /api/bookings - List user's bookings
- GET /api/bookings/:id - Get booking details
- PUT /api/bookings/:id - Update booking status

### Payments

- POST /api/payments - Process payment
- GET /api/payments/:id - Get payment details

### Wallets

- GET /api/wallets - Get wallet balance
- POST /api/wallets/transactions - Add wallet transaction

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests

## License

MIT
