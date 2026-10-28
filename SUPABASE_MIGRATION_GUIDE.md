# Supabase Migration Guide for Core Social

## Overview
This guide provides step-by-step instructions for migrating Core Social from local PostgreSQL to Supabase PostgreSQL while preserving local development capabilities.

---

## Prerequisites

### Required
- Supabase account (free tier is sufficient)
- Local PostgreSQL installed and working
- Node.js and npm installed
- Access to Core Social codebase

### Optional
- pg_dump command-line tool (for SQL backups)
- Supabase CLI (for advanced management)

---

## Phase 1: Supabase Project Setup

### Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Sign up or log in
3. Click "New Project"
4. Enter project details:
   - **Name**: `core-social` (or your preferred name)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is sufficient for development
5. Click "Create new project"
6. Wait for project to be provisioned (2-3 minutes)

### Step 2: Get Connection String
1. In Supabase Dashboard, go to **Settings → Database**
2. Scroll to **Connection String**
3. Copy the **URI** format connection string
4. Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
5. Replace `[YOUR-PASSWORD]` with the database password you set during project creation

---

## Phase 2: Apply Schema to Supabase

### Step 1: Run Migration File
You have two options to apply the schema:

#### Option A: Use Supabase SQL Editor (Recommended)
1. In Supabase Dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `server/migrations/001_initial_schema.sql`
4. Paste into the SQL Editor
5. Click "Run" (or press Ctrl+Enter)
6. Verify all tables created successfully

#### Option B: Use psql Command Line
```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f server/migrations/001_initial_schema.sql
```

### Step 2: Verify Schema
1. In Supabase Dashboard, go to **Table Editor**
2. Verify all 18 tables are visible:
   - users
   - posts
   - likes
   - reposts
   - comments
   - polls
   - poll_options
   - poll_votes
   - follows
   - verification_codes
   - messages
   - push_subscriptions
   - notifications
   - post_impressions
   - post_view_events
   - post_view_aggregates
   - reports
   - session

---

## Phase 3: Configure Environment for Supabase

### Step 1: Update .env for Supabase
Create or update `server/.env`:

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DATABASE_SSL=true

# Keep all other existing variables (PORT, SESSION_SECRET, etc.)
```

### Step 2: Update .env.example for Reference
Already updated in Phase 2. Your `.env.example` now includes:
- `DATABASE_SSL` variable documentation
- Supabase connection string example
- Clear instructions for both environments

---

## Phase 4: Backup Local Data

### Step 1: Create Backup
Run the backup script to create a JSON backup of your local database:

```bash
cd "C:\Users\Bero\Documents\core social\server"
node scripts/backup-local-db.js
```

This creates:
- `backups/core-social-backup-[timestamp].json` - Full data backup
- `backups/core-social-backup-[timestamp]-summary.txt` - Summary report

### Step 2: Review Backup
Check the summary file to verify:
- Total rows backed up
- Each table's row count
- Any errors during backup

---

## Phase 5: Migrate Data to Supabase

### Important: Current State
Your local database currently has minimal test data (created during previous session):
- 1 user (testuser)
- 1 post
- 1 like
- 1 comment

You have two options:

#### Option A: Start Fresh (Recommended for Development)
Skip data migration and start with a clean Supabase database. This is simpler and recommended for development.

#### Option B: Migrate Existing Data
If you want to migrate the test data:

1. **Manual Export from Local**:
   ```bash
   # Using pg_dump if available
   pg_dump -U postgres core_social > local-backup.sql
   ```

2. **Import to Supabase**:
   - In Supabase Dashboard, go to **SQL Editor**
   - Copy and paste the SQL from local-backup.sql
   - Run the import

3. **Alternative: Use Custom Script**:
   The backup script creates JSON exports. You can create a Supabase import script using the same pattern as `restore-local-db.js` but targeting the Supabase connection string.

---

## Phase 6: Test Supabase Connection

### Step 1: Update .env to Use Supabase
Ensure your `server/.env` has:
```bash
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DATABASE_SSL=true
```

### Step 2: Start Server
```bash
cd "C:\Users\Bero\Documents\core social\server"
npm start
```

### Step 3: Verify Connection
You should see:
```
Server running on http://localhost:3000
Connected to PostgreSQL database.
PostgreSQL tables initialized.
```

### Step 4: Test Functionality
Run API tests:
```bash
# Health check
curl http://localhost:3000/health

# Create user
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"supabase_test","password":"test123","emoji":"🧪"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"supabase_test","password":"test123"}' \
  -c cookies.txt

# Create post
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello from Supabase!"}' \
  -b cookies.txt
