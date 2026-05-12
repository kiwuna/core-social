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
      COALESCE(p.font_style, 'default') as font_style,
      COALESCE(u.emoji, '👻') as emoji,
      COALESCE(u.username, 'anonymous') as username,
      u.display_name,
      COALESCE(u.is_premium, 0) as is_premium,
      u.avatar_path,
      EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND post_id = p.id) as has_liked,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      pl.id as poll_id, pl.question as poll_question
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN polls pl ON pl.post_id = p.id
    ORDER BY p.id DESC
  `;

  db.all(query, [currentUserId], (error, rows) => {
    if (error) return next(error);
    
    // For each post, if it has a poll, fetch its options and votes
    const fetchPolls = rows.map(post => {
      if (!post.poll_id) return Promise.resolve(post);
      
      return new Promise((resolve, reject) => {
        const optionsQuery = `
          SELECT 
            po.id, po.option_text,
            (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count,
            EXISTS(SELECT 1 FROM poll_votes WHERE poll_id = ? AND user_id = ? AND option_id = po.id) as user_voted
          FROM poll_options po
          WHERE po.poll_id = ?
        `;
        db.all(optionsQuery, [post.poll_id, currentUserId, post.poll_id], (err, options) => {
          if (err) return reject(err);
          post.poll = {
            id: post.poll_id,
            question: post.poll_question,
            options: options,
            total_votes: options.reduce((sum, opt) => sum + opt.vote_count, 0),
            user_has_voted: options.some(opt => opt.user_voted)
          };
          resolve(post);
        });
      });
    });

    Promise.all(fetchPolls)
      .then(results => res.json(results))
      .catch(err => next(err));
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
      COALESCE(p.font_style, 'default') as font_style,
      COALESCE(u.emoji, '👻') as emoji,
      COALESCE(u.username, 'anonymous') as username,
      u.display_name,
      COALESCE(u.is_premium, 0) as is_premium,
      u.avatar_path,
      EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND post_id = p.id) as has_liked,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      pl.id as poll_id, pl.question as poll_question
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN polls pl ON pl.post_id = p.id
    WHERE p.user_id = ?
    ORDER BY p.id DESC
  `;

  db.all(query, [currentUserId, userId], (error, rows) => {
    if (error) return next(error);
    
    // For each post, if it has a poll, fetch its options and votes
    const fetchPolls = rows.map(post => {
      if (!post.poll_id) return Promise.resolve(post);
      
      return new Promise((resolve, reject) => {
        const optionsQuery = `
          SELECT 
            po.id, po.option_text,
            (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count,
            EXISTS(SELECT 1 FROM poll_votes WHERE poll_id = ? AND user_id = ? AND option_id = po.id) as user_voted
          FROM poll_options po
          WHERE po.poll_id = ?
        `;
        db.all(optionsQuery, [post.poll_id, currentUserId, post.poll_id], (err, options) => {
          if (err) return reject(err);
          post.poll = {
            id: post.poll_id,
            question: post.poll_question,
            options: options,
            total_votes: options.reduce((sum, opt) => sum + opt.vote_count, 0),
            user_has_voted: options.some(opt => opt.user_voted)
          };
          resolve(post);
        });
      });
    });

    Promise.all(fetchPolls)
      .then(results => res.json(results))
      .catch(err => next(err));
  });
});

// Create a new post (Protected)
router.post("/", isAuthenticated, upload.single("image"), (req, res, next) => {
  const db = req.app.locals.db;
  const rawContent = typeof req.body?.content === "string" ? req.body.content : "";
  const content = rawContent.trim();
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const userId = req.session.userId;

  // Font style (premium feature, validated server-side)
  const ALLOWED_FONTS = ['default', 'serif', 'mono', 'bold'];
  const fontStyle = ALLOWED_FONTS.includes(req.body.font_style) ? req.body.font_style : 'default';
  
  // Poll data
  let pollData = null;
  if (req.body.poll) {
    try {
      pollData = JSON.parse(req.body.poll);
    } catch (e) {
      return res.status(400).json({ error: "Invalid poll data." });
    }
  }

  if (!content && !imagePath && !pollData) {
    return res.status(400).json({ error: "Post must contain text, an image, or a poll." });
  }

  if (content.length > MAX_POST_LENGTH) {
    return res.status(400).json({
      error: `Post content must be ${MAX_POST_LENGTH} characters or less.`
    });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    const query = `INSERT INTO posts (content, image_path, user_id, font_style) VALUES (?, ?, ?, ?)`;
    db.run(query, [content, imagePath, userId, fontStyle], function onInsert(error) {
      if (error) {
        db.run("ROLLBACK");
        return next(error);
      }

      const postId = this.lastID;

      if (pollData && pollData.question && pollData.options && pollData.options.length >= 2) {
        db.run(`INSERT INTO polls (post_id, question) VALUES (?, ?)`, [postId, pollData.question], function(pollErr) {
          if (pollErr) {
            db.run("ROLLBACK");
            return next(pollErr);
          }
          
          const pollId = this.lastID;
          const optionQueries = pollData.options.map(opt => {
            return new Promise((resolve, reject) => {
              db.run(`INSERT INTO poll_options (poll_id, option_text) VALUES (?, ?)`, [pollId, opt], (optErr) => {
                if (optErr) reject(optErr);
                else resolve();
              });
            });
          });

          Promise.all(optionQueries)
            .then(() => {
              db.run("COMMIT");
              res.status(201).json({
                id: postId,
                content,
                likes: 0,
                image_path: imagePath,
                user_id: userId,
                emoji: req.session.userEmoji,
                created_at: new Date().toISOString(),
                poll: { ...pollData, id: pollId, options: pollData.options.map(o => ({ option_text: o, vote_count: 0, user_voted: false })), total_votes: 0, user_has_voted: false }
              });
            })
            .catch(err => {
              db.run("ROLLBACK");
              next(err);
            });
        });
      } else {
        db.run("COMMIT");
        res.status(201).json({
          id: postId,
          content,
          likes: 0,
          image_path: imagePath,
          user_id: userId,
          font_style: fontStyle,
          emoji: req.session.userEmoji,
          created_at: new Date().toISOString()
        });
      }
    });
  });
});

