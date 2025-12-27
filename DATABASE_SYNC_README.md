# Database Synchronization Setup

This implementation ensures that user login and profile data from the mobile app backend is automatically synchronized to the admin database.

## What's Implemented

### 1. Database Sync Service (`src/services/database-sync.service.ts`)
- **syncUserToAdmin**: Synchronizes user data to the admin database
- **syncOtpToAdmin**: Synchronizes OTP records to the admin database  
- **syncLoginEvent**: Synchronizes login events (last login time, device info)
- **syncProfileUpdate**: Synchronizes profile updates to the admin database

### 2. Updated Controllers
- **User Controller**: Modified to include database sync calls
  - `initiateLogin`: Syncs new users to admin database
  - `verifyOTP`: Syncs login events and updated user data
  - `completeProfile`: Syncs profile completion data
  - `updateProfile`: Syncs profile updates

### 3. Updated Services
- **OTP Service**: Modified to sync OTP records to admin database

### 4. Environment Configuration
Added `ADMIN_DATABASE_URL` environment variable to connect to the admin database.

## Environment Variables

Add to your `.env` file:
```
ADMIN_DATABASE_URL=postgresql://postgres:Cherry@19@db.rwwhdlgtvrwndofqslay.supabase.co:5432/postgres
```

## How It Works

1. **User Registration/Login**: When a user logs in through the mobile app:
   - User data is saved to the backend database
   - **Automatically synced** to the admin database

2. **OTP Generation**: When an OTP is generated:
   - OTP record is saved to the backend database
   - **Automatically synced** to the admin database

3. **Login Events**: When a user successfully logs in:
   - Login timestamp and device info are updated in the backend database
   - **Automatically synced** to the admin database

4. **Profile Updates**: When a user updates their profile:
   - Profile data is updated in the backend database
   - **Automatically synced** to the admin database

## Data Flow

```
Mobile App → Backend Database → Admin Database
           (API Call)      (Auto Sync)
```

## Benefits

1. **Real-time Sync**: Admin panel always has the latest user data
2. **No Manual Intervention**: Automatic synchronization on every login/update
3. **Data Consistency**: Both databases stay in sync
4. **Audit Trail**: All login events and profile changes are tracked in admin database

## Testing

Run the test script to verify database sync functionality:
```bash
npx ts-node src/scripts/test-database-sync.ts
```

## Error Handling

- Database sync failures are logged but don't affect the main application flow
- If admin database is unavailable, the main application continues to work
- All sync operations are wrapped in try-catch blocks for robustness

## Tables Synchronized

- `users` - User profile data, login information
- `otps` - OTP records for authentication
- All other tables remain specific to their respective databases
