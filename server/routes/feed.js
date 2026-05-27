const express = require("express");
const { isAuthenticated } = require("../middleware/auth");
const router = express.Router();
const FEED_CANDIDATE_LIMIT = Number(process.env.FEED_CANDIDATE_LIMIT) || 250;
const FEED_MAX_RESULTS = Number(process.env.FEED_MAX_RESULTS) || 50;
const STOP_WORDS = new Set([
  "the","and","for","with","that","this","from","you","your","are","was","were",
  "have","has","had","not","but","who","what","when","where","why","how","they",
  "them","their","there","here","about","into","over","under","just","like","get",
  "got","too","very","can","cant","will","would","could","should","its","its",
  "lol","omg","u","im","i'm","rt","re","a","an","of","to","in","on","at","as",
  "is","it","be","by","or","if","we","me","my","our","us"
]);

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

function scorePost(post, context) {
  const {
    now = Date.now(),
    sessionSalt = 0,
    userSalt = 0,
    userFollowSet = new Set(),
    recentPostIds = new Set(),
    creatorCounts = new Map(),
    creatorAffinity = new Map(),
    termAffinity = new Map()
  } = context;

  const ageHours = Math.max(0.001, (now - new Date(post.created_at).getTime()) / 36e5);
  const recencyScore = 1 / Math.pow(1 + ageHours, 0.9);
  const likeScore = Math.log1p(Number(post.likes || 0)) * 1.2;
  const commentScore = Math.log1p(Number(post.comment_count || 0)) * 1.9;
  const shareScore = Math.log1p(Number(post.share_count || 0)) * 2.2;
  const saveScore = Math.log1p(Number(post.save_count || 0)) * 2.0;
  const watchScore = Math.log1p(Number(post.watch_ms || 0) / 1000) * 1.1;
  const relationshipScore = userFollowSet.has(Number(post.user_id)) ? 3.2 : 0;
  const qualityPenalty = Number(post.report_count || 0) * 3.0 + Number(post.hide_count || 0) * 2.6;
  const duplicatePenalty = recentPostIds.has(Number(post.id)) ? 4.0 : 0;
  const creatorPenalty = Math.max(0, (creatorCounts.get(Number(post.user_id)) || 0) - 1) * 1.8;

  const creatorPreference = creatorAffinity.get(Number(post.user_id)) || 0;
  const contentTokens = extractContentTokens(post);
  const termMatches = contentTokens.reduce((sum, token) => sum + (termAffinity.get(token) || 0), 0);
  const explorationBoost = Math.sin((Number(post.id) + sessionSalt + userSalt) * 12.9898) * 0.55;
  const creatorJitter = Math.cos((Number(post.user_id) + userSalt) * 78.233) * 0.35;
  const freshnessBoost = Math.max(0, 0.7 - ageHours / 24) * 0.45;

  return (
    (recencyScore * 2.0) +
    likeScore +
    commentScore +
    shareScore +
    saveScore +
    watchScore +
    relationshipScore +
    (creatorPreference * 1.6) +
    (termMatches * 0.45) -
    qualityPenalty -
    duplicatePenalty -
    creatorPenalty +
    explorationBoost +
    creatorJitter +
    freshnessBoost
  );
}

