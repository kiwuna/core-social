const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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

router.get("/", (req, res, next) => {
  const db = req.app.locals.db;
  const query = `
    SELECT id, content, likes, image_path, created_at
    FROM posts
    ORDER BY id DESC
  `;

  db.all(query, [], (error, rows) => {
    if (error) {
      return next(error);
    }

    res.json(rows);
  });
});

router.post("/", upload.single("image"), (req, res, next) => {
  const db = req.app.locals.db;
  const rawContent = typeof req.body?.content === "string" ? req.body.content : "";
  const content = rawContent.trim();
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  if (!content && !imagePath) {
    return res.status(400).json({ error: "Post must contain text or an image." });
  }

  if (content.length > MAX_POST_LENGTH) {
    return res.status(400).json({
      error: `Post content must be ${MAX_POST_LENGTH} characters or less.`
    });
  }

  const query = `INSERT INTO posts (content, image_path) VALUES (?, ?)`;
  db.run(query, [content, imagePath], function onInsert(error) {
    if (error) {
      return next(error);
    }

    const createdPost = {
      id: this.lastID,
      content,
      likes: 0,
      image_path: imagePath,
      created_at: new Date().toISOString()
    };

    res.status(201).json(createdPost);
  });
});

router.post("/:id/like", (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id." });
  }

  const updateQuery = `
    UPDATE posts
    SET likes = likes + 1
    WHERE id = ?
  `;

  db.run(updateQuery, [postId], function onLike(error) {
    if (error) {
      return next(error);
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Post not found." });
    }

    db.get(`SELECT likes FROM posts WHERE id = ?`, [postId], (getError, row) => {
      if (getError) {
        return next(getError);
      }
      if (!row) {
        return res.status(404).json({ error: "Post not found." });
      }

      res.json({ id: postId, likes: row.likes });
    });
  });
});

router.delete("/:id", (req, res, next) => {
  const db = req.app.locals.db;
  const postId = Number(req.params.id);

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id." });
  }

  db.get(`SELECT image_path FROM posts WHERE id = ?`, [postId], (getError, row) => {
    if (getError) {
      return next(getError);
    }

    if (!row) {
      return res.status(404).json({ error: "Post not found." });
    }

    db.run(`DELETE FROM posts WHERE id = ?`, [postId], function onDelete(error) {
      if (error) {
        return next(error);
      }

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
