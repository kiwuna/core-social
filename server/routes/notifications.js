const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");

// GET /notifications
router.get("/", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;

  try {
    const query = `
      SELECT 
        n.id, n.type, n.is_read, n.created_at, n.post_id, n.sender_id,
        u.username as sender_username, u.display_name as sender_display_name, u.emoji as sender_emoji, u.avatar_path as sender_avatar,
        p.content as post_content,
        CASE 
          WHEN n.type = 'message' THEN 'New message'
          ELSE NULL
        END as message_preview
      FROM notifications n
      JOIN users u ON n.sender_id = u.id
      LEFT JOIN posts p ON n.post_id = p.id
      WHERE n.recipient_id = $1
      ORDER BY n.created_at DESC
      LIMIT 50
    `;
    const result = await db.query(query, [userId]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /notifications/read (Mark all as read)
router.post("/read", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;

  try {
    await db.query("UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1", [userId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /notifications/clear-all
router.delete("/clear-all", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  try {
    await db.query("DELETE FROM notifications WHERE recipient_id = $1", [userId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /notifications/:id
router.delete("/:id", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  const noteId = req.params.id;
  try {
    await db.query("DELETE FROM notifications WHERE id = $1 AND recipient_id = $2", [noteId, userId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