function getSessionSalt(req, currentUserId) {
  const sessionId = req.sessionID || "";
  if (req.session) {
    req.session.feedRequestCount = Number(req.session.feedRequestCount || 0) + 1;
  }
  const requestCount = Number(req.session?.feedRequestCount || 0);
  const source = `${currentUserId || 0}:${sessionId}:${requestCount}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 100000) / 100000;
}

function getUserSalt(currentUserId) {
  if (!currentUserId) return 0.17;
  let hash = 0;
  const source = String(currentUserId);
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 100000) / 100000;
}

function deterministicShuffle(items, seed) {
  const arr = [...items];
  let state = Math.floor(seed * 2147483647) || 1;
  const next = () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function remixForYou(scored, seed) {
  if (scored.length <= 1) return scored;

  const shuffle = (items) => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const elite = shuffle(scored.slice(0, 10));
  const upper = shuffle(scored.slice(10, 24));
  const mid = shuffle(scored.slice(24, 42));
  const tail = deterministicShuffle(scored.slice(36), seed + 0.77);

  return [
    ...elite,
    ...upper,
    ...mid,
    ...tail
  ];
}

function extractContentTokens(post) {
  const text = [
    post.content || "",
    post.poll_question || "",
    post.username || "",
    post.display_name || ""
  ].join(" ").toLowerCase();

  return text
    .split(/[^a-z0-9#]+/g)
    .map((token) => token.replace(/^#/, "").trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function addWeightedAffinity(map, key, weight) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + weight);
}

async function buildUserAffinity(db, currentUserId) {
  const creatorAffinity = new Map();
  const termAffinity = new Map();
  if (!currentUserId) return { creatorAffinity, termAffinity };

  const [likesRes, repostsRes, commentsRes, viewsRes, followsRes] = await Promise.all([
    db.query(`
      SELECT p.user_id, p.content, pl.question AS poll_question
      FROM likes l
      JOIN posts p ON p.id = l.post_id
      LEFT JOIN polls pl ON pl.post_id = p.id
      WHERE l.user_id = $1
      ORDER BY l.created_at DESC
      LIMIT 80
    `, [currentUserId]),
    db.query(`
      SELECT p.user_id, p.content, pl.question AS poll_question
      FROM reposts r
      JOIN posts p ON p.id = r.post_id
      LEFT JOIN polls pl ON pl.post_id = p.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
      LIMIT 80
    `, [currentUserId]),
    db.query(`
      SELECT p.user_id, p.content, pl.question AS poll_question
      FROM comments c
      JOIN posts p ON p.id = c.post_id
      LEFT JOIN polls pl ON pl.post_id = p.id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
      LIMIT 80
    `, [currentUserId]),
    db.query(`
      SELECT p.user_id, p.content, pl.question AS poll_question
      FROM post_impressions pi
      JOIN posts p ON p.id = pi.post_id
      LEFT JOIN polls pl ON pl.post_id = p.id
      WHERE pi.user_id = $1 AND pi.is_viewed = TRUE
      ORDER BY pi.last_seen_at DESC
      LIMIT 120
    `, [currentUserId]),
    db.query(`SELECT following_id FROM follows WHERE follower_id = $1`, [currentUserId])
  ]);

  const follows = new Set(followsRes.rows.map((row) => Number(row.following_id)));

  const applyRows = (rows, creatorWeight, termWeight) => {
    for (const row of rows) {
      if (row.user_id) addWeightedAffinity(creatorAffinity, Number(row.user_id), creatorWeight);
      for (const token of extractContentTokens(row)) {
        addWeightedAffinity(termAffinity, token, termWeight);
      }
    }
  };

  applyRows(likesRes.rows, 2.8, 1.6);
  applyRows(repostsRes.rows, 3.6, 2.0);
  applyRows(commentsRes.rows, 2.3, 1.7);
  applyRows(viewsRes.rows, 1.1, 0.8);

  for (const followedId of follows) {
    addWeightedAffinity(creatorAffinity, followedId, 2.2);
  }

  return { creatorAffinity, termAffinity };
}

async function loadFeedCandidates(db, currentUserId, mode) {
  const baseQuery = `
    SELECT 
      p.id, p.content, p.likes, p.image_path, p.created_at, p.user_id,
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
      pl.id as poll_id, pl.question as poll_question
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN polls pl ON pl.post_id = p.id
  `;

  let where = "";
  const params = [currentUserId];
  if (mode === "following") {
    where = `JOIN follows f ON p.user_id = f.following_id WHERE f.follower_id = $2`;
    params.push(currentUserId);
  }

  const query = `
    ${baseQuery}
    ${where}
    ORDER BY p.created_at DESC
    LIMIT ${FEED_CANDIDATE_LIMIT}
  `;
  const result = await db.query(query, params);
  return result.rows;
}

// GET /feed/following - Ranked posts from followed users
router.get("/following", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const currentUserId = req.session.userId;
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");

  try {
    const candidates = await loadFeedCandidates(db, currentUserId, "following");
    const posts = await attachPolls(db, candidates, currentUserId);
    const { creatorAffinity, termAffinity } = await buildUserAffinity(db, currentUserId);
    const sessionSalt = getSessionSalt(req, currentUserId);
    const userSalt = getUserSalt(currentUserId);
    const userFollowSet = new Set(
      [...creatorAffinity.entries()]
        .filter(([, weight]) => weight >= 2.2)
        .map(([creatorId]) => Number(creatorId))
    );
    const recentPostIds = new Set();
    const creatorCounts = new Map();

    const scored = posts.map((post) => {
      const score = scorePost(post, {
        now: Date.now(),
        sessionSalt,
        userSalt,
        userFollowSet,
        recentPostIds,
        creatorCounts,
        creatorAffinity,
        termAffinity
      });
      recentPostIds.add(Number(post.id));
      creatorCounts.set(Number(post.user_id), (creatorCounts.get(Number(post.user_id)) || 0) + 1);
      return { ...post, feed_score: score };
    });

    scored.sort((a, b) => b.feed_score - a.feed_score || new Date(b.created_at) - new Date(a.created_at));

    const selected = [];
    const queue = [...scored];
    const seenCreators = new Map();
    while (queue.length && selected.length < FEED_MAX_RESULTS) {
      let pickIndex = 0;
      for (let i = 0; i < Math.min(queue.length, 8); i += 1) {
        const candidate = queue[i];
        const creatorCount = seenCreators.get(Number(candidate.user_id)) || 0;
        const candidateScore = candidate.feed_score - (creatorCount * 2.5);
        const currentBest = queue[pickIndex].feed_score - ((seenCreators.get(Number(queue[pickIndex].user_id)) || 0) * 2.5);
        if (candidateScore > currentBest) pickIndex = i;
      }
      const picked = queue.splice(pickIndex, 1)[0];
      selected.push(picked);
      seenCreators.set(Number(picked.user_id), (seenCreators.get(Number(picked.user_id)) || 0) + 1);
    }

    res.json(selected);
  } catch (err) {
    next(err);
  }
});

// GET /feed/ranked - personalized feed with chronological fallback
router.get("/ranked", async (req, res, next) => {
  const db = req.app.locals.db;
  const currentUserId = req.session.userId || 0;
  const fallback = String(req.query.fallback || "").toLowerCase() === "chrono";
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");

  try {
    const candidates = await loadFeedCandidates(db, currentUserId, "all");
    const posts = await attachPolls(db, candidates, currentUserId);

    if (fallback) {
      return res.json(posts.slice(0, FEED_MAX_RESULTS));
    }

    const { creatorAffinity, termAffinity } = await buildUserAffinity(db, currentUserId);
    const sessionSalt = getSessionSalt(req, currentUserId);
    const userSalt = getUserSalt(currentUserId);
    const userFollowSet = new Set(
      [...creatorAffinity.entries()]
        .filter(([, weight]) => weight >= 2.2)
        .map(([creatorId]) => Number(creatorId))
    );

    const recentPostIds = new Set();
    const creatorCounts = new Map();

    const scored = posts.map((post) => {
      const score = scorePost(post, {
        now: Date.now(),
        sessionSalt,
        userSalt,
        userFollowSet,
        recentPostIds,
        creatorCounts,
        creatorAffinity,
        termAffinity
      });
      recentPostIds.add(Number(post.id));
      creatorCounts.set(Number(post.user_id), (creatorCounts.get(Number(post.user_id)) || 0) + 1);
      return { ...post, feed_score: score };
    });

    scored.sort((a, b) => b.feed_score - a.feed_score || new Date(b.created_at) - new Date(a.created_at));

    // Diversity pass: avoid showing too many posts from the same creator back-to-back.
    const selected = [];
    const queue = [...remixForYou(scored, sessionSalt + userSalt)];
    const seenCreators = new Map();
    while (queue.length && selected.length < FEED_MAX_RESULTS) {
      let pickIndex = 0;
      for (let i = 0; i < Math.min(queue.length, 8); i += 1) {
        const candidate = queue[i];
        const creatorCount = seenCreators.get(Number(candidate.user_id)) || 0;
        const candidateScore = candidate.feed_score - (creatorCount * 2.5);
        const currentBest = queue[pickIndex].feed_score - ((seenCreators.get(Number(queue[pickIndex].user_id)) || 0) * 2.5);
        if (candidateScore > currentBest) pickIndex = i;
      }
      const picked = queue.splice(pickIndex, 1)[0];
      selected.push(picked);
      seenCreators.set(Number(picked.user_id), (seenCreators.get(Number(picked.user_id)) || 0) + 1);
    }

    res.json(selected);
  } catch (err) {
    next(err);
  }
});

module.exports = router;


