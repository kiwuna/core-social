const express = require("express");
const router = express.Router();
const db = require("../db/database");

// Fetch conversation list for logged-in user
router.get("/conversations", async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const currentUserId = req.session.userId;

  const baseCte = `
    WITH ranked AS (
      SELECT
        CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS other_user_id,
        m.content,
        m.created_at,
        m.delivered_at,
        m.seen_at,
        ROW_NUMBER() OVER (
          PARTITION BY CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
          ORDER BY m.created_at DESC
        ) AS rn
      FROM messages m
      WHERE m.sender_id = $1 OR m.receiver_id = $1
    )
  `;

  try {
    const rich = await db.query(
      `
      ${baseCte}
      SELECT
        r.other_user_id AS user_id,
        u.username,
        u.display_name,
        u.emoji,
        u.avatar_path,
        r.content AS last_message,
        r.created_at AS last_message_at,
        r.delivered_at AS last_message_delivered_at,
        r.seen_at AS last_message_seen_at
      FROM ranked r
      JOIN users u ON u.id = r.other_user_id
      WHERE r.rn = 1
      ORDER BY r.created_at DESC
      `,
      [currentUserId]
    );
    return res.json(rich.rows);
  } catch (richErr) {
    console.warn("Rich conversations query failed, using fallback:", richErr.message);
  }

  try {
    const fallback = await db.query(
      `
      ${baseCte}
      SELECT
        r.other_user_id AS user_id,
        u.username,
        NULL::TEXT AS display_name,
        NULL::TEXT AS emoji,
        NULL::TEXT AS avatar_path,
        r.content AS last_message,
        r.created_at AS last_message_at,
        r.delivered_at AS last_message_delivered_at,
        r.seen_at AS last_message_seen_at
      FROM ranked r
      JOIN users u ON u.id = r.other_user_id
      WHERE r.rn = 1
      ORDER BY r.created_at DESC
      `,
      [currentUserId]
    );
    return res.json(fallback.rows);
  } catch (err) {
    console.error("Error fetching conversations:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Fetch chat history between logged-in user and a specific friend
router.get("/:userId", async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const currentUserId = req.session.userId;
  const friendId = Number(req.params.userId);
  if (!Number.isInteger(friendId) || friendId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const result = await db.query(
      `SELECT * FROM messages 
       WHERE (sender_id = $1 AND receiver_id = $2) 
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [currentUserId, friendId]
    );

    const undelivered = await db.query(
      `UPDATE messages
       SET delivered_at = COALESCE(delivered_at, NOW())
       WHERE sender_id = $1 AND receiver_id = $2 AND delivered_at IS NULL
       RETURNING id, sender_id, receiver_id, delivered_at, seen_at`,
      [friendId, currentUserId]
    );

    if (undelivered.rows.length && req.app && req.app.get && req.app.get("io")) {
      const io = req.app.get("io");
      const userSockets = req.app.get("userSockets");
      if (userSockets && userSockets.has(friendId)) {
        for (const senderSocketId of userSockets.get(friendId)) {
          undelivered.rows.forEach((row) => {
            io.to(senderSocketId).emit("message_state_update", {
              messageId: row.id,
              delivered_at: row.delivered_at,
              seen_at: row.seen_at,
              chatUserId: currentUserId
            });
          });
        }
      }
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
