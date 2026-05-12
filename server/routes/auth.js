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

    const query = `INSERT INTO users (username, password_hash, emoji) VALUES (?, ?, ?)`;
    db.run(query, [username.toLowerCase(), hash, emoji], function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(400).json({ error: "Username already taken" });
        }
        return next(err);
      }
      
      // Auto-login after signup
      req.session.userId = this.lastID;
      req.session.userEmoji = emoji;
      res.status(201).json({ message: "User created successfully", user: { id: this.lastID, username, emoji } });
    });
  } catch (error) {
    next(error);
  }
});

// Login Route
router.post("/login", (req, res, next) => {
  const { username, password } = req.body;
  const db = req.app.locals.db;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const query = `SELECT * FROM users WHERE username = ?`;
  db.get(query, [username.toLowerCase()], async (err, user) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    req.session.userId = user.id;
    req.session.userEmoji = user.emoji;
    res.json({ message: "Logged in successfully", user: { id: user.id, username: user.username, emoji: user.emoji, bio: user.bio, is_premium: user.is_premium || 0, avatar_path: user.avatar_path || null } });
  });
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
router.get("/me", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const db = req.app.locals.db;
  // Use SELECT * to avoid "no such column" error if migration is still running, 
  // though bio is expected now.
  db.get("SELECT * FROM users WHERE id = ?", [req.session.userId], (err, user) => {
    if (err || !user) return res.status(401).json({ error: "User not found" });
    // Strip password
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser });
  });
});

// Get User by ID
router.get("/users/:id", (req, res, next) => {
  const db = req.app.locals.db;
  const userId = Number(req.params.id);
  db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) return next(err);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser });
  });
});

// Upload Avatar (Premium only)
router.post("/upload-avatar", isAuthenticated, uploadAvatar.single("avatar"), (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;

  if (!req.file) return res.status(400).json({ error: "No file uploaded." });

  // Check if user is premium
  db.get("SELECT is_premium, avatar_path FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) return next(err);
    if (!user) return res.status(404).json({ error: "User not found." });
    if (!user.is_premium) {
      // Delete the uploaded file and reject
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: "Custom avatars require Core Flow." });
    }

    // Delete old avatar if it exists
    if (user.avatar_path) {
      const oldFile = path.join(uploadsDirectory, path.basename(user.avatar_path));
      fs.unlink(oldFile, () => {});
    }

    const avatarPath = `/uploads/${req.file.filename}`;
    db.run("UPDATE users SET avatar_path = ? WHERE id = ?", [avatarPath, userId], (updateErr) => {
      if (updateErr) return next(updateErr);
      res.json({ avatar_path: avatarPath });
    });
  });
});
// Upload Banner (Premium only)
router.post("/upload-banner", isAuthenticated, uploadBanner.single("banner"), (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;

  if (!req.file) return res.status(400).json({ error: "No file uploaded." });

  // Check if user is premium
  db.get("SELECT is_premium, banner_path FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) return next(err);
    if (!user) return res.status(404).json({ error: "User not found." });
    if (!user.is_premium) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: "Custom banners require Core Flow." });
    }

    // Delete old banner
    if (user.banner_path) {
      const oldFile = path.join(uploadsDirectory, path.basename(user.banner_path));
      fs.unlink(oldFile, () => {});
    }

    const bannerPath = `/uploads/${req.file.filename}`;
    db.run("UPDATE users SET banner_path = ? WHERE id = ?", [bannerPath, userId], (updateErr) => {
      if (updateErr) return next(updateErr);
      res.json({ banner_path: bannerPath });
    });
  });
});


// Remove Banner
router.post("/remove-banner", isAuthenticated, (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;

  db.get("SELECT banner_path FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) return next(err);
    if (user && user.banner_path) {
      const oldFile = path.join(uploadsDirectory, path.basename(user.banner_path));
      fs.unlink(oldFile, () => {});
    }
    db.run("UPDATE users SET banner_path = NULL WHERE id = ?", [userId], (updateErr) => {
      if (updateErr) return next(updateErr);
      res.json({ message: "Banner removed" });
    });
  });
});

// Update Profile Route
router.post("/update-profile", (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not logged in" });
  
  const { username, display_name, bio } = req.body;
  const db = req.app.locals.db;
  const userId = req.session.userId;

  if (!username) return res.status(400).json({ error: "Username is required" });

  const query = `UPDATE users SET username = ?, display_name = ?, bio = ? WHERE id = ?`;
  db.run(query, [username.toLowerCase(), display_name || "", bio || "", userId], function(err) {
    if (err) {
      if (err.message.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: "Username already taken" });
      }
      return next(err);
    }
    res.json({ message: "Profile updated successfully", user: { username, display_name, bio } });
  });
});

// Search users by username
router.get("/users/search/:query", (req, res, next) => {
  const db = req.app.locals.db;
  const q = (req.params.query || "").trim();

  if (!q) return res.json([]);

  const query = `SELECT id, username, display_name, emoji, bio, created_at FROM users WHERE username LIKE ? OR display_name LIKE ? LIMIT 20`;
  db.all(query, [`%${q}%`, `%${q}%`], (err, rows) => {
    if (err) return next(err);
    res.json(rows);
  });
});

// Activate Core Flow (Premium)
router.post("/activate-premium", isAuthenticated, (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  
  console.log(`[PREMIUM] Attempting to activate Core Flow for user ID: ${userId}`);

  db.run("UPDATE users SET is_premium = 1 WHERE id = ?", [userId], function(err) {
    if (err) {
      console.error("[PREMIUM] Database error during activation:", err);
      return next(err);
    }
    
    if (this.changes === 0) {
      console.warn(`[PREMIUM] Activation failed: No user found with ID ${userId}`);
      return res.status(404).json({ error: "User not found. Activation failed." });
    }

    console.log(`[PREMIUM] Success! User ${userId} is now premium.`);
    res.json({ message: "Welcome to Core Flow! Premium features activated.", is_premium: 1 });
  });
});

module.exports = router;
