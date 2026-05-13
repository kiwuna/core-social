const express = require("express");
const { isAuthenticated } = require("../middleware/auth");
const router = express.Router();

// GET /feed/following - Shows posts only from followed users
router.get("/following", isAuthenticated, (req, res, next) => {
  const db = req.app.locals.db;
  const currentUserId = req.session.userId;

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
    JOIN follows f ON p.user_id = f.following_id
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN polls pl ON pl.post_id = p.id
    WHERE f.follower_id = ?
    ORDER BY p.id DESC
  `;

  db.all(query, [currentUserId, currentUserId], (error, rows) => {
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

module.exports = router;
