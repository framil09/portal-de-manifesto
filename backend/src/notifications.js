import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import { config } from "./config.js";
import { getDb } from "./db.js";

let transporter = null;

function canSendEmail() {
  return Boolean(config.smtpHost && config.smtpUser && config.smtpPass);
}

function getTransporter() {
  if (!canSendEmail()) return null;
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

export async function sendNotification({ to, subject, html }) {
  const db = getDb();
  const id = uuidv4();
  const ts = new Date().toISOString();

  try {
    const tx = getTransporter();
    if (!tx) {
      await db.run(
        `INSERT INTO notifications (id, ts, to_email, subject, status, error)
         VALUES (?, ?, ?, ?, 'skipped', 'SMTP not configured')`,
        [id, ts, to, subject]
      );
      return { sent: false, reason: "SMTP not configured" };
    }

    await tx.sendMail({
      from: config.smtpFrom,
      to,
      subject,
      html,
    });

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
