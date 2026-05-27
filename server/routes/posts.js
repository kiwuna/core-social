const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { isAuthenticated } = require("../middleware/auth");

const router = express.Router();
const MAX_POST_LENGTH = Number(process.env.MAX_POST_LENGTH) || 300;
const VIEW_MIN_VISIBLE_MS = Number(process.env.VIEW_MIN_VISIBLE_MS) || 1200;
const VIEW_MIN_TOTAL_MS = Number(process.env.VIEW_MIN_TOTAL_MS) || 2000;
const VIEW_HEARTBEAT_MAX_AGE_MS = Number(process.env.VIEW_HEARTBEAT_MAX_AGE_MS) || 15000;
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

function getVisitorKey(req) {
  const anon = typeof req.body?.visitorKey === "string" ? req.body.visitorKey.trim() : "";
  const sessionUser = req.session?.userId ? `user:${req.session.userId}` : "";
  return sessionUser || anon || `ip:${req.ip || "unknown"}`;
}

function hashish(value) {
  return require("crypto").createHash("sha256").update(String(value || "")).digest("hex");
}

async function recordViewEvent(db, payload) {
  const {
    postId,
    visitorKey,
    userId,
    sessionId,
    visibleMs = 0,
    watchMs = 0,
    viewportRatio = 0,
    eventType = "heartbeat",
    deviceHint = null,
    ipHash = null,
    userAgentHash = null,
    completed = false
  } = payload;

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const existingRes = await client.query(
      `SELECT id, is_viewed FROM post_impressions WHERE post_id = $1 AND visitor_key = $2 FOR UPDATE`,
      [postId, visitorKey]
    );
    const existingRow = existingRes.rows[0] || null;
    const wasViewed = !!existingRow?.is_viewed;
    const shouldCountView = completed && !wasViewed;
    const impressionRes = await client.query(
      `
      INSERT INTO post_impressions (
        post_id, visitor_key, user_id, session_id, first_seen_at, last_seen_at,
        visible_ms, is_viewed, device_hint, ip_hash, user_agent_hash
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6, $7, $8, $9)
      ON CONFLICT (post_id, visitor_key)
      DO UPDATE SET
        last_seen_at = NOW(),
        visible_ms = post_impressions.visible_ms + EXCLUDED.visible_ms,
        is_viewed = post_impressions.is_viewed OR EXCLUDED.is_viewed,
        user_id = COALESCE(post_impressions.user_id, EXCLUDED.user_id),
        session_id = COALESCE(post_impressions.session_id, EXCLUDED.session_id)
      RETURNING id, is_viewed, visible_ms
      `,
      [postId, visitorKey, userId || null, sessionId || null, visibleMs, completed, deviceHint, ipHash, userAgentHash]
    );

    await client.query(
      `
      INSERT INTO post_view_events (
        post_id, visitor_key, user_id, event_type, visible_ms, watch_ms, viewport_ratio, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `,
      [postId, visitorKey, userId || null, eventType, Math.max(0, Math.round(visibleMs)), Math.max(0, Math.round(watchMs)), Number(viewportRatio) || 0]
    );

    const day = new Date().toISOString().slice(0, 10);
    const isNewUniqueView = shouldCountView;
    if (visibleMs > 0 || watchMs > 0 || eventType === "impression") {
      await client.query(
        `
        INSERT INTO post_view_aggregates (post_id, day, impressions, unique_views, views, watch_ms, updated_at)
        VALUES ($1, $2, 1, $3, $4, $5, NOW())
        ON CONFLICT (post_id, day)
        DO UPDATE SET
          impressions = post_view_aggregates.impressions + 1,
          unique_views = post_view_aggregates.unique_views + EXCLUDED.unique_views,
          views = post_view_aggregates.views + EXCLUDED.views,
          watch_ms = post_view_aggregates.watch_ms + EXCLUDED.watch_ms,
          updated_at = NOW()
        `,
        [postId, day, isNewUniqueView ? 1 : 0, isNewUniqueView ? 1 : 0, Math.max(0, Math.round(watchMs))]
      );
    }

    if (existingRow && shouldCountView) {
      await client.query(
        `UPDATE post_impressions SET is_viewed = TRUE WHERE id = $1`,
        [existingRow.id]
      );
    }

    await client.query("COMMIT");
    return { impression: impressionRes.rows[0], isNewUniqueView };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
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
        EXISTS(SELECT 1 FROM reposts WHERE user_id = $1 AND post_id = p.id) as has_reposted,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
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
      WITH profile_items AS (
        SELECT 
          p.id, p.content, p.likes, p.image_path, p.video_path, p.media_type, p.created_at, p.user_id,
          COALESCE(p.font_style, 'default') as font_style,
          COALESCE(u.emoji, 'ðŸ‘»') as emoji,
          COALESCE(u.username, 'anonymous') as username,
          u.display_name,
          COALESCE(u.is_premium, 0) as is_premium,
          COALESCE(u.is_synced, false) as is_synced,
          u.avatar_path,
          EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND post_id = p.id) as has_liked,
          EXISTS(SELECT 1 FROM reposts WHERE user_id = $1 AND post_id = p.id) as has_reposted,
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
          (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
          pl.id as poll_id, pl.question as poll_question,
          FALSE AS is_repost,
          NULL::TIMESTAMP AS reposted_at,
          NULL::INTEGER AS original_post_id,
          NULL::TEXT AS reposted_by_name
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN polls pl ON pl.post_id = p.id
        WHERE p.user_id = $2

        UNION ALL

        SELECT
          p.id, p.content, p.likes, p.image_path, p.video_path, p.media_type, r.created_at, $2::INTEGER as user_id,
          COALESCE(p.font_style, 'default') as font_style,
          COALESCE(u.emoji, 'ðŸ‘»') as emoji,
          COALESCE(u.username, 'anonymous') as username,
          u.display_name,
          COALESCE(u.is_premium, 0) as is_premium,
          COALESCE(u.is_synced, false) as is_synced,
          u.avatar_path,
          EXISTS(SELECT 1 FROM likes WHERE user_id = $1 AND post_id = p.id) as has_liked,
          EXISTS(SELECT 1 FROM reposts WHERE user_id = $1 AND post_id = p.id) as has_reposted,
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
          (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
          pl.id as poll_id, pl.question as poll_question,
          TRUE AS is_repost,
          r.created_at AS reposted_at,
          p.id AS original_post_id,
          (SELECT COALESCE(display_name, username) FROM users WHERE id = $2) AS reposted_by_name
        FROM reposts r
        JOIN posts p ON p.id = r.post_id
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN polls pl ON pl.post_id = p.id
        WHERE r.user_id = $2
      )
      SELECT *
      FROM profile_items
      ORDER BY created_at DESC, id DESC
    `;
    const result = await db.query(query, [currentUserId, userId]);
    const posts = await attachPolls(db, result.rows, currentUserId);
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

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
        EXISTS(SELECT 1 FROM reposts WHERE user_id = $1 AND post_id = p.id) as has_reposted,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
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
    const userRes = await db.query("SELECT is_premium FROM users WHERE id = $1", [userId]);
    const user = userRes.rows[0];
    if (!user || !user.is_premium) {
      return res.status(403).json({ error: "Uploading images requires Core Flow." });
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

// Repost a post
router.post("/:id/repost", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);
  const userId = req.session.userId;

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id." });
  }

  try {
    const postCheck = await db.query("SELECT id FROM posts WHERE id = $1", [postId]);
    if (!postCheck.rows[0]) {
      return res.status(404).json({ error: "Post not found." });
    }

    const insertResult = await db.query(
      `INSERT INTO reposts (user_id, post_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, post_id) DO NOTHING
       RETURNING id`,
      [userId, postId]
    );

    if (!insertResult.rows[0]) {
      return res.status(400).json({ error: "You already reposted this post." });
    }

    const countResult = await db.query(
      "SELECT COUNT(*)::int AS repost_count FROM reposts WHERE post_id = $1",
      [postId]
    );

    res.json({ message: "Reposted.", repost_count: countResult.rows[0].repost_count });
  } catch (err) {
    console.error("Repost failed:", err.message);
    next(err);
  }
});

router.delete("/:id/repost", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);
  const userId = req.session.userId;

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id." });
  }

  try {
    const result = await db.query(
      `DELETE FROM reposts
       WHERE user_id = $1 AND post_id = $2
       RETURNING id`,
      [userId, postId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Repost not found." });
    }

    const countResult = await db.query(
      "SELECT COUNT(*)::int AS repost_count FROM reposts WHERE post_id = $1",
      [postId]
    );

    res.json({ message: "Unreposted.", repost_count: countResult.rows[0].repost_count });
  } catch (err) {
    console.error("Unrepost failed:", err.message);
    next(err);
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

// Unlike a post (Protected)
router.delete("/:id/like", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);
  const userId = req.session.userId;

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id." });
  }

  try {
    const likeCheck = await db.query(`SELECT id FROM likes WHERE user_id = $1 AND post_id = $2`, [userId, postId]);
    if (!likeCheck.rows[0]) {
      return res.status(400).json({ error: "You have not liked this post yet." });
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM likes WHERE user_id = $1 AND post_id = $2`, [userId, postId]);
      const updateResult = await client.query(`UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = $1 RETURNING likes`, [postId]);
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

// Report a post
router.post("/:id/report", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  const postId = parseInt(req.params.id);

  try {
    // Check if post exists
    const postRow = await db.query("SELECT id, user_id FROM posts WHERE id = $1", [postId]);
    if (!postRow.rows[0]) return res.status(404).json({ error: "Post not found." });

    // Check if user already reported this post
    const existingReport = await db.query("SELECT id FROM reports WHERE post_id = $1 AND reporter_id = $2", [postId, userId]);
    if (existingReport.rows.length > 0) {
      return res.status(400).json({ error: "You have already reported this post." });
    }

    // Create report
    await db.query("INSERT INTO reports (post_id, reporter_id, created_at) VALUES ($1, $2, NOW())", [postId, userId]);
    res.json({ message: "Post reported." });
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

// Delete a comment if you own the post or the comment
router.delete("/:postId/comments/:commentId", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.postId);
  const commentId = Number(req.params.commentId);
  const userId = req.session.userId;

  if (!Number.isInteger(postId) || !Number.isInteger(commentId)) {
    return res.status(400).json({ error: "Invalid ids." });
  }

  try {
    const postRes = await db.query("SELECT user_id FROM posts WHERE id = $1", [postId]);
    const post = postRes.rows[0];
    if (!post) return res.status(404).json({ error: "Post not found." });

    const commentRes = await db.query("SELECT user_id FROM comments WHERE id = $1 AND post_id = $2", [commentId, postId]);
    const comment = commentRes.rows[0];
    if (!comment) return res.status(404).json({ error: "Comment not found." });

    const isOwner = post.user_id === userId;
    const isCommentAuthor = comment.user_id === userId;
    if (!isOwner && !isCommentAuthor) {
      return res.status(403).json({ error: "You do not have permission to delete this comment." });
    }

    await db.query("DELETE FROM comments WHERE id = $1 AND post_id = $2", [commentId, postId]);
    res.json({ message: "Comment deleted." });
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
        EXISTS(SELECT 1 FROM reposts WHERE user_id = $1 AND post_id = p.id) as has_reposted,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as repost_count,
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

// Track post visibility/impressions/views
router.post("/:id/view", async (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);
  const userId = req.session.userId || null;
  const visitorKey = getVisitorKey(req);
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : null;
  const visibleMs = Number(req.body?.visibleMs) || 0;
  const watchMs = Number(req.body?.watchMs) || 0;
  const viewportRatio = Number(req.body?.viewportRatio) || 0;
  const eventType = ["impression", "heartbeat", "complete", "leave"].includes(req.body?.eventType) ? req.body.eventType : "heartbeat";
  const completed = !!req.body?.completed || (visibleMs >= VIEW_MIN_VISIBLE_MS && watchMs >= VIEW_MIN_TOTAL_MS);

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id." });
  }

  if (visibleMs < 0 || watchMs < 0) {
    return res.status(400).json({ error: "Invalid timing payload." });
  }

  if (visibleMs > VIEW_HEARTBEAT_MAX_AGE_MS * 60) {
    return res.status(400).json({ error: "Payload out of range." });
  }

  try {
    const postCheck = await db.query("SELECT id FROM posts WHERE id = $1", [postId]);
    if (!postCheck.rows[0]) {
      return res.status(404).json({ error: "Post not found." });
    }

    const result = await recordViewEvent(db, {
      postId,
      visitorKey,
      userId,
      sessionId,
      visibleMs,
      watchMs,
      viewportRatio,
      eventType,
      completed,
      deviceHint: req.get("sec-ch-ua-mobile") || null,
      ipHash: hashish(req.ip),
      userAgentHash: hashish(req.get("user-agent"))
    });

    res.json({
      ok: true,
      viewRecorded: result.isNewUniqueView,
      isUniqueView: result.impression.is_viewed || result.isNewUniqueView
    });
  } catch (err) {
    next(err);
  }
});

// Simple analytics snapshot for a post
router.get("/:id/views", async (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);

  try {
    const agg = await db.query(
      `
      SELECT
        COALESCE(SUM(impressions), 0) AS impressions,
        COALESCE(SUM(unique_views), 0) AS unique_views,
        COALESCE(SUM(views), 0) AS views,
        COALESCE(SUM(watch_ms), 0) AS watch_ms
      FROM post_view_aggregates
      WHERE post_id = $1
      `,
      [postId]
    );
    res.json(agg.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

