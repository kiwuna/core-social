const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");
const { sendVerificationEmail } = require("../utils/mailer");

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

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  try {
    // Check if email is already synced to another account
    const emailCheck = await db.query("SELECT id FROM users WHERE email = $1 AND id != $2", [email.toLowerCase(), userId]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ 
        type: 'gmail',
        error: "This email is already connected to another account." 
      });
    }

    // Cooldown check: 60 seconds (60,000ms) raw Unix time
    const userResult = await db.query("SELECT last_sync_request FROM users WHERE id = $1", [userId]);
    const lastRequest = userResult.rows[0].last_sync_request; 
    
    if (lastRequest && (Date.now() - Number(lastRequest) < 60000)) {
      const remaining = Math.ceil((60000 - (Date.now() - Number(lastRequest))) / 1000);
      return res.status(429).json({ 
        type: 'cooldown',
        error: `Please wait ${remaining} seconds before requesting a new code.` 
      });
    }

    const code = generateCode();

    // Save code and timestamp to user (BIGINT raw milliseconds)
    await db.query(
      "UPDATE users SET email = $1, sync_code = $2, last_sync_request = $3 WHERE id = $4",
      [email.toLowerCase(), code, Date.now(), userId]
    );

    // Send the CORE themed email
    await sendVerificationEmail(email, code);

    res.json({ message: "Verification code sent to " + email });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ 
        type: 'gmail',
        error: "This email is already connected to another account." 
      });
    }
    console.error("Sync request error:", err);
    res.status(500).json({ error: "Failed to send verification code. Please check your email configuration." });
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
    if (!user || !user.sync_code || user.sync_code !== code) {
      return res.status(400).json({ error: "Invalid or expired verification code." });
    }

    // Success: Mark as synced and clear code
    await db.query(
      "UPDATE users SET is_synced = TRUE, sync_code = NULL WHERE id = $1",
      [userId]
    );

    res.json({ message: "Email successfully synced!", isSynced: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
