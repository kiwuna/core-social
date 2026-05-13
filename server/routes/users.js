const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middleware/auth");

// POST /users/:id/follow
router.post("/:id/follow", isAuthenticated, (req, res) => {
  const followerId = req.session.userId;
  const followingId = parseInt(req.params.id);

  if (followerId === followingId) {
    return res.status(400).json({ error: "You cannot follow yourself." });
  }

  const db = req.app.locals.db;

  // Check if target user exists
  db.get("SELECT id FROM users WHERE id = ?", [followingId], (err, user) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!user) return res.status(404).json({ error: "User not found" });

    db.run(
      "INSERT INTO follows (follower_id, following_id) VALUES (?, ?)",
      [followerId, followingId],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({ error: "Already following this user." });
          }
          return res.status(500).json({ error: "Database error" });
        }
        res.json({ success: true, message: "Followed successfully" });
      }
    );
  });
});

// DELETE /users/:id/follow (unfollow)
router.delete("/:id/follow", isAuthenticated, (req, res) => {
  const followerId = req.session.userId;
  const followingId = parseInt(req.params.id);

  const db = req.app.locals.db;

  db.run(
    "DELETE FROM follows WHERE follower_id = ? AND following_id = ?",
    [followerId, followingId],
    function (err) {
      if (err) return res.status(500).json({ error: "Database error" });
      if (this.changes === 0) {
        return res.status(400).json({ error: "You are not following this user." });
      }
      res.json({ success: true, message: "Unfollowed successfully" });
    }
  );
});

// GET /users/:id/follow-status
router.get("/:id/follow-status", (req, res) => {
  const targetId = parseInt(req.params.id);
  const currentUserId = req.session.userId || null;
  const db = req.app.locals.db;

  const status = {
    isFollowing: false,
    followerCount: 0,
    followingCount: 0
  };

  // 1. Get counts
  const getFollowerCount = new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM follows WHERE following_id = ?", [targetId], (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });

  const getFollowingCount = new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM follows WHERE follower_id = ?", [targetId], (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });

  const checkIsFollowing = new Promise((resolve, reject) => {
    if (!currentUserId) return resolve(false);
    db.get(
      "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
      [currentUserId, targetId],
      (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      }
    );
  });

  Promise.all([getFollowerCount, getFollowingCount, checkIsFollowing])
    .then(([followerCount, followingCount, isFollowing]) => {
      res.json({
        followerCount,
        followingCount,
        isFollowing
      });
    })
    .catch(err => {
      console.error("Follow status error:", err);
      res.status(500).json({ error: "Database error" });
    });
});

module.exports = router;
