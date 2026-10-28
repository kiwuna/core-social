# Phase 1: Architecture Inspection and Migration Risk Assessment

## Executive Summary
Core Social uses a standard PostgreSQL setup with the `pg` Node.js client. The application is well-structured with minimal database-specific features, making it suitable for migration to Supabase PostgreSQL. The migration is **low risk** with clear, actionable steps.

---

## Current Architecture

### Frontend
- **Framework**: Vanilla HTML/CSS/JavaScript (no framework)
- **Direct database access**: None (all database access is server-side)
- **API communication**: RESTful endpoints via fetch API

### Backend
- **Framework**: Express.js (Node.js)
- **Database client**: `pg` (node-postgres) - standard PostgreSQL client
- **Session storage**: PostgreSQL via `connect-pg-simple`
- **Connection management**: Connection pooling via `pg.Pool`

### Database Client and Connection
**File**: `server/db/database.js`

**Current Connection**:
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL commented out (line 7-8)
});
```

**Status**: Uses standard PostgreSQL connection string. Already includes a comment about Supabase/Neon SSL support.

**Session Storage** (server/index.js):
```javascript
store: new PgStore({
  pool: db,
  tableName: "session",
})
```

---

## Database Schema

### Tables (16 total)

1. **users** - User accounts and profiles
   - Primary key: SERIAL (id)
   - Columns: username, password_hash, emoji, bio, is_premium, avatar_path, display_name, banner_path, email, is_synced, is_verified, sync_code, last_sync_request, warnings, warning_reasons (TEXT[]), is_banned, role, acknowledged_warnings, suspended_until, created_at
   - Unique constraint: username
   - No foreign keys to other tables

2. **posts** - Posts with text and media
   - Primary key: SERIAL (id)
   - Foreign key: user_id → users(id) ON DELETE CASCADE
   - Columns: content, likes, image_path (TEXT), video_path (TEXT), media_type, font_style, created_at
   - Media stored as URLs only (not binary data)

3. **likes** - Post likes
   - Primary key: SERIAL (id)
   - Foreign keys: user_id → users(id), post_id → posts(id) (both ON DELETE CASCADE)
   - Unique constraint: (user_id, post_id)

4. **reposts** - Post reposts
   - Primary key: SERIAL (id)
   - Foreign keys: user_id → users(id), post_id → posts(id) (both ON DELETE CASCADE)
   - Unique constraint: (user_id, post_id)
   - Indexes: idx_reposts_user_id, idx_reposts_post_id

5. **comments** - Post comments
   - Primary key: SERIAL (id)
   - Foreign keys: post_id → posts(id), user_id → users(id) (both ON DELETE CASCADE)
   - Columns: content, created_at

6. **polls** - Poll questions
   - Primary key: SERIAL (id)
   - Foreign key: post_id → posts(id) ON DELETE CASCADE
   - Columns: question, created_at

7. **poll_options** - Poll answer options
   - Primary key: SERIAL (id)
   - Foreign key: poll_id → polls(id) ON DELETE CASCADE
   - Columns: option_text, created_at

8. **poll_votes** - User poll votes
   - Primary key: SERIAL (id)
   - Foreign keys: poll_id → polls(id), option_id → poll_options(id), user_id → users(id) (all ON DELETE CASCADE)
   - Unique constraint: (poll_id, user_id)

9. **follows** - User follow relationships
   - Primary key: SERIAL (id)
   - Foreign keys: follower_id → users(id), following_id → users(id) (both ON DELETE CASCADE)
   - Unique constraint: (follower_id, following_id)
   - Check constraint: follower_id != following_id

10. **verification_codes** - Email verification codes
    - Primary key: SERIAL (id)
    - Foreign key: user_id → users(id) ON DELETE CASCADE
    - Columns: email, code, expires_at, created_at

11. **messages** - Direct messages
    - Primary key: SERIAL (id)
    - Foreign keys: sender_id → users(id), receiver_id → users(id) (both ON DELETE CASCADE)
    - Columns: content, delivered_at, seen_at, created_at

12. **push_subscriptions** - Web push notification subscriptions
    - Primary key: SERIAL (id)
    - Foreign key: user_id → users(id) ON DELETE CASCADE
    - Unique constraint: endpoint
    - Index: idx_push_subscriptions_user_id
    - Columns: endpoint, p256dh, auth, created_at, updated_at

13. **notifications** - User notifications
    - Primary key: SERIAL (id)
    - Foreign keys: recipient_id → users(id), sender_id → users(id), post_id → posts(id) (all ON DELETE CASCADE)
    - Columns: type, is_read, created_at

14. **post_impressions** - Post view analytics
    - Primary key: BIGSERIAL (id)
    - Foreign key: post_id → posts(id) ON DELETE CASCADE
    - Unique constraint: (post_id, visitor_key)
    - Indexes: idx_post_impressions_post_id, idx_post_impressions_visitor_key
    - Columns: visitor_key, user_id, session_id, first_seen_at, last_seen_at, visible_ms, is_viewed, device_hint, ip_hash, user_agent_hash

15. **post_view_events** - Post view event tracking
    - Primary key: BIGSERIAL (id)
    - Foreign key: post_id → posts(id) ON DELETE CASCADE
    - Index: idx_post_view_events_post_id_created_at
    - Columns: visitor_key, user_id, event_type, visible_ms, watch_ms, viewport_ratio, created_at

16. **session** - Express session storage
    - Primary key: sid (varchar)
    - Columns: sess (json), expire (timestamp)
    - Index: IDX_session_expire

### Relationships
- All foreign keys use ON DELETE CASCADE
- No circular dependencies
- Clean referential integrity

### Indexes
- All foreign keys indexed
- Additional indexes on:
  - reposts (user_id, post_id)
  - push_subscriptions (user_id)
  - post_impressions (post_id, visitor_key)
  - post_view_events (post_id, created_at DESC)
  - post_view_aggregates (day)
  - session (expire)

---

## Database-Specific Features

### PostgreSQL Functions Used
✅ **Compatible with Supabase**:
- `NOW()` - Current timestamp
- `CURRENT_TIMESTAMP` - Default timestamp
- `EXTRACT(EPOCH FROM ...)` - Convert timestamp to epoch
- `INTERVAL '24 hours'` - Time interval arithmetic
- `UNION` - Set operations
- `COALESCE()` - Null coalescing
- `ILIKE` - Case-insensitive pattern matching
- `ARRAY` data type (TEXT[])
- `JSON` data type (session table)
- `ON CONFLICT DO UPDATE` - Upsert operations
- `SERIAL` and `BIGSERIAL` - Auto-incrementing IDs

### No Extensions Found
- ❌ No custom PostgreSQL extensions (CREATE EXTENSION)
- ❌ No custom functions (CREATE FUNCTION)
- ❌ No custom triggers (CREATE TRIGGER)
- ❌ No stored procedures

**Risk Assessment**: LOW - Supabase supports all standard PostgreSQL features used.

---

## Transaction Usage

### Transaction Locations
Transactions are used in 3 files:

1. **server/routes/posts.js** (13 occurrences)
   - Post creation with polls (lines 344-390)
   - Like with notification (lines 530-552)
   - Unlike (lines 573-586)
   - Post view tracking (lines 100-172)

2. **server/routes/admin.js** (3 occurrences)
   - Admin operations (lines 193-204)

**Pattern**:
```javascript
const client = await db.connect();
try {
  await client.query("BEGIN");
  // ... operations ...
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release();
}
```

**Status**: ✅ Standard PostgreSQL transaction pattern, fully compatible with Supabase.

---

## Authentication and Session Storage

### Authentication System
- **Type**: Custom (NOT Supabase Auth)
- **Implementation**: bcryptjs password hashing
- **Session**: express-session with PostgreSQL storage
- **Session table**: `session` table in PostgreSQL

**Migration Decision**: Keep existing custom authentication. Do NOT migrate to Supabase Auth.

**Reasoning**:
- Custom auth is deeply integrated throughout the codebase
- Changing to Supabase Auth would require extensive frontend and backend changes
- Current system works well with PostgreSQL
- Supabase PostgreSQL can store the same session data

---

## Cloudinary Integration

### Current Implementation
**Files**: `server/routes/auth.js`, `server/routes/posts.js`

**Configuration**:
```javascript
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dtfjqbkas",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
```

**Storage**: 
- Images uploaded to Cloudinary cloud storage
- Only URLs stored in PostgreSQL (avatar_path, banner_path, image_path, video_path)
- No binary data in database

**Migration Impact**: ✅ None - Cloudinary integration unchanged. Only URLs stored in database.

---

## Environment Variables

### Current Configuration
**File**: `server/.env.example`

**Database Variables**:
- `DATABASE_URL` - PostgreSQL connection string

**No SSL Configuration**: Currently commented out in database.js

---

## Queries and SQL Injection Protection

### Query Pattern
All queries use **parameterized queries** with `pg` client:

```javascript
await db.query("SELECT * FROM users WHERE id = $1", [userId]);
```

**Status**: ✅ Safe from SQL injection. Fully compatible with Supabase.

### Search Features
- Text search: Uses `ILIKE` and `%wildcards%`
- No full-text search extensions (pg_trgm, etc.)
- Compatible with Supabase

### Pagination
- Uses `LIMIT` clauses
- No cursor-based pagination
- Compatible with Supabase

---

## Media URL Handling

### Media Storage
- **Images**: Cloudinary URLs stored as TEXT
- **Videos**: Cloudinary URLs stored as TEXT (if implemented)
- **No binary data**: Confirmed - only URLs and metadata

**Database Columns**:
- `users.avatar_path` - TEXT (Cloudinary URL)
- `users.banner_path` - TEXT (Cloudinary URL)
- `posts.image_path` - TEXT (Cloudinary URL)
- `posts.video_path` - TEXT (Cloudinary URL)

**Status**: ✅ Compliant with database content policy.

---

## Migration Risks

### HIGH RISK (None Identified)
- No high-risk issues found

### MEDIUM RISK
1. **Session Data Migration**
   - Risk: Active sessions may be lost during migration
   - Mitigation: Users will need to re-login after migration
   - Impact: Low - acceptable for migration

2. **Sequence Reset**
   - Risk: SERIAL sequences may need reset after data import
   - Mitigation: Migration script includes sequence reset logic
   - Impact: Low - handled by migration script

### LOW RISK
1. **SSL Configuration**
   - Risk: Supabase requires SSL, local PostgreSQL may not
   - Mitigation: Configure SSL based on environment
   - Impact: Low - configuration change only

2. **Connection Pooling**
   - Risk: Different pooling behavior between local and Supabase
   - Mitigation: Use standard pg.Pool configuration
   - Impact: Low - pg client handles this

3. **Time Zone Handling**
   - Risk: TIMESTAMP WITH TIME ZONE may behave differently
   - Mitigation: Supabase uses UTC by default
   - Impact: Low - application uses relative time display

---

## Files That Need Changing

### Database Configuration (2 files)
1. **server/db/database.js**
   - Add SSL configuration for Supabase
   - Add connection error handling
   - Environment-based SSL toggle

2. **server/.env.example**
   - Add DATABASE_SSL variable
   - Add Supabase connection string example
   - Document local vs Supabase configuration

### Migration Files (1 new file)
3. **server/migrations/001_initial_schema.sql** (NEW)
   - Extract schema from database.js
   - Create versioned migration file
   - Make it idempotent (safe to rerun)

### Backup Scripts (1 new file)
4. **server/scripts/backup-local-db.js** (NEW)
   - Create backup of local PostgreSQL
   - Export to SQL file
   - Document backup process

### Documentation (1 new file)
5. **SUPABASE_MIGRATION_GUIDE.md** (NEW)
   - Step-by-step Supabase setup
   - Migration instructions
   - Verification steps

### Optional Enhancements (0 files required)
- No code changes needed for dual environment support
- Connection string switching via environment variable only

---

## Supabase Compatibility Assessment

### ✅ Fully Compatible
- PostgreSQL client (pg)
- Connection pooling
- Transactions
- All SQL functions used
- Data types (SERIAL, BIGSERIAL, TEXT[], JSON, TIMESTAMP)
- Foreign keys and constraints
- Indexes
- Upserts (ON CONFLICT)
- Session storage

### ⚠️ Requires Configuration
- SSL connection (Supabase requires, local optional)
- Connection string format (different for Supabase)

### ❌ Not Applicable
- PostgreSQL extensions (none used)
- Custom functions/triggers (none used)
- Supabase Auth (not using)

---

## Data Volume Estimation

### Current Local Database
- **Status**: Fresh database with test data
- **Test data created during previous session**:
  - 1 user (testuser)
  - 1 post
  - 1 like
  - 1 comment

### Migration Complexity
- **LOW**: Minimal data to migrate
- **Estimated time**: < 5 minutes for data migration
- **Backup size**: < 1MB

---

## Existing Backups

### Current Backup Status
- ❌ No existing SQL dump found
- ❌ No existing backup files
- ⚠️ Old SQLite database exists at `server/core.db` (not in use)

### Recommendation
- Create backup before migration
- Use pg_dump if available
- Alternative: Use Node.js script to export data

---

## Summary and Recommendations

### Migration Feasibility: ✅ HIGH

The application is **well-suited** for Supabase migration:
- Standard PostgreSQL features only
- No proprietary extensions
- Clean schema with proper relationships
- Minimal data to migrate
- Code requires minimal changes

### Recommended Approach
1. **Dual Environment Support**: Configure app to work with both local PostgreSQL and Supabase via environment variable
2. **SSL Configuration**: Add SSL support for Supabase, optional for local
3. **Migration Script**: Create SQL migration file from existing schema
4. **Data Backup**: Create backup before migration
5. **Verification**: Test both environments independently
6. **Rollback Plan**: Keep local database intact until verified

### Files to Modify (5 total)
1. server/db/database.js (add SSL config)
2. server/.env.example (add Supabase vars)
3. server/migrations/001_initial_schema.sql (NEW)
4. server/scripts/backup-local-db.js (NEW)
5. SUPABASE_MIGRATION_GUIDE.md (NEW)

### Estimated Effort
- Configuration changes: 30 minutes
- Migration file creation: 30 minutes
- Testing and verification: 1 hour
- **Total**: ~2 hours

### Next Steps
Proceed to Phase 2: Configure dual database environment support.