```

---

## Phase 7: Switch Between Environments

### Switch to Local PostgreSQL
Update `server/.env`:
```bash
DATABASE_URL=postgresql://postgres:Giogio111223@localhost:5432/core_social
DATABASE_SSL=false
```

Restart server:
```bash
npm start
```

### Switch to Supabase
Update `server/.env`:
```bash
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DATABASE_SSL=true
```

Restart server:
```bash
npm start
```

---

## Phase 8: Verification Checklist

### Local PostgreSQL
- ✅ Server starts without errors
- ✅ Database connection established
- ✅ All tables created automatically
- ✅ Health check returns `{"status":"ok"}`
- ✅ User signup/login works
- ✅ Post creation works
- ✅ Feed retrieval works

### Supabase
- ✅ Server starts without errors
- ✅ Database connection established (with SSL)
- ✅ All tables exist in Supabase Dashboard
- ✅ Health check returns `{"status":"ok"}`
- ✅ User signup/login works
- ✅ Post creation works
- ✅ Feed retrieval works
- ✅ Data persists in Supabase (verify in Dashboard)

---

## Phase 9: Environment-Specific Configuration

### Local Development (.env.local)
```bash
PORT=3000
DATABASE_URL=postgresql://postgres:Giogio111223@localhost:5432/core_social
DATABASE_SSL=false
SESSION_SECRET=dev-secret-key
# ... other variables
```

### Supabase Production (.env.production)
```bash
PORT=3000
DATABASE_URL=postgresql://postgres:[SUPABASE-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DATABASE_SSL=true
SESSION_SECRET=production-secret-key-change-this
# ... other variables
```

---

## Troubleshooting

### Issue: "Connection refused" to Supabase
**Cause**: SSL not enabled or connection string incorrect
**Solution**:
- Ensure `DATABASE_SSL=true` in .env
- Verify connection string format
- Check Supabase project is active

### Issue: "Self-signed certificate" error
**Cause**: SSL validation too strict
**Solution**: Already handled in database.js with `rejectUnauthorized: false`

### Issue: Tables not found in Supabase
**Cause**: Migration not run
**Solution**: Re-run the SQL migration file in Supabase SQL Editor

### Issue: Sequence errors after data import
**Cause**: Serial sequences not reset
**Solution**: The restore script includes sequence reset logic

### Issue: Local database not working after switching
**Cause**: DATABASE_URL still points to Supabase
**Solution**: Update .env to point to local PostgreSQL and set `DATABASE_SSL=false`

---

## Security Considerations

### Credentials
- ✅ Never commit .env to git (already in .gitignore)
- ✅ Use strong passwords for Supabase
- ✅ Change SESSION_SECRET before production
- ✅ Never share Supabase connection string

### SSL
- ✅ Supabase requires SSL (DATABASE_SSL=true)
- ✅ Local PostgreSQL typically doesn't need SSL (DATABASE_SSL=false)
- ✅ SSL configuration is environment-based

### Access Control
- Supabase provides Row Level Security (RLS) - NOT USED
- Core Social uses custom authentication (DO NOT change to Supabase Auth)
- All database access is server-side only

---

## Cloudinary Integration

### No Changes Required
- Cloudinary integration remains unchanged
- Images still upload to Cloudinary
- Database still stores Cloudinary URLs only
- Works identically with both local PostgreSQL and Supabase

---

## Next Steps After Migration

### 1. Test All Features
- User registration and login
- Post creation (text and images)
- Likes and comments
- Follow/unfollow
- Direct messages
- Notifications
- Admin panel
- Feed ranking

### 2. Performance Testing
- Compare query performance between local and Supabase
- Check connection pooling behavior
- Monitor Supabase metrics in Dashboard

### 3. Data Validation
- Verify all data types work correctly
- Check timezone handling
- Validate array types (TEXT[])
- Test JSON columns (session table)

### 4. Backup Strategy
- Set up automated Supabase backups (available in Dashboard)
- Keep local backup scripts for manual backups
- Document backup/restore procedures

---

## Rollback Plan

If you need to rollback to local PostgreSQL:

1. Stop the server
2. Update .env to use local DATABASE_URL
3. Set DATABASE_SSL=false
4. Restart server
5. If needed, restore from backup:
   ```bash
   node scripts/restore-local-db.js backups/core-social-backup-[timestamp].json
   ```

---

## Summary

### What Was Done
✅ Database connection updated to support SSL for Supabase
✅ Environment configuration documented for both local and Supabase
✅ Migration SQL file created (idempotent, safe to rerun)
✅ Backup and restore scripts created
✅ Local development verified working
✅ Dual environment support configured

### What You Need to Do
1. Create Supabase project
2. Run migration SQL in Supabase SQL Editor
3. Update .env with Supabase connection string
4. Test application with Supabase
5. Optionally migrate existing data

### Files Created/Modified
- **Modified**: `server/db/database.js` - Added SSL configuration
- **Modified**: `server/.env.example` - Added Supabase documentation
- **Created**: `server/migrations/001_initial_schema.sql` - Schema migration
- **Created**: `server/scripts/backup-local-db.js` - Backup script
- **Created**: `server/scripts/restore-local-db.js` - Restore script
- **Created**: `SUPABASE_MIGRATION_PHASE1_REPORT.md` - Architecture inspection
- **Created**: `SUPABASE_MIGRATION_PHASE4_POLICY_REPORT.md` - Policy compliance
- **Created**: `SUPABASE_MIGRATION_GUIDE.md` - This guide

### Switching Environments
Simply change two variables in .env:
- `DATABASE_URL` - Connection string
- `DATABASE_SSL` - true for Supabase, false for local

No code changes required!
