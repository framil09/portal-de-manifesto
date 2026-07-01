import nodemailer from "nodemailer";
import fs from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { config } from "./config.js";
import { getDb } from "./db.js";

let transporter = null;
let sendmailTransporter = null;

function canSendBySmtp() {
  if (!config.smtpHost || !config.smtpUser) return false;
  if (config.smtpAuthType === "oauth2") {
    return Boolean(
      config.smtpOAuthClientId &&
      config.smtpOAuthClientSecret &&
      config.smtpOAuthRefreshToken
    );
  }
  return Boolean(config.smtpPass);
}

function smtpConfigHint() {
  if (config.smtpAuthType === "oauth2") {
    return "SMTP OAuth2 não configurado (defina SMTP_HOST, SMTP_USER, SMTP_OAUTH_CLIENT_ID, SMTP_OAUTH_CLIENT_SECRET e SMTP_OAUTH_REFRESH_TOKEN)";
  }
  return "SMTP não configurado (defina SMTP_HOST, SMTP_USER e SMTP_PASS)";
}

function canSendByResend() {
  return Boolean(config.resendApiKey);
}

function canSendByBrevo() {
  return Boolean(config.brevoApiKey);
}

function resolveSendmailPath() {
  const candidates = [
    process.env.SENDMAIL_PATH,
    "/usr/sbin/sendmail",
    "/usr/bin/sendmail",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function canSendBySendmail() {
  return Boolean(resolveSendmailPath());
}

function detectProvider() {
  if (config.emailProvider === "sendmail") return canSendBySendmail() ? "sendmail" : null;
  if (config.emailProvider === "smtp") return canSendBySmtp() ? "smtp" : null;
  if (config.emailProvider === "resend") return canSendByResend() ? "resend" : null;
  if (config.emailProvider === "brevo") return canSendByBrevo() ? "brevo" : null;
  if (config.emailProvider === "auto") {
    if (canSendBySmtp()) return "smtp";
    if (canSendBySendmail()) return "sendmail";
    if (canSendByBrevo()) return "brevo";
    if (canSendByResend()) return "resend";
    return null;
  }

  // Compatibilidade: se algum transporte não foi explicitamente escolhido,
  // mantém a ordem local -> SMTP -> provedores externos.
  if (canSendBySmtp()) return "smtp";
  if (canSendBySendmail()) return "sendmail";
  if (canSendByBrevo()) return "brevo";
  if (canSendByResend()) return "resend";
  return null;
}

function getTransporter() {
  if (!canSendBySmtp()) return null;
  if (transporter) return transporter;

  const auth = config.smtpAuthType === "oauth2"
    ? {
        type: "OAuth2",
        user: config.smtpUser,
        clientId: config.smtpOAuthClientId,
        clientSecret: config.smtpOAuthClientSecret,
        refreshToken: config.smtpOAuthRefreshToken,
        accessToken: config.smtpOAuthAccessToken || undefined,
      }
    : {
        user: config.smtpUser,
        pass: config.smtpPass,
      };

  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth,
  });
  return transporter;
}

function getSendmailTransporter() {
  const path = resolveSendmailPath();
  if (!path) return null;
  if (sendmailTransporter) return sendmailTransporter;

  sendmailTransporter = nodemailer.createTransport({
    sendmail: true,
    newline: "unix",
    path,
  });

  return sendmailTransporter;
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

export async function sendNotification({ to, subject, html, attachments = [] }) {
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
        reason: `No email provider configured (${smtpConfigHint()} ou configure RESEND_API_KEY/BREVO_API_KEY/sendmail)`,
      };
    }

    if (provider === "resend") {
      await sendByResend({ to, subject, html });
    } else if (provider === "brevo") {
      await sendByBrevo({ to, subject, html });
    } else if (provider === "sendmail") {
      const tx = getSendmailTransporter();
      if (!tx) throw new Error("Sendmail transporter unavailable");
      await tx.sendMail({
        from: config.smtpFrom,
        to,
        subject,
        html,
        attachments,
      });
    } else {
      const tx = getTransporter();
      if (!tx) throw new Error("SMTP transporter unavailable");
      await tx.sendMail({
        from: config.smtpFrom,
        to,
        subject,
        html,
        attachments,
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
