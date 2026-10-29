const express = require('express');
require('dotenv').config();
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const db = require('../server/db/database');
const postsRouter = require('../server/routes/posts');
const authRouter = require('../server/routes/auth');
const usersRouter = require('../server/routes/users');
const feedRouter = require('../server/routes/feed');
const notificationsRouter = require('../server/routes/notifications');
const syncRouter = require('../server/routes/sync');
const adminRouter = require('../server/routes/admin');
const messagesRouter = require('../server/routes/messages');
const { router: pushRouter } = require('../server/routes/push');
const errorHandler = require('../server/middleware/errorHandler');

const app = express();

app.locals.db = db;

app.use(
  session({
    store: new PgStore({
      pool: db,
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

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/create-checkout-session', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).send("Stripe is not configured.");
    }
    const domain = `${req.protocol}://${req.get('host')}`;
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product: 'prod_UW4qnAXZRwAB0J',
            unit_amount: 499,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${domain}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domain}/`,
    });
    res.redirect(303, session.url);
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).send("Internal Server Error: " + err.message);
  }
});

app.get('/checkout-success', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');
  try {
    await db.query("UPDATE users SET is_premium = 1 WHERE id = $1", [req.session.userId]);
  } catch (err) {
    console.error("Error updating user premium status:", err);
  }
  res.redirect(`/?checkout=success`);
});

app.use("/auth", authRouter);
app.use("/posts", postsRouter);
app.use("/users", usersRouter);
app.use("/feed", feedRouter);
app.use("/notifications", notificationsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api", syncRouter);
app.use("/api/push", pushRouter);
app.use("/api/admin", adminRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

module.exports = app;