// Vote on a poll (Protected)
router.post("/:id/vote", isAuthenticated, (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);
  const userId = req.session.userId;
  const { optionId } = req.body;

  if (!optionId) return res.status(400).json({ error: "Option ID is required." });

  // Get poll ID for this post
  db.get(`SELECT id FROM polls WHERE post_id = ?`, [postId], (err, poll) => {
    if (err) return next(err);
    if (!poll) return res.status(404).json({ error: "Poll not found for this post." });

    const pollId = poll.id;

    // Check if user already voted
    db.get(`SELECT id FROM poll_votes WHERE poll_id = ? AND user_id = ?`, [pollId, userId], (voteErr, vote) => {
      if (voteErr) return next(voteErr);
      if (vote) return res.status(400).json({ error: "You have already voted on this poll." });

      // Record vote
      db.run(`INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)`, [pollId, optionId, userId], (insertErr) => {
        if (insertErr) return next(insertErr);

        // Fetch updated poll data
        const optionsQuery = `
          SELECT 
            po.id, po.option_text,
            (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count,
            EXISTS(SELECT 1 FROM poll_votes WHERE poll_id = ? AND user_id = ? AND option_id = po.id) as user_voted
          FROM poll_options po
          WHERE po.poll_id = ?
        `;
        db.all(optionsQuery, [pollId, userId, pollId], (err, options) => {
          if (err) return next(err);
          
          // Get question too
          db.get(`SELECT question FROM polls WHERE id = ?`, [pollId], (qErr, pollRow) => {
            if (qErr) return next(qErr);
            res.json({
              poll: {
                id: pollId,
                question: pollRow.question,
                options: options,
                total_votes: options.reduce((sum, opt) => sum + opt.vote_count, 0),
                user_has_voted: true
              }
            });
          });
        });
      });
    });
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

// Get comments for a post
router.get("/:id/comments", (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);

  const query = `
    SELECT 
      c.id, c.content, c.created_at, c.user_id,
      u.username, u.display_name, u.emoji
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `;

  db.all(query, [postId], (err, rows) => {
    if (err) return next(err);
    res.json(rows);
  });
});

// Add a comment (Protected)
router.post("/:id/comments", isAuthenticated, (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);
  const userId = req.session.userId;
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";

  if (!content) return res.status(400).json({ error: "Comment cannot be empty." });

  const query = `INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)`;
  db.run(query, [postId, userId, content], function(err) {
    if (err) return next(err);
    
    db.get(`SELECT c.*, u.username, u.emoji FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?`, [this.lastID], (getErr, row) => {
      if (getErr) return next(getErr);
      res.status(201).json(row);
    });
  });
});

// Search posts
router.get("/search", (req, res, next) => {
  const db = req.app.locals.db;
  const currentUserId = req.session.userId || 0;
  const q = (req.query.q || "").trim();

  if (!q) return res.json([]);

  const query = `
    SELECT 
      p.id, p.content, p.likes, p.image_path, p.created_at, p.user_id,
      COALESCE(p.font_style, 'default') as font_style,
      COALESCE(u.emoji, '👻') as emoji,
      COALESCE(u.username, 'anonymous') as username,
      COALESCE(u.is_premium, 0) as is_premium,
      u.avatar_path,
      EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND post_id = p.id) as has_liked,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      pl.id as poll_id, pl.question as poll_question
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN polls pl ON pl.post_id = p.id
    WHERE p.content LIKE ?
    ORDER BY p.id DESC
    LIMIT 50
  `;

  db.all(query, [currentUserId, `%${q}%`], (error, rows) => {
    if (error) return next(error);

    const fetchPolls = rows.map(post => {
      if (!post.poll_id) return Promise.resolve(post);
      return new Promise((resolve, reject) => {
        const optionsQuery = `
          SELECT 
            po.id, po.option_text,
            (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count,
            EXISTS(SELECT 1 FROM poll_votes WHERE poll_id = ? AND user_id = ? AND option_id = po.id) as user_voted
          FROM poll_options po
          WHERE po.poll_id = ?
        `;
        db.all(optionsQuery, [post.poll_id, currentUserId, post.poll_id], (err, options) => {
          if (err) return reject(err);
          post.poll = {
            id: post.poll_id,
            question: post.poll_question,
            options: options,
            total_votes: options.reduce((sum, opt) => sum + opt.vote_count, 0),
            user_has_voted: options.some(opt => opt.user_voted)
          };
          resolve(post);
        });
      });
    });

    Promise.all(fetchPolls)
      .then(results => res.json(results))
      .catch(err => next(err));
  });
});

module.exports = router;
