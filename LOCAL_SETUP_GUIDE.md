# Core Social - Local Development Setup Guide

## Overview
Core Social has been successfully configured to run locally with all Render dependencies removed. The application is now fully functional using PostgreSQL, with the database initialized and core features tested.

## Render Dependencies Removed
All references to Render hosting have been removed from the codebase:
- **client/index.html**: Replaced hardcoded `https://core-social.onrender.com/` URLs with relative paths
  - Canonical URL: Changed to `/`
  - Open Graph URL: Changed to `/`
  - Open Graph image: Changed to `/assets/CoreLogo.png`
  - Twitter card image: Changed to `/assets/CoreLogo.png`
  - Schema.org URL: Changed to `/`

## Files Changed
1. **server/.env.example** - Updated with comprehensive local development configuration
2. **client/index.html** - Removed all Render-specific URLs
3. **server/.env** - Created with local PostgreSQL credentials (not committed to git)

## Current Configuration

### Database
- **Type**: PostgreSQL
- **Host**: localhost
- **Port**: 5432
- **Database Name**: core_social
- **User**: postgres
- **Status**: ✅ Connected and initialized with all tables

### Server
- **Port**: 3000
- **URL**: http://localhost:3000
- **Status**: ✅ Running successfully

## Required External Services

### 1. Cloudinary (Image Uploads)
**Status**: Partially configured
- Cloud Name: `dtfjqbkas` (already set)
- API Key: **REQUIRED** - Currently empty
- API Secret: **REQUIRED** - Currently set to placeholder

**Impact**: Without Cloudinary credentials, image uploads (avatars, banners, post images) will fail. Text-only posts will work fine.

**How to configure**:
1. Go to https://cloudinary.com/console
2. Sign up or log in
3. Navigate to Dashboard → API Keys
4. Copy API Key and API Secret
5. Update `server/.env`:
   ```
   CLOUDINARY_API_KEY=your_actual_api_key
   CLOUDINARY_API_SECRET=your_actual_api_secret
   ```

### 2. Stripe (Premium Payments)
**Status**: Not configured
- Secret Key: **REQUIRED** - Currently set to placeholder

**Impact**: Premium subscription features will not work. The UI will show but payment processing will fail.

**How to configure**:
1. Go to https://dashboard.stripe.com/apikeys
2. Sign up or log in
3. Copy your Secret Key (starts with `sk_test_` for test mode)
4. Update `server/.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_your_actual_secret_key
   ```

### 3. Web Push Notifications (Optional)
**Status**: Not configured
- VAPID Public Key: Optional
- VAPID Private Key: Optional
- VAPID Subject: Optional

**Impact**: Browser push notifications will not work. The application will function normally without them.

**How to configure** (optional):
1. Run: `npx web-push generate-vapid-keys`
2. Copy the generated keys
3. Update `server/.env`:
   ```
   VAPID_PUBLIC_KEY=your_public_key
   VAPID_PRIVATE_KEY=your_private_key
   VAPID_SUBJECT=mailto:admin@example.com
   ```

### 4. Cloudflare Origin Protection (Optional)
**Status**: Disabled for local development
- Setting: Commented out in `.env`

**Impact**: None. This is only needed when deploying behind Cloudflare.

**How to enable** (for production only):
1. Uncomment and set in `server/.env`:
   ```
   CLOUDFLARE_ORIGIN_RULES=cloudflare_ips_only
   ```

## Features Tested Successfully

### Core Functionality ✅
- ✅ User registration (signup)
- ✅ User login/session management
- ✅ Post creation (text-only)
- ✅ Post retrieval (feed)
- ✅ Like posts
- ✅ Comment on posts
- ✅ Feed ranking algorithm
- ✅ User search
- ✅ Profile retrieval
- ✅ Database schema initialization

### Real-time Features ✅
- ✅ Socket.io server running
- ✅ WebSocket connection available
- ✅ Real-time messaging infrastructure

### Features Requiring External Credentials
- ⚠️ Image uploads (requires Cloudinary)
- ⚠️ Premium subscriptions (requires Stripe)
- ⚠️ Push notifications (requires VAPID keys)

## Exact Commands to Start the Application

