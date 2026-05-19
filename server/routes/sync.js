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
    const code = generateCode();

    // Save code and timestamp to user (BIGINT raw milliseconds)
    await db.query(
      "UPDATE users SET email = $1, sync_code = $2, last_sync_request = $3 WHERE id = $4",
      [email.toLowerCase(), code, Date.now(), userId]
    );

    // Send the CORE themed email
    const mailInfo = await sendVerificationEmail(email, code);

    // If SMTP returns null because of a mailer failure, do not throw 500.
    // Instead, log it and let the user view the verification page anyway.
    if (mailInfo === null) {
      console.warn(`⚠️ [SMTP ERROR BYPASS] Failed to dispatch code "${code}" to ${email} via SMTP. Bypassing safely to allow manual admin override.`);
      return res.json({ 
        message: "Verification code requested. (SMTP bypassed due to connection limits)", 
        smtp_failed: true 
      });
    }

    res.json({ message: "Verification code sent to " + email });
  } catch (err) {
    console.error("Sync request error stack:", err.stack);
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

    // Success: Mark as synced & verified and clear code
    await db.query(
      "UPDATE users SET is_synced = TRUE, is_verified = TRUE, sync_code = NULL WHERE id = $1",
      [userId]
    );

    res.json({ message: "Email successfully synced!", isSynced: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
