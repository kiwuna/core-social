const express = require("express");
const router = express.Router();
const db = require("../db/database");

// Fetch chat history between logged-in user and a specific friend
router.get("/:userId", async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const currentUserId = req.session.userId;
  const friendId = req.params.userId;

  try {
    const result = await db.query(
      `SELECT * FROM messages 
       WHERE (sender_id = $1 AND receiver_id = $2) 
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [currentUserId, friendId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
