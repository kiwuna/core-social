const express = require("express");
const path = require("path");
require("dotenv").config();
const session = require("express-session");
const PgStore = require("connect-pg-simple")(session);
const db = require("./db/database");
const postsRouter = require("./routes/posts");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const feedRouter = require("./routes/feed");
const notificationsRouter = require("./routes/notifications");
const syncRouter = require("./routes/sync");
const adminRouter = require("./routes/admin");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.locals.db = db;

// Session configuration
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
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
      httpOnly: true, // Security: prevents client-side JS from reading the cookie
      sameSite: "lax",
    },
  })
);

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "client")));
// No local uploads needed, everything is on Cloudinary

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/create-checkout-session', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');
  
  // Create a mock or use actual Stripe API to create session
  // Usually this uses stripe.prices.list, but for example purposes with lookup_key
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).send("Stripe is not configured. Please add STRIPE_SECRET_KEY to your server/.env file.");
    }

    const domain = `${req.protocol}://${req.get('host')}`;
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product: 'prod_UW4qnAXZRwAB0J', // Using your specific Product ID
            unit_amount: 499,
            recurring: {
              interval: 'month',
            },
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
    // We update the DB to make the user premium
    await db.query("UPDATE users SET is_premium = 1 WHERE id = $1", [req.session.userId]);
  } catch (err) {
    console.error("Error updating user premium status:", err);
  }
  // Redirect back to user's profile
  res.redirect(`/?checkout=success`);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "admin.html"));
});

app.use("/auth", authRouter);
app.use("/posts", postsRouter);
app.use("/users", usersRouter);
app.use("/feed", feedRouter);
app.use("/notifications", notificationsRouter);
app.use("/api", syncRouter);
app.use("/api/admin", adminRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
