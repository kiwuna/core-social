const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { isAuthenticated } = require("../middleware/auth");

const router = express.Router();
const MAX_POST_LENGTH = Number(process.env.MAX_POST_LENGTH) || 300;
const uploadsDirectory = path.join(__dirname, "..", "uploads");

fs.mkdirSync(uploadsDirectory, { recursive: true });

const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME || "dtfjqbkas",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "core_posts",
    format: async (req, file) => "jpg", // Force JPG to strip animation
    transformation: [{ width: 800, height: 800, crop: "fill" }]
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

// Helper to fetch polls for a list of posts
async function attachPolls(db, posts, currentUserId) {
  const fetchPolls = posts.map(async (post) => {
    if (!post.poll_id) return post;
    
    const optionsQuery = `
      SELECT 
        po.id, po.option_text,
        (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count,
        EXISTS(SELECT 1 FROM poll_votes WHERE poll_id = $1 AND user_id = $2 AND option_id = po.id) as user_voted
      FROM poll_options po
      WHERE po.poll_id = $3
    `;
    const result = await db.query(optionsQuery, [post.poll_id, currentUserId, post.poll_id]);
    const options = result.rows;
    
    post.poll = {
      id: post.poll_id,
      question: post.poll_question,
      options: options,
      total_votes: options.reduce((sum, opt) => sum + Number(opt.vote_count), 0),
      user_has_voted: options.some(opt => opt.user_voted)
    };
    return post;
  });

  return Promise.all(fetchPolls);
}

