const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { isAuthenticated } = require("../middleware/auth");

const uploadsDirectory = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadsDirectory, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination(req, file, cb) { cb(null, uploadsDirectory); },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  }
});

const bannerStorage = multer.diskStorage({
  destination(req, file, cb) { cb(null, uploadsDirectory); },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `banner-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const uploadBanner = multer({
  storage: bannerStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  }
});

// Signup Route
router.post("/signup", async (req, res, next) => {
  const { username, password, emoji } = req.body;
  const db = req.app.locals.db;

  if (!username || !password || !emoji) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    // PostgreSQL uses $1, $2, $3 for placeholders and RETURNING to get the ID
    const query = `INSERT INTO users (username, password_hash, emoji) VALUES ($1, $2, $3) RETURNING id`;
    const result = await db.query(query, [username.toLowerCase(), hash, emoji]);
    const newUser = result.rows[0];

    // Auto-login after signup
    req.session.userId = newUser.id;
    req.session.userEmoji = emoji;
    res.status(201).json({ message: "User created successfully", user: { id: newUser.id, username, emoji } });
  } catch (err) {
    if (err.code === '23505') { // Postgres code for UNIQUE violation
      return res.status(400).json({ error: "Username already taken" });
    }
    next(err);
  }
});

// Login Route
router.post("/login", async (req, res, next) => {
  const { username, password } = req.body;
  const db = req.app.locals.db;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const query = `SELECT * FROM users WHERE username = $1`;
    const result = await db.query(query, [username.toLowerCase()]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    req.session.userId = user.id;
    req.session.userEmoji = user.emoji;
    res.json({ message: "Logged in successfully", user: { id: user.id, username: user.username, emoji: user.emoji, bio: user.bio, is_premium: user.is_premium || 0, avatar_path: user.avatar_path || null } });
  } catch (err) {
    next(err);
  }
});

// Logout Route
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Could not log out" });
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully" });
  });
});

// Get Current User Route
router.get("/me", async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const db = req.app.locals.db;
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "User not found" });
    
    // Strip password
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    next(err);
  }
});

// Get User by ID
router.get("/users/:id", async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = Number(req.params.id);
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    next(err);
  }
});

// Upload Avatar (Premium only)
router.post("/upload-avatar", isAuthenticated, uploadAvatar.single("avatar"), async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;

  if (!req.file) return res.status(400).json({ error: "No file uploaded." });

  try {
    const result = await db.query("SELECT is_premium, avatar_path FROM users WHERE id = $1", [userId]);
    const user = result.rows[0];
    
    if (!user) return res.status(404).json({ error: "User not found." });
    if (!user.is_premium) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: "Custom avatars require Core Flow." });
    }

    if (user.avatar_path) {
      const oldFile = path.join(uploadsDirectory, path.basename(user.avatar_path));
      fs.unlink(oldFile, () => {});
    }

    const avatarPath = `/uploads/${req.file.filename}`;
    await db.query("UPDATE users SET avatar_path = $1 WHERE id = $2", [avatarPath, userId]);
    res.json({ avatar_path: avatarPath });
  } catch (err) {
    next(err);
  }
});

// Upload Banner (Premium only)
router.post("/upload-banner", isAuthenticated, uploadBanner.single("banner"), async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;

  if (!req.file) return res.status(400).json({ error: "No file uploaded." });

  try {
    const result = await db.query("SELECT is_premium, banner_path FROM users WHERE id = $1", [userId]);
    const user = result.rows[0];
    
    if (!user) return res.status(404).json({ error: "User not found." });
    if (!user.is_premium) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: "Custom banners require Core Flow." });
    }

    if (user.banner_path) {
      const oldFile = path.join(uploadsDirectory, path.basename(user.banner_path));
      fs.unlink(oldFile, () => {});
    }

    const bannerPath = `/uploads/${req.file.filename}`;
    await db.query("UPDATE users SET banner_path = $1 WHERE id = $2", [bannerPath, userId]);
    res.json({ banner_path: bannerPath });
  } catch (err) {
    next(err);
  }
});

// Remove Banner
router.post("/remove-banner", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;

  try {
    const result = await db.query("SELECT banner_path FROM users WHERE id = $1", [userId]);
    const user = result.rows[0];
    
    if (user && user.banner_path) {
      const oldFile = path.join(uploadsDirectory, path.basename(user.banner_path));
      fs.unlink(oldFile, () => {});
    }
    await db.query("UPDATE users SET banner_path = NULL WHERE id = $1", [userId]);
    res.json({ message: "Banner removed" });
  } catch (err) {
    next(err);
  }
});

// Update Profile Route
router.post("/update-profile", async (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not logged in" });
  
  const { username, display_name, bio } = req.body;
  const db = req.app.locals.db;
  const userId = req.session.userId;

  if (!username) return res.status(400).json({ error: "Username is required" });

  try {
    const query = `UPDATE users SET username = $1, display_name = $2, bio = $3 WHERE id = $4`;
    await db.query(query, [username.toLowerCase(), display_name || "", bio || "", userId]);
    res.json({ message: "Profile updated successfully", user: { username, display_name, bio } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: "Username already taken" });
    }
    next(err);
  }
});

// Search users by username
router.get("/users/search/:query", async (req, res, next) => {
  const db = req.app.locals.db;
  const q = (req.params.query || "").trim();

  if (!q) return res.json([]);

  try {
    const query = `SELECT id, username, display_name, emoji, bio, created_at FROM users WHERE username ILIKE $1 OR display_name ILIKE $2 LIMIT 20`;
    const result = await db.query(query, [`%${q}%`, `%${q}%`]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Activate Core Flow (Premium)
router.post("/activate-premium", isAuthenticated, async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  
  try {
    const result = await db.query("UPDATE users SET is_premium = 1 WHERE id = $1", [userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found. Activation failed." });
    }

    res.json({ message: "Welcome to Core Flow! Premium features activated.", is_premium: 1 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
