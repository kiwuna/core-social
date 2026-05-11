const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { isAuthenticated } = require("../middleware/auth");

const router = express.Router();
const MAX_POST_LENGTH = Number(process.env.MAX_POST_LENGTH) || 300;
const uploadsDirectory = path.join(__dirname, "..", "uploads");

fs.mkdirSync(uploadsDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadsDirectory);
  },
  filename(req, file, cb) {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const safeExtension = extension || ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  }
});

// Get all posts
router.get("/", (req, res, next) => {
  const db = req.app.locals.db;
  const currentUserId = req.session.userId || 0;
  
  const query = `
    SELECT 
      p.id, p.content, p.likes, p.image_path, p.created_at, p.user_id,
      COALESCE(u.emoji, '👻') as emoji,
      COALESCE(u.username, 'anonymous') as username,
      EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND post_id = p.id) as has_liked
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    ORDER BY p.id DESC
  `;

  db.all(query, [currentUserId], (error, rows) => {
    if (error) return next(error);
    res.json(rows);
  });
});

// Get posts by user ID
router.get("/user/:userId", (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.params.userId;
  const currentUserId = req.session.userId || 0;

  const query = `
    SELECT 
      p.id, p.content, p.likes, p.image_path, p.created_at, p.user_id,
      COALESCE(u.emoji, '👻') as emoji,
      COALESCE(u.username, 'anonymous') as username,
      EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND post_id = p.id) as has_liked
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ?
    ORDER BY p.id DESC
  `;

  db.all(query, [currentUserId, userId], (error, rows) => {
    if (error) return next(error);
    res.json(rows);
  });
});

// Create a new post (Protected)
router.post("/", isAuthenticated, upload.single("image"), (req, res, next) => {
  const db = req.app.locals.db;
  const rawContent = typeof req.body?.content === "string" ? req.body.content : "";
  const content = rawContent.trim();
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const userId = req.session.userId;

  if (!content && !imagePath) {
    return res.status(400).json({ error: "Post must contain text or an image." });
  }

  if (content.length > MAX_POST_LENGTH) {
    return res.status(400).json({
      error: `Post content must be ${MAX_POST_LENGTH} characters or less.`
    });
  }

  const query = `INSERT INTO posts (content, image_path, user_id) VALUES (?, ?, ?)`;
  db.run(query, [content, imagePath, userId], function onInsert(error) {
    if (error) return next(error);

    const createdPost = {
      id: this.lastID,
      content,
      likes: 0,
      image_path: imagePath,
      user_id: userId,
      emoji: req.session.userEmoji,
      created_at: new Date().toISOString()
    };

    res.status(201).json(createdPost);
  });
});

// Like a post (Protected)
router.post("/:id/like", isAuthenticated, (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);
  const userId = req.session.userId;

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id." });
  }

  // First, check if the user already liked this post
  db.get(`SELECT id FROM likes WHERE user_id = ? AND post_id = ?`, [userId, postId], (err, like) => {
    if (err) return next(err);
    if (like) return res.status(400).json({ error: "You already liked this post." });

    // Transactional-like behavior: add record to likes table and increment posts table
    db.serialize(() => {
      db.run(`INSERT INTO likes (user_id, post_id) VALUES (?, ?)`, [userId, postId], (insertErr) => {
        if (insertErr) return next(insertErr);

        db.run(`UPDATE posts SET likes = likes + 1 WHERE id = ?`, [postId], function(updateErr) {
          if (updateErr) return next(updateErr);
          
          db.get(`SELECT likes FROM posts WHERE id = ?`, [postId], (getError, row) => {
            if (getError) return next(getError);
            res.json({ id: postId, likes: row.likes });
          });
        });
      });
    });
  });
});

// Delete a post (Protected + Ownership Check)
router.delete("/:id", isAuthenticated, (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);
  const userId = req.session.userId;

  console.log(`Delete request for post ${postId} by user ${userId}`);

  db.get(`SELECT user_id, image_path FROM posts WHERE id = ?`, [postId], (getError, row) => {
    if (getError) return next(getError);
    if (!row) return res.status(404).json({ error: "Post not found." });

    console.log(`Post owner: ${row.user_id}, Requester: ${userId}`);

    // Ownership check
    if (row.user_id !== userId) {
      return res.status(403).json({ error: "You do not have permission to delete this post. You can only delete posts you created while logged in." });
    }

    db.run(`DELETE FROM posts WHERE id = ?`, [postId], function onDelete(error) {
      if (error) return next(error);

      if (row.image_path) {
        const imageFilename = path.basename(row.image_path);
        const imageDiskPath = path.join(uploadsDirectory, imageFilename);
        fs.unlink(imageDiskPath, () => {});
      }

      res.json({ message: "Post deleted." });
    });
  });
});

module.exports = router;
