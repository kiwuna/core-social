const nodemailer = require("nodemailer");
require("dotenv").config();

// changed to 587 + secure: false to force IPv4 and bypass render's network block 🥀
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false, // forces connection through cloud routing 💀
    minVersion: 'TLSv1.2'
  },
  debug: true,
  logger: true 
});

/**
 * Generic function to send an email
 * Wrapped in try/catch to completely kill the 500 server crashes ✌️☹️
 */
async function sendEmail(to, subject, html) {
  const mailOptions = {
    from: `"CORE" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: subject,
    html: html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("📬 Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ SMTP Error caught safely:", error.message);
    // return false instead of throwing so the route doesn't crash 🥀
    return null; 
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
        &copy; ${new Date().getFullYear()} CORE Social. Built for the future.
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
        &copy; ${new Date().getFullYear()} CORE Social. Built for the future.
      </div>
    </div>
  `;

  return sendEmail(to, subject, html);
}

module.exports = { sendEmail, sendVerificationEmail, sendUnlinkEmail };