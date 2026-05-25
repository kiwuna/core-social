const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");

// POST /users/:id/follow
router.post("/:id/follow", isAuthenticated, async (req, res, next) => {
  const followerId = req.session.userId;
  const followingId = parseInt(req.params.id);

  if (followerId === followingId) {
    return res.status(400).json({ error: "You cannot follow yourself." });
  }

  const db = req.app.locals.db;

  try {
    // Check if target user exists
    const userResult = await db.query("SELECT id FROM users WHERE id = $1", [followingId]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: "User not found" });

    await db.query(
      "INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)",
      [followerId, followingId]
    );

    // Create follow notification
    await db.query(
      "INSERT INTO notifications (recipient_id, sender_id, type) VALUES ($1, $2, $3)",
      [followingId, followerId, 'follow']
    );

    res.json({ success: true, message: "Followed successfully" });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: "Already following this user." });
    }
    next(err);
  }
});

// DELETE /users/:id/follow (unfollow)
router.delete("/:id/follow", isAuthenticated, async (req, res, next) => {
  const followerId = req.session.userId;
  const followingId = parseInt(req.params.id);

  const db = req.app.locals.db;

  try {
    const result = await db.query(
      "DELETE FROM follows WHERE follower_id = $1 AND following_id = $2",
      [followerId, followingId]
    );
    if (result.rowCount === 0) {
      return res.status(400).json({ error: "You are not following this user." });
    }
    res.json({ success: true, message: "Unfollowed successfully" });
  } catch (err) {
    next(err);
  }
});

// GET /users/:id/follow-status
router.get("/:id/follow-status", async (req, res, next) => {
  const targetId = parseInt(req.params.id);
  const currentUserId = req.session.userId || null;
  const db = req.app.locals.db;

  try {
    const followerCountRes = db.query("SELECT COUNT(*) as count FROM follows WHERE following_id = $1", [targetId]);
    const followingCountRes = db.query("SELECT COUNT(*) as count FROM follows WHERE follower_id = $1", [targetId]);
    
    let isFollowingRes = Promise.resolve({ rowCount: 0 });
    if (currentUserId) {
      isFollowingRes = db.query("SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2", [currentUserId, targetId]);
    }

    const [followerCount, followingCount, isFollowing] = await Promise.all([followerCountRes, followingCountRes, isFollowingRes]);

    res.json({
      followerCount: parseInt(followerCount.rows[0].count),
      followingCount: parseInt(followingCount.rows[0].count),
      isFollowing: isFollowing.rowCount > 0
    });
  } catch (err) {
    next(err);
  }
});

// GET /users/:id/likes
router.get("/:id/likes", async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.params.id;
  const currentUserId = req.session.userId || 0;

  try {
    const query = `
      SELECT 
        p.*, 
        u.username, u.display_name, u.emoji, u.avatar_path, u.is_premium, u.is_synced,
        EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND post_id = p.id) as has_liked,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM posts p
      JOIN likes l ON p.id = l.post_id
      JOIN users u ON p.user_id = u.id
      WHERE l.user_id = $2
      ORDER BY l.created_at DESC
    `;
    const result = await db.query(query, [currentUserId, userId]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /users/:id/followers
router.get("/:id/followers", async (req, res, next) => {
  const targetId = parseInt(req.params.id);
  const currentUserId = req.session.userId || null;
  const db = req.app.locals.db;

  try {
    const query = `
      SELECT 
        u.id, u.username, u.display_name, u.emoji, u.avatar_path, u.is_premium,
        EXISTS(
          SELECT 1 FROM follows 
          WHERE follower_id = $1 AND following_id = u.id
        ) as is_following
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $2
      ORDER BY f.created_at DESC
    `;
    const result = await db.query(query, [currentUserId, targetId]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /users/:id/following
router.get("/:id/following", async (req, res, next) => {
  const targetId = parseInt(req.params.id);
  const currentUserId = req.session.userId || null;
  const db = req.app.locals.db;

  try {
    const query = `
      SELECT 
        u.id, u.username, u.display_name, u.emoji, u.avatar_path, u.is_premium,
        EXISTS(
          SELECT 1 FROM follows 
          WHERE follower_id = $1 AND following_id = u.id
        ) as is_following
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = $2
      ORDER BY f.created_at DESC
    `;
    const result = await db.query(query, [currentUserId, targetId]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
