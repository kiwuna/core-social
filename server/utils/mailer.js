require("dotenv").config();

const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS) || 10000;
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

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

async function sendEmail(to, subject, html) {
  if (!SENDGRID_API_KEY) {
    throw new Error("Missing HTTPS mail credentials. Set SENDGRID_API_KEY in environment variables.");
  }

  if (!EMAIL_FROM) {
    throw new Error("Missing EMAIL_FROM or EMAIL_USER. Set a verified sender address in environment variables.");
  }

  const payload = {
    personalizations: [
      {
        to: [{ email: to }],
        subject
      }
    ],
    from: { email: EMAIL_FROM },
    content: [
      {
        type: "text/html",
        value: html
      }
    ]
  };

  try {
    const response = await withTimeout(
      fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }),
      EMAIL_TIMEOUT_MS,
      "HTTPS email send"
    );

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      const error = new Error(`HTTPS email send failed with status ${response.status}${responseText ? `: ${responseText}` : ""}`);
      error.responseCode = response.status;
      error.response = responseText;
      throw error;
    }

    console.log("Email sent successfully via HTTPS mail API:", response.status);
    return { statusCode: response.status };
  } catch (error) {
    const detailParts = [error.message];
    if (error.responseCode) {
      console.error("Email send response code:", error.responseCode);
      detailParts.push(`code=${error.responseCode}`);
    }
    if (error.response) {
      console.error("Email send response:", error.response);
      detailParts.push(String(error.response));
    }
    console.error("Email send error:", detailParts.join(" | "));
    throw error;
  }
}

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
