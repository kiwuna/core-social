const express = require('express');
require('dotenv').config();
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const { Pool } = require('pg');

// Database setup
const enableSSL = process.env.DATABASE_SSL === 'true';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: enableSSL ? { rejectUnauthorized: false } : false
});

const app = express();

app.locals.db = pool;

app.use(
  session({
    store: new PgStore({
      pool: pool,
      tableName: "session",
    }),
    secret: process.env.SESSION_SECRET || "core-social-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = app;
