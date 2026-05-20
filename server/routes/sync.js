const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");

router.post("/sync-request", isAuthenticated, async (req, res, next) => {
  const { email } = req.body;
  const db = req.app.locals.db;
  const userId = req.session.userId;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const finalEmail = email.trim().toLowerCase();

    if (!finalEmail.includes("@")) {
      return res.status(400).json({ error: "A valid email is required. Please provide a valid email address." });
    }

    await db.query(
      "UPDATE users SET email = $1, is_synced = TRUE, is_verified = TRUE, sync_code = NULL, last_sync_request = NULL WHERE id = $2",
      [finalEmail, userId]
    );

    return res.status(200).json({
      success: true,
      isSynced: true,
      message: "Email synced successfully."
    });
  } catch (err) {
    console.error("Sync request error stack:", err.stack);
    return res.status(500).json({ error: "Failed to sync email." });
  }
});

router.post("/sync-verify", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;

  try {
    await db.query(
      "UPDATE users SET is_synced = TRUE, is_verified = TRUE, sync_code = NULL WHERE id = $1",
      [userId]
    );

    return res.status(200).json({
      success: true,
      isSynced: true,
      message: "Email successfully synced."
    });
  } catch (err) {
    next(err);
  }
});

router.post("/unlink-request", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;

  try {
    await db.query(
      "UPDATE users SET email = NULL, is_synced = FALSE, is_verified = FALSE, sync_code = NULL, last_sync_request = NULL WHERE id = $1",
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: "Email unlinked successfully."
    });
  } catch (err) {
    console.error("Unlink request error:", err.stack);
    return res.status(500).json({ error: "Failed to unlink email." });
  }
});

router.post("/unlink-verify", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;

  try {
    await db.query(
      "UPDATE users SET email = NULL, is_synced = FALSE, is_verified = FALSE, sync_code = NULL, last_sync_request = NULL WHERE id = $1",
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
