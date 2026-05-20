const express = require("express");
const webpush = require("web-push");
const router = express.Router();

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

function hasVapidConfig() {
  return Boolean(vapidPublicKey && vapidPrivateKey);
}

router.get("/public-key", (req, res) => {
  if (!vapidPublicKey) {
    return res.status(500).json({ error: "Missing VAPID_PUBLIC_KEY." });
  }
  res.json({ publicKey: vapidPublicKey });
});

router.post("/subscribe", async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const subscription = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription payload." });
    }

    await db.query(
      `
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (endpoint)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        updated_at = NOW()
      `,
      [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/test", async (req, res, next) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!hasVapidConfig()) return res.status(500).json({ error: "Push notifications are not configured." });

  try {
    const result = await db.query(
      "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
      [userId]
    );

    const payload = JSON.stringify({
      title: "Core",
      body: "This is a test push notification.",
      url: "/",
      icon: "/assets/CoreLogo.png",
      badge: "/assets/CoreLogo.png"
    });

    await Promise.all(result.rows.map((row) =>
      webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload
      ).catch(async (err) => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [row.endpoint]);
        } else {
          throw err;
        }
      })
    ));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

async function sendMessagePush(db, userId, payload) {
  if (!hasVapidConfig()) return;
  const result = await db.query(
    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
    [userId]
  );

  await Promise.all(result.rows.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(payload)
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [row.endpoint]);
      } else {
        console.error("Push send error:", err.message);
      }
    }
  }));
}

module.exports = { router, sendMessagePush };
