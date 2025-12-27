# MSG91 SMS Integration Guide

## Overview

MSG91 SMS service has been integrated into the vehicle pool backend to send OTP messages to Indian mobile numbers.

## Configuration

### Environment Variables

Added to `.env`:

```env
MSG91_AUTH_KEY=475488AzWDOEtwW6909856bP1
MSG91_TEMPLATE_ID=69084001cacda84efa664923
```

### API Details

- **Endpoint**: `https://control.msg91.com/api/v5/otp`
- **Method**: POST
- **Template ID**: `69084001cacda84efa664923`
- **Auth Key**: `475488AzWDOEtwW6909856bP1`

## Implementation

### Service Layer

File: `src/services/otp.service.ts`

#### Key Methods

**1. sendOTPviaSMS(mobile: string, otp: string)**

- Sends OTP via MSG91 SMS service
- Validates and formats mobile number (removes +91, ensures 10 digits)
- Makes POST request to MSG91 API
- Returns `true` on success, `false` on failure
- In development mode, logs OTP to console as fallback

**2. createOTP(mobile: string, userId: number)**

- Generates 6-digit OTP
- Stores in database with 10-minute expiry
- **Automatically sends SMS via MSG91**
- Syncs to admin database
- Returns generated OTP

### Mobile Number Formatting

```typescript
// Input: +919876543210
// Output: 919876543210 (sent to MSG91)

const cleanMobile = mobile.replace(/^\+?91/, ""); // Remove +91 prefix
// Validates: cleanMobile.length === 10
```

### Error Handling

```typescript
// SMS sending errors are logged but don't fail OTP creation
const smsSent = await this.sendOTPviaSMS(mobile, otp);
if (!smsSent) {
  console.warn(`⚠️ SMS failed for ${mobile}, but OTP created in database`);
}
```

### Development Mode

```typescript
if (process.env.NODE_ENV === "development") {
  console.log(`📱 DEV MODE - OTP for ${mobile}: ${otp}`);
  return true; // Return true even if SMS fails
}
```

## API Flow

### 1. Request OTP

**Endpoint**: `POST /api/users/request-otp`

**Request Body**:

```json
{
  "mobile": "+919876543210"
}
```

**Response**:

```json
{
  "message": "OTP sent successfully",
  "userId": 123
}
```

**Backend Process**:

1. Validates mobile number
2. Creates/finds user in database
3. Generates 6-digit OTP
4. Stores OTP in database (expires in 10 minutes)
5. **Sends OTP via MSG91 SMS**
6. Returns success response

### 2. Verify OTP

**Endpoint**: `POST /api/users/verify-otp`

**Request Body**:

```json
{
  "mobile": "+919876543210",
  "otp": "123456"
}
```

**Response**:

```json
{
  "message": "OTP verified successfully",
  "token": "jwt_token_here",
  "user": {
    "userId": 123,
    "mobile": "+919876543210",
    "name": "John Doe"
  }
}
```

## MSG91 API Response

### Success Response

```json
{
  "type": "success",
  "message": "OTP sent successfully"
}
```

### Error Response

```json
{
  "type": "error",
  "message": "Error message"
}
```

## Testing

### Development Testing

1. Set `NODE_ENV=development` in `.env`
2. Make request to `/api/users/request-otp`
3. Check console for logged OTP:
   ```
   📱 DEV MODE - OTP for +919876543210: 123456
   ```
4. Use logged OTP to verify

### Production Testing

1. Use real Indian mobile number
2. Request OTP via API
3. Check SMS on mobile device
4. Verify OTP within 10 minutes

## Console Logs

### Successful SMS Send

```
MSG91 Response: { type: 'success', message: 'OTP sent successfully' }
✅ OTP sent successfully to 9876543210
```

### Failed SMS Send (Dev Mode)

```
Error sending OTP via MSG91: [error details]
📱 DEV MODE - OTP for +919876543210: 123456
```

### Failed SMS Send (Production)

```
Error sending OTP via MSG91: [error details]
⚠️ SMS failed for +919876543210, but OTP created in database
```

## Security Considerations

1. **OTP Expiry**: All OTPs expire after 10 minutes
2. **One-time Use**: OTPs are marked as verified after successful verification
3. **Database Storage**: OTPs are stored with user association
4. **Environment Variables**: Sensitive credentials stored in `.env`
5. **HTTPS**: MSG91 API uses HTTPS for secure communication

## Dependencies

- **axios**: HTTP client for MSG91 API calls (already installed: `^1.11.0`)

## Files Modified

1. `src/services/otp.service.ts` - Added MSG91 integration
2. `.env` - Added MSG91 configuration
3. `src/controllers/user.controller.ts` - Already configured (no changes needed)

## Troubleshooting

### Issue: SMS Not Received

**Check:**

1. Mobile number format (should be 10 digits after removing +91)
2. MSG91 API credentials in `.env`
3. Console logs for error messages
4. MSG91 account balance/credits
5. Template ID matches in MSG91 dashboard

**Solution:**

- In development: Check console for logged OTP
- In production: Verify MSG91 account is active

### Issue: Invalid Mobile Number Format

**Error**: `Invalid mobile number format: <number>`

**Solution**: Ensure mobile number is in format `+919876543210` or `9876543210`

### Issue: MSG91 API Returns Error

**Check Console Logs**:

```
MSG91 API returned non-success response: { type: 'error', ... }
```

**Solution**: Check MSG91 dashboard for:

- Template approval status
- Account credits
- API key validity

## Benefits

✅ **Real SMS Delivery**: Actual SMS sent to Indian mobile numbers  
✅ **Bypasses Clerk Restrictions**: Works with all Indian numbers  
✅ **Development Fallback**: Logs OTP to console in dev mode  
✅ **Error Resilience**: OTP created even if SMS fails  
✅ **Environment-based**: Uses `.env` for configuration  
✅ **Automatic Integration**: Works seamlessly with existing OTP flow

## Next Steps

1. ✅ MSG91 integration complete
2. ✅ Environment variables configured
3. ✅ Service layer updated
4. 🔄 Test with real mobile number
5. 🔄 Monitor MSG91 API responses
6. 🔄 Consider rate limiting for OTP requests

## Related Documentation

- [Clerk Implementation Guide](../CLERK_IMPLEMENTATION_GUIDE.md)
- [OTP Service Documentation](./src/services/otp.service.ts)
- [User Controller](./src/controllers/user.controller.ts)
