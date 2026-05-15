const express = require("express");
const { isAuthenticated } = require("../middleware/auth");
const router = express.Router();

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

// GET /feed/following - Shows posts only from followed users
router.get("/following", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const currentUserId = req.session.userId;

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
      JOIN follows f ON p.user_id = f.following_id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN polls pl ON pl.post_id = p.id
      WHERE f.follower_id = $2
      ORDER BY p.id DESC
    `;
    const result = await db.query(query, [currentUserId, currentUserId]);
    const posts = await attachPolls(db, result.rows, currentUserId);
    res.json(posts);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