### First-time Setup (Already Completed)
```bash
# 1. Install PostgreSQL (you did this)
# Download from: https://www.postgresql.org/download/windows/

# 2. Create database (you did this)
psql -U postgres -c "CREATE DATABASE core_social;"

# 3. Install dependencies (already done)
cd "C:\Users\Bero\Documents\core social\server"
npm install

# 4. Create .env file (already done)
cp .env.example .env

# 5. Update DATABASE_URL with your password (already done)
# Changed to: postgresql://postgres:Giogio111223@localhost:5432/core_social

# 6. Create database (already done)
node create_db.js
```

### Starting the Server (Any Time)
```bash
cd "C:\Users\Bero\Documents\core social\server"
npm start
```

The server will start on http://localhost:3000

### Stopping the Server
- Press `Ctrl+C` in the terminal where the server is running
- Or kill the process if needed: `taskkill //F //PID <process_id>`

## Database Schema

The following tables are automatically created on first run:
- **users** - User accounts and profiles
- **posts** - Posts with text, images, polls
- **likes** - Post likes
- **reposts** - Post reposts
- **comments** - Post comments
- **polls** - Poll questions
- **poll_options** - Poll answer options
- **poll_votes** - User poll votes
- **follows** - User follow relationships
- **messages** - Direct messages
- **notifications** - User notifications
- **push_subscriptions** - Web push subscriptions
- **post_impressions** - Post view analytics
- **post_view_events** - Post view event tracking
- **post_view_aggregates** - Post view statistics
- **session** - Session storage for express-session

## Known Issues and Limitations

1. **Image Uploads**: Currently disabled due to missing Cloudinary API credentials. Text-only posts work fine.

2. **Premium Features**: Stripe is not configured, so the premium subscription flow will not process payments.

3. **Push Notifications**: Not configured. The application works without them.

4. **npm vulnerabilities**: The project has some dependency vulnerabilities (21 found). Run `npm audit` for details. These are not critical for local development.

5. **Existing Data**: The old SQLite database at `server/core.db` was not migrated. Only the new PostgreSQL database is being used. If you need to migrate old data, run `node migrate.js` (this requires the old SQLite file to exist).

## Port Conflicts

If port 3000 is already in use:
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process
taskkill //F //PID <process_id>

# Or change the port in server/.env:
PORT=3001
```

## Browser Access

Once the server is running:
- Main app: http://localhost:3000
- Admin panel: http://localhost:3000/admin
- Health check: http://localhost:3000/health
- API endpoints: http://localhost:3000/api/*

## Environment Variables Reference

See `server/.env.example` for the complete list of configurable variables:
- `PORT` - Server port (default: 3000)
- `MAX_POST_LENGTH` - Maximum post character limit (default: 300)
- `SESSION_SECRET` - Session encryption key
- `DATABASE_URL` - PostgreSQL connection string
- `CLOUDFLARE_ORIGIN_RULES` - Cloudflare IP restriction (optional)
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret
- `STRIPE_SECRET_KEY` - Stripe secret key
- `VAPID_PUBLIC_KEY` - Web push public key (optional)
- `VAPID_PRIVATE_KEY` - Web push private key (optional)
- `VAPID_SUBJECT` - Web push subject email (optional)
- `APP_URL` - Application base URL (optional)

## Security Notes

- The `.env` file is in `.gitignore` and will not be committed
- Never commit real API keys or secrets to the repository
- Change `SESSION_SECRET` before deploying to production
- Use strong passwords for PostgreSQL
- Enable SSL/TLS when deploying to production

## Next Steps for Production Deployment

When you're ready to deploy to production:

1. **Set up a production PostgreSQL database** (e.g., Supabase, Neon, Railway)
2. **Add your Cloudinary credentials** for image uploads
3. **Add your Stripe credentials** for payments
4. **Change SESSION_SECRET** to a secure random string
5. **Enable Cloudflare** (optional) and update `CLOUDFLARE_ORIGIN_RULES`
6. **Set APP_URL** to your production domain
7. **Update `client/index.html`** metadata URLs from relative to absolute for production
8. **Configure SSL/TLS** on your server

## Summary

✅ **Core Social is now running locally with no Render dependencies**
✅ **All core features tested and working**
✅ **Database initialized and connected**
✅ **Server running on http://localhost:3000**

⚠️ **Image uploads require Cloudinary credentials**
⚠️ **Premium features require Stripe credentials**
⚠️ **Push notifications require VAPID keys (optional)**

The application is fully functional for text-based social networking. External service credentials are only needed for images, payments, and push notifications.
