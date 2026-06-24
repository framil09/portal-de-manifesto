import path from "node:path";

const rootDir = path.resolve(process.cwd(), "backend");

export const config = {
  port: Number(process.env.API_PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "change-me-super-secret",
  auditSecret: process.env.AUDIT_SECRET || "change-me-audit-secret",
  dbFile: process.env.DB_FILE || path.join(rootDir, "data.sqlite"),
  uploadsDir: process.env.UPLOADS_DIR || path.join(rootDir, "uploads"),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || "admin@consorcio.mg.gov.br",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "Admin@123",
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS || 5),
  loginLockMinutes: Number(process.env.LOGIN_LOCK_MINUTES || 15),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 200),
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || "nao-responda@consorcio.mg.gov.br",
};
