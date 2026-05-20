const nodemailer = require("nodemailer");
const { Resend } = require("resend");
require("dotenv").config();

const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS) || 10000;
const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const EMAIL_PASS = process.env.EMAIL_PASS;
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.RESEND_API;
const EMAIL_TRANSPORT = (process.env.EMAIL_TRANSPORT || "").toLowerCase();
const EMAIL_PASS_LOOKS_LIKE_RESEND_KEY = typeof EMAIL_PASS === "string" && EMAIL_PASS.startsWith("re_");
const USE_RESEND_API = !!RESEND_API_KEY || EMAIL_TRANSPORT === "resend-api" || EMAIL_PASS_LOOKS_LIKE_RESEND_KEY;

let resendClient = null;
if (USE_RESEND_API) {
  const apiKey = RESEND_API_KEY || (EMAIL_PASS_LOOKS_LIKE_RESEND_KEY ? EMAIL_PASS : null);
  if (apiKey) {
    resendClient = new Resend(apiKey);
  }
}

const smtpTransporter = !USE_RESEND_API && EMAIL_PASS
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.resend.com",
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER || "resend",
        pass: EMAIL_PASS
      }
    })
  : null;

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeout
  ]);
}

/**
 * Generic function to send an email
 */
async function sendEmail(to, subject, html) {
  try {
    if (resendClient) {
      const apiKeySource = RESEND_API_KEY ? "RESEND_API_KEY" : (EMAIL_PASS_LOOKS_LIKE_RESEND_KEY ? "EMAIL_PASS" : "unknown");
      console.log(`Email transport selected: Resend API via ${apiKeySource}`);
      const info = await withTimeout(
        resendClient.emails.send({
          from: EMAIL_FROM,
          to,
          subject,
          html
        }),
        EMAIL_TIMEOUT_MS,
        "Resend API request"
      );
      console.log("Email sent successfully via Resend API:", info.id || "ok");
      return info;
    }

    if (smtpTransporter) {
      console.log("Email transport selected: SMTP fallback");
      const info = await withTimeout(
        smtpTransporter.sendMail({
          from: EMAIL_FROM,
          to,
          subject,
          html
        }),
        EMAIL_TIMEOUT_MS,
        "SMTP email send"
      );
      console.log("Email sent successfully via SMTP:", info.messageId);
      return info;
    }

    throw new Error("No email transport configured. Set RESEND_API_KEY or EMAIL_PASS in environment variables.");
  } catch (error) {
    console.error("Email send error:", error.message);
    throw error;
  }
}

/**
 * Sends a clean, dark-mode CORE themed verification email
 */
async function sendVerificationEmail(to, code) {
  const subject = `Your CORE Sync Code: ${code}`;
  const html = `
    <div style="background: #0b0b0b; color: #ffffff; padding: 40px; font-family: 'Inter', -apple-system, sans-serif; border-radius: 20px; max-width: 500px; margin: 20px auto; border: 1px solid #222; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
      <div style="margin-bottom: 30px;">
        <span style="font-size: 28px; font-weight: 900; letter-spacing: -1.5px; background: linear-gradient(45deg, #fff, #888); -webkit-background-clip: text; color: transparent;">CORE</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #fff;">Verification Code</h2>
      <p style="font-size: 15px; color: #a0a0a0; line-height: 1.6; margin-bottom: 32px;">
        Use the 6-digit code below to sync your Gmail account with CORE. This code will expire shortly.
      </p>
      <div style="background: #151515; border: 1px solid #333; border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 32px;">
        <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ffffff; font-family: monospace;">${code}</span>
      </div>
      <p style="font-size: 13px; color: #555; line-height: 1.5; margin-top: 40px; border-top: 1px solid #222; padding-top: 24px;">
        If you did not request this code, please ignore this email or contact support if you have concerns.
      </p>
      <div style="margin-top: 24px; font-size: 12px; color: #444;">
        &copy; 2026 CORE Social. Built for the future.
      </div>
    </div>
  `;

  return sendEmail(to, subject, html);
}

/**
 * Sends a clean, dark-mode CORE themed unlink email
 */
async function sendUnlinkEmail(to, code) {
  const subject = `Your CORE Unlink Code: ${code}`;
  const html = `
    <div style="background: #0b0b0b; color: #ffffff; padding: 40px; font-family: 'Inter', -apple-system, sans-serif; border-radius: 20px; max-width: 500px; margin: 20px auto; border: 1px solid #222; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
      <div style="margin-bottom: 30px;">
        <span style="font-size: 28px; font-weight: 900; letter-spacing: -1.5px; background: linear-gradient(45deg, #fff, #888); -webkit-background-clip: text; color: transparent;">CORE</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #ef4444;">Unlink Verification</h2>
      <p style="font-size: 15px; color: #a0a0a0; line-height: 1.6; margin-bottom: 32px;">
        Use the 6-digit code below to confirm unlinking your Gmail account from CORE. Unlinking will remove your Premium badge and verified status.
      </p>
      <div style="background: #151515; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 32px;">
        <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ef4444; font-family: monospace;">${code}</span>
      </div>
      <p style="font-size: 13px; color: #555; line-height: 1.5; margin-top: 40px; border-top: 1px solid #222; padding-top: 24px;">
        If you did not request this unlink code, please secure your account immediately.
      </p>
      <div style="margin-top: 24px; font-size: 12px; color: #444;">
        &copy; 2026 CORE Social. Built for the future.
      </div>
    </div>
  `;

  return sendEmail(to, subject, html);
}

module.exports = { sendEmail, sendVerificationEmail, sendUnlinkEmail };