// Get all posts
router.get("/", async (req, res, next) => {
  const db = req.app.locals.db;
  const currentUserId = req.session.userId || 0;

  try {
    const query = `
      SELECT 
        p.id, p.content, p.likes, p.image_path, p.created_at, p.user_id,
        COALESCE(p.font_style, 'default') as font_style,
        COALESCE(u.emoji, '👻') as emoji,
        COALESCE(u.username, 'anonymous') as username,
        u.display_name,
        COALESCE(u.is_premium, 0) as is_premium,
        COALESCE(u.is_synced, false) as is_synced,
        u.avatar_path,
        EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND post_id = p.id) as has_liked,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
        pl.id as poll_id, pl.question as poll_question
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN polls pl ON pl.post_id = p.id
      ORDER BY p.id DESC
    `;
    const result = await db.query(query, [currentUserId]);
    const posts = await attachPolls(db, result.rows, currentUserId);
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

// Get posts by user ID
router.get("/user/:userId", async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.params.userId;
  const currentUserId = req.session.userId || 0;

  try {
    const query = `
      SELECT 
        p.id, p.content, p.likes, p.image_path, p.created_at, p.user_id,
        COALESCE(p.font_style, 'default') as font_style,
        COALESCE(u.emoji, '👻') as emoji,
        COALESCE(u.username, 'anonymous') as username,
        u.display_name,
        COALESCE(u.is_premium, 0) as is_premium,
        COALESCE(u.is_synced, false) as is_synced,
        u.avatar_path,
        EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND post_id = p.id) as has_liked,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
        pl.id as poll_id, pl.question as poll_question
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN polls pl ON pl.post_id = p.id
      WHERE p.user_id = $2
      ORDER BY p.id DESC
    `;
    const result = await db.query(query, [currentUserId, userId]);
    const posts = await attachPolls(db, result.rows, currentUserId);
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

// Create a new post (Protected)
router.post("/", isAuthenticated, upload.single("image"), async (req, res, next) => {
  const db = req.app.locals.db;
  const rawContent = typeof req.body?.content === "string" ? req.body.content : "";
  const content = rawContent.trim();
  const imagePath = req.file ? req.file.path : null;
  const userId = req.session.userId;

  const ALLOWED_FONTS = ['default', 'serif', 'mono', 'bold'];
  const fontStyle = ALLOWED_FONTS.includes(req.body.font_style) ? req.body.font_style : 'default';
  
  let pollData = null;
  if (req.body.poll) {
    try {
      pollData = JSON.parse(req.body.poll);
    } catch (e) {
      return res.status(400).json({ error: "Invalid poll data." });
    }
  }

  if (imagePath) {
    const userRes = await db.query("SELECT is_premium, is_synced FROM users WHERE id = $1", [userId]);
    const user = userRes.rows[0];
    if (!user || !user.is_premium) {
      return res.status(403).json({ error: "Uploading images requires Core Flow." });
    }
    if (!user.is_synced) {
      return res.status(403).json({ error: "Please sync your email in settings to upload images." });
    }
  }

  if (!content && !imagePath && !pollData) {
    return res.status(400).json({ error: "Post must contain text, an image, or a poll." });
  }

  if (content.length > MAX_POST_LENGTH) {
    return res.status(400).json({ error: `Post content must be ${MAX_POST_LENGTH} characters or less.` });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const postQuery = `INSERT INTO posts (content, image_path, user_id, font_style) VALUES ($1, $2, $3, $4) RETURNING id, created_at`;
    const postResult = await client.query(postQuery, [content, imagePath, userId, fontStyle]);
    const postId = postResult.rows[0].id;
    const createdAt = postResult.rows[0].created_at;

    if (pollData && pollData.question && pollData.options && pollData.options.length >= 2) {
      const pollQuery = `INSERT INTO polls (post_id, question) VALUES ($1, $2) RETURNING id`;
      const pollResult = await client.query(pollQuery, [postId, pollData.question]);
      const pollId = pollResult.rows[0].id;
      
      const optionQueries = pollData.options.map(opt => {
        return client.query(`INSERT INTO poll_options (poll_id, option_text) VALUES ($1, $2)`, [pollId, opt]);
      });
      await Promise.all(optionQueries);

      await client.query("COMMIT");
      res.status(201).json({
        id: postId,
        content,
        likes: 0,
        image_path: imagePath,
        user_id: userId,
        emoji: req.session.userEmoji,
        created_at: createdAt,
        poll: { ...pollData, id: pollId, options: pollData.options.map(o => ({ option_text: o, vote_count: 0, user_voted: false })), total_votes: 0, user_has_voted: false }
      });
    } else {
      await client.query("COMMIT");
      res.status(201).json({
        id: postId,
        content,
        likes: 0,
        image_path: imagePath,
        user_id: userId,
        font_style: fontStyle,
        emoji: req.session.userEmoji,
        created_at: createdAt
      });
    }
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

// Vote on a poll (Protected)
router.post("/:id/vote", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);
  const userId = req.session.userId;
  const { optionId } = req.body;

  if (!optionId) return res.status(400).json({ error: "Option ID is required." });

  try {
    const pollResult = await db.query(`SELECT id FROM polls WHERE post_id = $1`, [postId]);
    const poll = pollResult.rows[0];
    if (!poll) return res.status(404).json({ error: "Poll not found for this post." });

    const pollId = poll.id;

    const voteCheck = await db.query(`SELECT id FROM poll_votes WHERE poll_id = $1 AND user_id = $2`, [pollId, userId]);
    if (voteCheck.rows[0]) return res.status(400).json({ error: "You have already voted on this poll." });

    await db.query(`INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)`, [pollId, optionId, userId]);

    const optionsQuery = `
      SELECT 
        po.id, po.option_text,
        (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count,
        EXISTS(SELECT 1 FROM poll_votes WHERE poll_id = $1 AND user_id = $2 AND option_id = po.id) as user_voted
      FROM poll_options po
      WHERE po.poll_id = $3
    `;
    const optionsResult = await db.query(optionsQuery, [pollId, userId, pollId]);
    const options = optionsResult.rows;

    const questionResult = await db.query(`SELECT question FROM polls WHERE id = $1`, [pollId]);
    
    res.json({
      poll: {
        id: pollId,
        question: questionResult.rows[0].question,
        options: options,
        total_votes: options.reduce((sum, opt) => sum + Number(opt.vote_count), 0),
        user_has_voted: true
      }
    });
  } catch (err) {
    next(err);
  }
});

// Like a post (Protected)
router.post("/:id/like", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);
  const userId = req.session.userId;

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id." });
  }

  try {
    const likeCheck = await db.query(`SELECT id FROM likes WHERE user_id = $1 AND post_id = $2`, [userId, postId]);
    if (likeCheck.rows[0]) return res.status(400).json({ error: "You already liked this post." });

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO likes (user_id, post_id) VALUES ($1, $2)`, [userId, postId]);
      const updateResult = await client.query(`UPDATE posts SET likes = likes + 1 WHERE id = $1 RETURNING likes, user_id`, [postId]);
      
      const postOwnerId = updateResult.rows[0].user_id;
      if (postOwnerId !== userId) {
        await client.query(
          "INSERT INTO notifications (recipient_id, sender_id, type, post_id) VALUES ($1, $2, $3, $4)",
          [postOwnerId, userId, 'like', postId]
        );
      }

      await client.query("COMMIT");
      res.json({ id: postId, likes: updateResult.rows[0].likes });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// Delete a post (Protected + Ownership Check)
router.delete("/:id", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);
  const userId = req.session.userId;

  try {
    const postResult = await db.query(`SELECT user_id, image_path FROM posts WHERE id = $1`, [postId]);
    const row = postResult.rows[0];
    
    if (!row) return res.status(404).json({ error: "Post not found." });
    if (row.user_id !== userId) {
      return res.status(403).json({ error: "You do not have permission to delete this post." });
    }

    await db.query(`DELETE FROM posts WHERE id = $1`, [postId]);

    // Optional: add cloudinary delete logic here using row.image_path (extract public_id)
    // For now, removing local fs.unlink since it's a cloudinary URL.

    res.json({ message: "Post deleted." });
  } catch (err) {
    next(err);
  }
});

// Get comments for a post
router.get("/:id/comments", async (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);

  try {
    const query = `
      SELECT 
        c.id, c.content, c.created_at, c.user_id,
        u.username, u.display_name, u.emoji, u.avatar_path, u.is_premium, u.is_synced
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `;
    const result = await db.query(query, [postId]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Add a comment (Protected)
router.post("/:id/comments", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);
  const userId = req.session.userId;
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";

  if (!content) return res.status(400).json({ error: "Comment cannot be empty." });

  try {
    const insertQuery = `INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING id`;
    const insertResult = await db.query(insertQuery, [postId, userId, content]);
    
    // Notification for comment
    const postOwnerRes = await db.query("SELECT user_id FROM posts WHERE id = $1", [postId]);
    const postOwnerId = postOwnerRes.rows[0]?.user_id;
    if (postOwnerId && postOwnerId !== userId) {
      await db.query(
        "INSERT INTO notifications (recipient_id, sender_id, type, post_id) VALUES ($1, $2, $3, $4)",
        [postOwnerId, userId, 'comment', postId]
      );
    }

    const getQuery = `SELECT c.*, u.username, u.emoji, u.avatar_path, u.is_premium, u.is_synced FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = $1`;
    const getResult = await db.query(getQuery, [insertResult.rows[0].id]);
    res.status(201).json(getResult.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Search posts
router.get("/search", async (req, res, next) => {
  const db = req.app.locals.db;
  const currentUserId = req.session.userId || 0;
  const q = (req.query.q || "").trim();

  if (!q) return res.json([]);

  try {
    const query = `
      SELECT 
        p.id, p.content, p.likes, p.image_path, p.created_at, p.user_id,
        COALESCE(p.font_style, 'default') as font_style,
        COALESCE(u.emoji, '👻') as emoji,
        COALESCE(u.username, 'anonymous') as username,
        COALESCE(u.is_premium, 0) as is_premium,
        COALESCE(u.is_synced, false) as is_synced,
        u.avatar_path,
        EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND post_id = p.id) as has_liked,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
        pl.id as poll_id, pl.question as poll_question
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN polls pl ON pl.post_id = p.id
      WHERE p.content ILIKE $2
      ORDER BY p.id DESC
      LIMIT 50
    `;
    const result = await db.query(query, [currentUserId, `%${q}%`]);
    const posts = await attachPolls(db, result.rows, currentUserId);
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
