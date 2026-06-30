import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
];

for (const file of envCandidates) {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file, override: false });
  }
}

const rootDir = path.resolve(process.cwd(), "backend");

function parseCorsOrigins(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

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
  emailProvider: String(process.env.EMAIL_PROVIDER || "auto").toLowerCase(),
  resendApiKey: process.env.RESEND_API_KEY || "",
  resendFrom: process.env.RESEND_FROM || process.env.SMTP_FROM || "nao-responda@consorcio.mg.gov.br",
  brevoApiKey: process.env.BREVO_API_KEY || "",
  brevoFrom: process.env.BREVO_FROM || process.env.SMTP_FROM || "nao-responda@consorcio.mg.gov.br",
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS || process.env.APP_BASE_URL || "http://localhost:3000"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  cookieSecret: process.env.COOKIE_SECRET || "change-me-cookie-secret",
  csrfSecret: process.env.CSRF_SECRET || "change-me-csrf-secret",
  isProduction: process.env.NODE_ENV === "production",
  cookieSettings: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 12 * 60 * 60 * 1000,
  },
};

function assertSecureConfig() {
  const isProd = process.env.NODE_ENV === "production";
  const problems = [];

  if (config.jwtSecret === "change-me-super-secret") {
    problems.push("JWT_SECRET em valor padrão inseguro");
  }
  if (config.auditSecret === "change-me-audit-secret") {
    problems.push("AUDIT_SECRET em valor padrão inseguro");
  }
  if (config.seedAdminPassword === "Admin@123") {
    problems.push("SEED_ADMIN_PASSWORD em valor padrão inseguro");
  }
  if (isProd && config.cookieSecret === "change-me-cookie-secret") {
    problems.push("COOKIE_SECRET em valor padrão inseguro");
  }
  if (isProd && config.csrfSecret === "change-me-csrf-secret") {
    problems.push("CSRF_SECRET em valor padrão inseguro");
  }

  if (!isProd || problems.length === 0) return;

  throw new Error(`Configuração insegura para produção: ${problems.join("; ")}`);
}

assertSecureConfig();
