const express = require("express");
const path = require("path");
require("dotenv").config();
const db = require("./db/database");
const postsRouter = require("./routes/posts");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.locals.db = db;

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "..", "client")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

app.use("/posts", postsRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
