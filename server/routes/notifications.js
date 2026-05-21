const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");

// GET /notifications/reports (Get all reports for admins/mods)
router.get("/reports", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;

  try {
    // Check if user is admin/mod
    const userRes = await db.query("SELECT role FROM users WHERE id = $1", [userId]);
    const user = userRes.rows[0];
    
    if (!user || !['admin', 'ceo', 'mod'].includes(user.role)) {
      return res.status(403).json({ error: "Access denied." });
    }

    const query = `
      SELECT 
        r.id, r.created_at, r.post_id, r.reporter_id,
        u.username as reporter_username, u.display_name as reporter_display_name, u.emoji as reporter_emoji,
        p.content as post_content
      FROM reports r
      JOIN users u ON r.reporter_id = u.id
      LEFT JOIN posts p ON r.post_id = p.id
      ORDER BY r.created_at DESC
      LIMIT 50
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

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

// POST /notifications/report (Create report notification for mods/admins)
router.post("/report", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  const { post_id } = req.body;

  try {
    // Check if post exists
    const postRow = await db.query("SELECT id, user_id FROM posts WHERE id = $1", [post_id]);
    if (!postRow.rows[0]) return res.status(404).json({ error: "Post not found." });

    // Get all admins and mods
    const usersRes = await db.query("SELECT id, username FROM users WHERE role IN ('admin', 'ceo', 'mod')");
    const adminIds = usersRes.rows.map(u => u.id);

    if (adminIds.length === 0) {
      return res.status(404).json({ error: "No moderators found." });
    }

    // Create notification for each admin/mod
    for (const adminId of adminIds) {
      await db.query(
        "INSERT INTO notifications (type, sender_id, recipient_id, post_id, created_at) VALUES ($1, $2, $3, $4, NOW())",
        ["report", userId, adminId, post_id]
      );
    }

    res.json({ success: true, message: "Report notification sent to moderators." });
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
