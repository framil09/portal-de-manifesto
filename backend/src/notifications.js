import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import { config } from "./config.js";
import { getDb } from "./db.js";

let transporter = null;

function canSendBySmtp() {
  return Boolean(config.smtpHost && config.smtpUser && config.smtpPass);
}

function canSendByResend() {
  return Boolean(config.resendApiKey);
}

function canSendByBrevo() {
  return Boolean(config.brevoApiKey);
}

function detectProvider() {
  if (config.emailProvider === "resend") return canSendByResend() ? "resend" : null;
  if (config.emailProvider === "brevo") return canSendByBrevo() ? "brevo" : null;
  if (config.emailProvider === "smtp") return canSendBySmtp() ? "smtp" : null;
  if (canSendByResend()) return "resend";
  if (canSendByBrevo()) return "brevo";
  if (canSendBySmtp()) return "smtp";
  return null;
}

function getTransporter() {
  if (!canSendBySmtp()) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
  return transporter;
}

async function sendByResend({ to, subject, html }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: config.resendFrom,
      to: [to],
      subject,
      html,
    }),
  });

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const reason = data?.message || data?.error || `Resend HTTP ${response.status}`;
    throw new Error(reason);
  }
}

async function sendByBrevo({ to, subject, html }) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": config.brevoApiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: config.brevoFrom },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const reason = data?.message || data?.code || `Brevo HTTP ${response.status}`;
    throw new Error(reason);
  }
}

export async function sendNotification({ to, subject, html }) {
  const db = getDb();
  const id = uuidv4();
  const ts = new Date().toISOString();

  try {
    const provider = detectProvider();
    if (!provider) {
      await db.run(
        `INSERT INTO notifications (id, ts, to_email, subject, status, error)
         VALUES (?, ?, ?, ?, 'skipped', 'No email provider configured')`,
        [id, ts, to, subject]
      );
      return {
        sent: false,
        reason: "No email provider configured (configure RESEND_API_KEY, BREVO_API_KEY or SMTP)",
      };
    }

    if (provider === "resend") {
      await sendByResend({ to, subject, html });
    } else if (provider === "brevo") {
      await sendByBrevo({ to, subject, html });
    } else {
      const tx = getTransporter();
      if (!tx) throw new Error("SMTP transporter unavailable");
      await tx.sendMail({
        from: config.smtpFrom,
        to,
        subject,
        html,
      });
    }

    await db.run(
      `INSERT INTO notifications (id, ts, to_email, subject, status, error)
       VALUES (?, ?, ?, ?, 'sent', NULL)`,
      [id, ts, to, subject]
    );

    return { sent: true };
  } catch (err) {
    await db.run(
      `INSERT INTO notifications (id, ts, to_email, subject, status, error)
       VALUES (?, ?, ?, ?, 'error', ?)`,
      [id, ts, to, subject, String(err.message || err)]
    );
    return { sent: false, reason: String(err.message || err) };
  }
}
