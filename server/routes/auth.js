const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

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
    res.json({ message: "Logged in successfully", user: { id: user.id, username: user.username, emoji: user.emoji, bio: user.bio } });
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

// Update Profile Route
router.post("/update-profile", (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Not logged in" });
  
  const { username, bio } = req.body;
  const db = req.app.locals.db;
  const userId = req.session.userId;

  if (!username) return res.status(400).json({ error: "Username is required" });

  const query = `UPDATE users SET username = ?, bio = ? WHERE id = ?`;
  db.run(query, [username.toLowerCase(), bio || "", userId], function(err) {
    if (err) {
      if (err.message.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: "Username already taken" });
      }
      return next(err);
    }
    res.json({ message: "Profile updated successfully" });
  });
});

// Search users by username
router.get("/users/search/:query", (req, res, next) => {
  const db = req.app.locals.db;
  const q = (req.params.query || "").trim();

  if (!q) return res.json([]);

  const query = `SELECT id, username, emoji, bio, created_at FROM users WHERE username LIKE ? LIMIT 20`;
  db.all(query, [`%${q}%`], (err, rows) => {
    if (err) return next(err);
    res.json(rows);
  });
});

module.exports = router;
