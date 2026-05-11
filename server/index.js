const express = require("express");
const path = require("path");
require("dotenv").config();
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const db = require("./db/database");
const postsRouter = require("./routes/posts");
const authRouter = require("./routes/auth");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.locals.db = db;

// Session configuration
app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: path.join(__dirname, "..", "database"),
    }),
    secret: process.env.SESSION_SECRET || "core-social-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
      httpOnly: true, // Security: prevents client-side JS from reading the cookie
      sameSite: "lax",
    },
  })
);

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "..", "client")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

app.use("/auth", authRouter);
app.use("/posts", postsRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
