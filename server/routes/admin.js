const express = require("express");
const router = express.Router();

// Middleware to verify if the user has admin/ceo/mod role
const isAdmin = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
  const db = req.app.locals.db;
  try {
    const result = await db.query("SELECT role, username FROM users WHERE id = $1", [req.session.userId]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "User not found" });
    
    const role = user.role || 'user';
    if (role === 'admin' || role === 'ceo' || role === 'mod' || user.username === 'ceo' || user.username === 'admin') {
      return next();
    }
    return res.status(403).json({ error: "Access denied. CEO/Admin/Mod access only." });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/stats
// Fetches CEO grid metrics: Total Users, Active Today, Banned/Suspended Accounts, and Total Verified
router.get("/stats", isAdmin, async (req, res, next) => {
  const db = req.app.locals.db;
  try {
    const totalUsersRes = await db.query("SELECT COUNT(*) AS count FROM users");
    const bannedAccountsRes = await db.query("SELECT COUNT(*) AS count FROM users WHERE is_banned = TRUE OR suspended_until > NOW()");
    const totalVerifiedRes = await db.query("SELECT COUNT(*) AS count FROM users WHERE is_synced = TRUE");
    
    // Robust calculation for Active Today
    const activeTodayRes = await db.query(`
      SELECT COUNT(DISTINCT id) AS count FROM (
        SELECT id FROM users WHERE created_at >= NOW() - INTERVAL '24 hours'
        UNION
        SELECT user_id FROM posts WHERE created_at >= NOW() - INTERVAL '24 hours'
        UNION
        SELECT user_id FROM comments WHERE created_at >= NOW() - INTERVAL '24 hours'
        UNION
        SELECT (sess->>'userId')::int AS id FROM session WHERE expire > NOW()
      ) AS active WHERE id IS NOT NULL
    `);

    res.json({
      totalUsers: parseInt(totalUsersRes.rows[0].count || 0),
      activeToday: parseInt(activeTodayRes.rows[0].count || 0),
      bannedAccounts: parseInt(bannedAccountsRes.rows[0].count || 0),
      totalVerified: parseInt(totalVerifiedRes.rows[0].count || 0)
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users
// Returns detailed table of all registered users including suspension stamps
router.get("/users", isAdmin, async (req, res, next) => {
  const db = req.app.locals.db;
  try {
    const result = await db.query(`
      SELECT 
        id, username, display_name, emoji, bio, role, is_premium, is_synced, warnings, warning_reasons, is_banned, suspended_until, created_at, avatar_path, banner_path
      FROM users
      ORDER BY id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/warn/:id
// Warns a user, increments their warning count, appends warning reason, auto-suspends permanently at 3 warnings, and creates an official notification
router.post("/warn/:id", isAdmin, async (req, res, next) => {
  const targetId = parseInt(req.params.id);
  const { reason } = req.body;
  const db = req.app.locals.db;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: "Warning reason is required" });
  }

  try {
    const userRes = await db.query("SELECT warnings, warning_reasons, username FROM users WHERE id = $1", [targetId]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRes.rows[0];
    const currentWarnings = (user.warnings || 0) + 1;
    const reasons = user.warning_reasons || [];
    reasons.push(reason.trim());

    const shouldBan = currentWarnings >= 3;
    const suspendedUntil = shouldBan ? new Date('9999-12-31T23:59:59.000Z') : null;

    // Save warning increment
    await db.query(
      "UPDATE users SET warnings = $1, warning_reasons = $2, is_banned = $3, suspended_until = $4 WHERE id = $5",
      [currentWarnings, reasons, shouldBan, suspendedUntil, targetId]
    );

    // Send a standard notification to the user
    await db.query(
      "INSERT INTO notifications (recipient_id, sender_id, type) VALUES ($1, $2, 'warning')",
      [targetId, req.session.userId]
    );

    console.log(`[ADMIN WARNING] User ID ${targetId} (@${user.username}) warned. Reason: "${reason}". Total warnings: ${currentWarnings}/3. Auto-ban: ${shouldBan}`);

    res.json({
      success: true,
      message: shouldBan ? "User warned and suspended permanently" : "User warned successfully",
      user: {
        id: targetId,
        username: user.username,
        warnings: currentWarnings,
        is_banned: shouldBan,
        suspended_until: suspendedUntil
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/:id/edit
// Admin option to manually edit a user profile, role, or suspend account for a duration
router.post("/users/:id/edit", isAdmin, async (req, res, next) => {
  const targetId = parseInt(req.params.id);
  const { role, suspensionDuration, is_premium, is_synced, removeAvatar, removeBanner } = req.body;
  const db = req.app.locals.db;

  try {
    let suspended_until = null;
    let is_banned = false;

    if (suspensionDuration === '1') {
      suspended_until = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    } else if (suspensionDuration === '7') {
      suspended_until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } else if (suspensionDuration === '30') {
      suspended_until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else if (suspensionDuration === 'permanent') {
      suspended_until = new Date('9999-12-31T23:59:59.000Z');
      is_banned = true;
    }

    await db.query(`
      UPDATE users 
      SET 
        role = $1,
        is_banned = $2,
        suspended_until = $3,
        is_premium = $4,
        is_synced = $5,
        is_verified = $6
      WHERE id = $7
    `, [
      role || "user",
      is_banned,
      suspended_until,
      is_premium === undefined ? 0 : parseInt(is_premium),
      is_synced === undefined ? false : !!is_synced,
      is_synced === undefined ? false : !!is_synced,
      targetId
    ]);

    if (removeAvatar) {
      await db.query("UPDATE users SET avatar_path = NULL WHERE id = $1", [targetId]);
    }
    if (removeBanner) {
      await db.query("UPDATE users SET banner_path = NULL WHERE id = $1", [targetId]);
    }

    res.json({ success: true, message: "User profile updated by admin successfully" });
  } catch (err) {
    next(err);
  }
});

// Delete a user and all of their content
router.delete("/users/:id", isAdmin, async (req, res, next) => {
  const db = req.app.locals.db;
  const targetId = parseInt(req.params.id);

  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM notifications WHERE recipient_id = $1 OR sender_id = $1", [targetId]);
      await client.query("DELETE FROM likes WHERE user_id = $1", [targetId]);
      await client.query("DELETE FROM comments WHERE user_id = $1", [targetId]);
      await client.query("DELETE FROM posts WHERE user_id = $1", [targetId]);
      await client.query("DELETE FROM messages WHERE sender_id = $1 OR receiver_id = $1", [targetId]);
      await client.query("DELETE FROM follows WHERE follower_id = $1 OR following_id = $1", [targetId]);
      await client.query("DELETE FROM users WHERE id = $1", [targetId]);
      await client.query("COMMIT");
      res.json({ success: true, message: "User and all related content deleted." });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
