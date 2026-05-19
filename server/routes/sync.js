const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const { sendVerificationEmail, sendUnlinkEmail } = require("../utils/mailer");

// Helper to generate 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /api/sync-request
 * Generates a sync code and emails it to the user.
 */
router.post("/sync-request", isAuthenticated, async (req, res, next) => {
  const { email } = req.body;
  const db = req.app.locals.db;
  const userId = req.session.userId;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // 1. Fetch current user from database to check for an existing email
    const dbResult = await db.query(
      "SELECT email FROM users WHERE id = $1",
      [userId]
    );
    const dbUser = dbResult.rows[0];

    // 2. Validate and fall back to database email if req.body.email is missing/empty
    const finalEmail = (email && typeof email === 'string' && email.trim()) 
      ? email.trim() 
      : (dbUser && dbUser.email ? dbUser.email.trim() : null);

    if (!finalEmail || typeof finalEmail !== "string" || !finalEmail.includes("@")) {
      return res.status(400).json({ error: "A valid email is required. Please provide a valid email address." });
    }

    const code = generateCode();

    // 3. Save code and timestamp to user (BIGINT raw milliseconds)
    await db.query(
      "UPDATE users SET email = $1, sync_code = $2, last_sync_request = $3 WHERE id = $4",
      [finalEmail.toLowerCase(), code, Date.now(), userId]
    );

    // 4. Dispatch the CORE themed email in the background without awaiting it!
    sendVerificationEmail(finalEmail, code).catch(err => {
      console.error(`❌ Background SMTP Dispatch failed for ${finalEmail}:`, err.message);
    });

    // 5. Instantly return success to frontend in under 1 second!
    return res.status(200).json({ 
      success: true, 
      message: "Verification code requested!" 
    });
  } catch (err) {
    console.error("Sync request error stack:", err.stack);
    res.status(500).json({ error: "Failed to generate sync code. Please check database configuration." });
  }
});

/**
 * POST /api/sync-verify
 * Verifies the code and marks the user as synced.
 */
router.post("/sync-verify", isAuthenticated, async (req, res, next) => {
  const { code } = req.body;
  const db = req.app.locals.db;
  const userId = req.session.userId;

  if (!code) {
    return res.status(400).json({ error: "Verification code is required." });
  }

  try {
    const result = await db.query(
      "SELECT sync_code FROM users WHERE id = $1",
      [userId]
    );

    const user = result.rows[0];
    const inputCode = String(code).trim();
    const dbCode = user && user.sync_code ? String(user.sync_code).trim() : "";

    if (!dbCode || dbCode !== inputCode) {
      return res.status(400).json({ error: "Invalid or expired verification code." });
    }

    // Success: Mark as synced & verified and clear code
    await db.query(
      "UPDATE users SET is_synced = TRUE, is_verified = TRUE, sync_code = NULL WHERE id = $1",
      [userId]
    );

    return res.status(200).json({ 
      success: true, 
      isSynced: true,
      message: "Email successfully synced & verified!" 
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/unlink-request
 * Generates a verification code and sends it to the user's current synced email.
 */
router.post("/unlink-request", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;

  try {
    const result = await db.query(
      "SELECT email, is_synced, is_verified FROM users WHERE id = $1",
      [userId]
    );

    const user = result.rows[0];
    if (!user || !user.email) {
      return res.status(400).json({ error: "No email address linked to this account." });
    }

    const code = generateCode();

    // Save code
    await db.query(
      "UPDATE users SET sync_code = $1 WHERE id = $2",
      [code, userId]
    );

    // Send the CORE themed verification email asynchronously in the background
    try {
      sendVerificationEmail(user.email, code).catch(error => {
        console.error('Unlink mailer error:', error);
      });
    } catch (error) {
      console.error('Unlink mailer error:', error);
    }

    return res.status(200).json({ 
      success: true, 
      message: "Unlink verification code sent to your email!" 
    });
  } catch (err) {
    console.error("Unlink request error:", err.stack);
    res.status(500).json({ error: "Failed to initiate unlink sequence." });
  }
});

/**
 * POST /api/unlink-verify
 * Verifies the unlink code and unlinks the account.
 */
router.post("/unlink-verify", isAuthenticated, async (req, res, next) => {
  const { code } = req.body;
  const db = req.app.locals.db;
  const userId = req.session.userId;

  if (!code) {
    return res.status(400).json({ error: "Verification code is required." });
  }

  try {
    const result = await db.query(
      "SELECT sync_code FROM users WHERE id = $1",
      [userId]
    );

    const user = result.rows[0];
    const inputCode = String(code).trim();
    const dbCode = user && user.sync_code ? String(user.sync_code).trim() : "";

    if (!dbCode || dbCode !== inputCode) {
      return res.status(400).json({ error: "Invalid verification code." });
    }

    // Success: Remove email and mark as unverified/unsynced
    await db.query(
      "UPDATE users SET email = NULL, is_synced = FALSE, is_verified = FALSE, sync_code = NULL WHERE id = $1",
      [userId]
    );

    return res.status(200).json({ 
      success: true, 
      message: "Email successfully unlinked!" 
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
