# DATABASE CONNECTION ERROR FIX

## Problem

```
Error: Tenant or user not found
Code: XX000
```

This error occurs because the database password in `.env` is incorrect.

## Current (INCORRECT) Connection String

```
DATABASE_URL=postgresql://postgres.xevvrvhhznpxycfaryya:root@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
                                                      ^^^^
                                                   Wrong password
```

## Solution

### Step 1: Get Your Supabase Database Password

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `xevvrvhhznpxycfaryya`
3. Navigate to **Project Settings** (gear icon in sidebar)
4. Click on **Database** tab
5. Scroll down to **Connection string** section
6. Look for **Connection pooling** or **Direct connection**
7. Select **URI** format
8. Copy the connection string

### Step 2: Update .env File

The correct format should be:

```env
DATABASE_URL=postgresql://postgres.xevvrvhhznpxycfaryya:[YOUR_PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

Replace `[YOUR_PASSWORD]` with the actual password from Supabase dashboard.

**Note:** The password is typically the one you set when creating the Supabase project, or it can be reset from the database settings.

### Step 3: Alternative - Use Transaction Pooler

If you're using Supabase's connection pooler (recommended for serverless), the format might be:

```env
DATABASE_URL=postgresql://postgres.xevvrvhhznpxycfaryya:[YOUR_PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Step 4: Reset Password (If Forgotten)

If you don't remember your database password:

1. Go to Supabase Dashboard → Project Settings → Database
2. Scroll to **Database password** section
3. Click **Reset database password**
4. Generate a new password
5. Save it securely
6. Update your `.env` file with the new password

### Step 5: Test Connection

After updating `.env`, test the connection:

```bash
node test-db-simple.js
```

Expected output:

```
✅ Connected successfully!
✅ Query executed: { now: 2025-11-06T... }
```

### Step 6: Restart Backend Server

```bash
npm run dev
```

## Update Both Files

Make sure to update the password in:

1. `vehicle-pool-backend/.env`
2. `vehiclepool-admin-1.0/.env`

Both should use the same DATABASE_URL with the correct password.

## Common Mistakes

❌ **Wrong:** Using "root" as password
❌ **Wrong:** Missing the `postgres.` prefix in username
❌ **Wrong:** Using port 5432 (that's for direct connection, use 6543 for pooler)

✅ **Correct:** `postgresql://postgres.xevvrvhhznpxycfaryya:[ACTUAL_PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`

## Security Note

⚠️ Never commit your actual password to version control!

Add to `.gitignore`:

```
.env
.env.local
```

## Quick Fix Command

Once you have the correct password, run:

```bash
# Windows (PowerShell)
cd g:\projectsvehicle\vehicle-pool-backend
# Edit .env file with correct password
notepad .env

# Test connection
node test-db-simple.js

# Restart server
npm run dev
```

## After Fixing

Once the database connection is working, the OTP flow will work:

1. ✅ User requests OTP
2. ✅ OTP generated and stored in database
3. ✅ SMS sent via MSG91
4. ✅ User receives OTP
5. ✅ User verifies OTP
6. ✅ Login successful

## Need Help?

If you still can't connect after updating the password:

1. Check if your IP is whitelisted in Supabase
2. Verify project is not paused
3. Try direct connection string instead of pooler
4. Contact Supabase support if issue persists
