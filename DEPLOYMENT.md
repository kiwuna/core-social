# Deployment Guide - Vercel + Supabase

## Architecture
- **Frontend:** Vercel (static files + serverless API)
- **Backend:** Vercel Serverless Functions
- **Database:** Supabase (PostgreSQL + Realtime)
- **Real-time:** Supabase Realtime (replaces Socket.io)

## Pre-Deployment Setup

### 1. Configure Supabase Credentials in Frontend
Edit `client/config.js` and replace with your actual Supabase credentials:
```javascript
window.SUPABASE_URL = 'https://your-project-id.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-key-from-supabase-dashboard';
```

Get these from: Supabase Dashboard → Settings → API

### 2. Enable Supabase Realtime
Go to your Supabase project:
1. Navigate to Database → Replication
2. Enable Realtime for the following tables:
   - `messages`
   - `notifications`
3. Add publication for `supabase_realtime`

### 3. Add Environment Variables to Vercel
In your Vercel project settings → Environment Variables:

```
DATABASE_URL=your_supabase_connection_string
DATABASE_SSL=true
SESSION_SECRET=your_random_secret_string
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_EMAIL=your_email
```

## Deployment Steps

### 1. Update client/config.js
Make sure you've added your Supabase credentials to `client/config.js` before deploying.

### 2. Push to GitHub
```bash
git add .
git commit -m "Migrate to Vercel + Supabase Realtime"
git push
```

### 3. Deploy to Vercel
1. Go to your Vercel dashboard
2. Your project should auto-deploy on push
3. If not, click "Redeploy"

### 4. Verify Deployment
- Visit your Vercel URL
- Test authentication
- Test messaging (real-time via Supabase)
- Check notifications

## Changes Made

### Removed
- Socket.io server and client
- WebSocket connections
- Continuous Express server
- Cloudflare configuration

### Added
- Supabase Realtime subscriptions for messages and notifications
- Vercel serverless function structure
- REST API endpoints for message sending
- Real-time database triggers
- `client/config.js` for Supabase credentials

### What Still Works
- Authentication (sessions)
- File uploads (Cloudinary)
- Stripe payments
- User profiles
- Posts and feed
- Messaging (now via Supabase Realtime)
- Notifications (now via Supabase Realtime)

### What Changed
- **Typing indicators:** Removed (would require additional Supabase table)
- **Message delivery receipts:** Now work via database triggers instead of WebSocket
- **Real-time updates:** Now use Supabase Realtime instead of Socket.io

## Local Development

To run locally:
```bash
cd server
npm install
npm start
```

Make sure `client/config.js` has your Supabase credentials. The frontend will connect to `localhost:3000` and use Supabase Realtime for real-time features.

## Troubleshooting

### Real-time not working
- Verify Supabase Realtime is enabled for `messages` and `notifications` tables
- Check that `client/config.js` has correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Check browser console for connection errors

### Database connection fails
- Verify `DATABASE_URL` in Vercel env matches your Supabase connection string
- Ensure `DATABASE_SSL=true` is set

### Session issues
- Check that `SESSION_SECRET` is set in Vercel
- Vercel serverless functions handle sessions differently - ensure cookies are being set correctly

### API routes not working
- Verify the `api/` directory structure is correct
- Check Vercel function logs for errors

### Supabase credentials error
- Make sure you updated `client/config.js` with your actual credentials
- Do not commit real credentials to public repositories
