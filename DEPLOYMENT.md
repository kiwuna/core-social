# Deployment Guide

## Architecture
- **Frontend:** Vercel (static files)
- **Backend:** Render (Express + Socket.io)
- **Database:** Supabase

## Step 1: Deploy Backend to Render

1. **Push your code to GitHub** (if not already done)
2. **Go to [render.com](https://render.com) and sign up**
3. **Create a new Web Service:**
   - Click "New +"
   - Select "Web Service"
   - Connect your GitHub repository
   - Select the "core social" repository
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
   - **Root Directory:** Leave empty (or set to root)
   - **Runtime:** Node

4. **Add Environment Variables** (in Render dashboard):
   Copy these from your local `server/.env` file:
   - `DATABASE_URL` - Your Supabase connection string
   - `DATABASE_SSL` - `true`
   - `SESSION_SECRET` - Generate a random string
   - `CLOUDINARY_CLOUD_NAME` - From Cloudinary
   - `CLOUDINARY_API_KEY` - From Cloudinary
   - `CLOUDINARY_API_SECRET` - From Cloudinary
   - `STRIPE_SECRET_KEY` - From Stripe
   - `VAPID_PUBLIC_KEY` - From your local .env
   - `VAPID_PRIVATE_KEY` - From your local .env
   - `VAPID_EMAIL` - Your email
   - `APP_URL` - Your Render URL (e.g., `https://core-social-backend.onrender.com`)

5. **Deploy** - Render will automatically deploy

6. **Copy your Render URL** (e.g., `https://core-social-backend.onrender.com`)

## Step 2: Update Frontend

1. **Go to your Vercel project**
2. **Add Environment Variable:**
   - Key: `API_URL`
   - Value: Your Render backend URL (e.g., `https://core-social-backend.onrender.com`)
3. **Redeploy** - Vercel will automatically redeploy

## Step 3: Test

1. **Visit your Vercel frontend URL**
2. **Test messaging** - Socket.io should connect to your Render backend
3. **Test auth** - Should work with your Supabase database

## Troubleshooting

### Socket.io connection fails
- Check Render logs for WebSocket errors
- Ensure `APP_URL` in Render env matches your Render URL
- Check that your firewall allows WebSocket connections

### Database connection fails
- Verify `DATABASE_URL` in Render matches your Supabase connection string
- Ensure `DATABASE_SSL=true` is set

### CORS errors
- Check that your Express server allows requests from your Vercel domain
- The server currently has `cors: { origin: "*" }` which should work

## Local Development

To run locally:
```bash
cd server
npm install
npm start
```

Frontend will connect to `localhost:3000` automatically.
