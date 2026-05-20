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
const messagesRouter = require("./routes/messages");
const { router: pushRouter, sendMessagePush } = require("./routes/push");
const errorHandler = require("./middleware/errorHandler");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.locals.db = db;
app.set("trust proxy", 1);

// Map to store connected users: userId -> Set of socket IDs
const userSockets = new Map();

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  socket.on("register", (userId) => {
    // We expect the client to send their userId when they connect
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    socket.userId = userId;
  });

  socket.on("send_message", async (data) => {
    const { sender_id, receiver_id, content } = data;
    try {
      // Save the message to database
      const result = await db.query(
        "INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *",
        [sender_id, receiver_id, content]
      );
      const savedMessage = result.rows[0];

      // Add notification for the message
      await db.query(
        "INSERT INTO notifications (type, recipient_id, sender_id) VALUES ($1, $2, $3)",
        ["message", receiver_id, sender_id]
      );

      // Emit the message back to sender (echo)
      socket.emit("receive_message", savedMessage);

      // Instantly emit to receiver if they are currently online
      if (userSockets.has(receiver_id)) {
        for (const receiverSocketId of userSockets.get(receiver_id)) {
          io.to(receiverSocketId).emit("receive_message", savedMessage);
          io.to(receiverSocketId).emit("new_notification", {
            type: "message",
            sender_id,
            receiver_id
          });
        }
      }

      // Push notification fan-out for offline/mobile users
      try {
        await sendMessagePush(db, receiver_id, {
          title: "New message",
          body: content,
          url: `/messages/${sender_id}`,
          icon: "/assets/CoreLogo.png",
          badge: "/assets/CoreLogo.png"
        });
      } catch (pushErr) {
        console.error("Push notification error:", pushErr.message);
      }
    } catch (err) {
      console.error("Error saving message", err);
    }
  });

  socket.on("disconnect", () => {
    if (socket.userId && userSockets.has(socket.userId)) {
      userSockets.get(socket.userId).delete(socket.id);
      if (userSockets.get(socket.userId).size === 0) {
        userSockets.delete(socket.userId);
      }
    }
    console.log("Client disconnected", socket.id);
  });
});

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
app.use("/api/messages", messagesRouter);
app.use("/api", syncRouter);
app.use("/api/push", pushRouter);

app.use("/api/admin", adminRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
