import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { config } from "./config.js";
import { initDb, getDb } from "./db.js";
import { appendAuditLog, verifyAuditEntry } from "./audit.js";
import { authRequired, login, signToken, generateCsrfToken } from "./auth.js";
import { sendNotification } from "./notifications.js";

const app = express();
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (config.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Origem não permitida por CORS"));
    },
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json({ limit: "4mb" }));
app.use(cookieParser(config.cookieSecret));
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições. Tente novamente em instantes." },
  })
);

fs.mkdirSync(config.uploadsDir, { recursive: true });

const STATUS_VALUES = ["rascunho", "revisao", "envio", "assinaturas", "concluido"];

const PERMISSIONS = {
  "users:create": ["admin"],
  "municipios:read": ["admin", "juridico", "operador", "auditor"],
  "municipios:write": ["admin", "juridico", "operador"],
  "processos:read": ["admin", "juridico", "operador", "auditor"],
  "processos:create": ["admin", "juridico", "operador"],
  "processos:update": ["admin", "juridico", "operador"],
  "documentos:read": ["admin", "juridico", "operador", "auditor"],
  "documentos:upload": ["admin", "juridico", "operador"],
  "documentos:download": ["admin", "juridico", "operador", "auditor"],
  "auditoria:read": ["admin", "juridico", "auditor"],
  "dashboard:read": ["admin", "juridico", "operador", "auditor"],
  "alerts:read": ["admin", "juridico", "operador", "auditor"],
  "alerts:notify": ["admin", "juridico", "operador"],
  "ai:write": ["admin", "juridico", "operador", "auditor"],
};

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Não autenticado" });
    const allowed = PERMISSIONS[permission] || [];
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Sem permissão para esta ação" });
    }
    return next();
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const processoId = req.params.id;
    const dir = path.join(config.uploadsDir, processoId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
});

function checksumFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function parsePeriod(query) {
  const { from, to } = query;
  const parseDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  };

  const fromIso = parseDate(from);
  const toIso = parseDate(to);
  const invalid = (from && !fromIso) || (to && !toIso);
  return { fromIso, toIso, invalid };
}

function defaultSignatureDocumentHtml() {
  return [
    `<p><strong>Assunto:</strong> Manifestação de interesse para celebração de parceria institucional.</p>`,
    `<p>O Consórcio Intermunicipal manifesta interesse na formalização de parceria com este Município, para execução de ações conjuntas de interesse público, observando legalidade, impessoalidade, moralidade, publicidade e eficiência.</p>`,
    `<h3>1. Objeto</h3>`,
    `<p>Estabelecer cooperação técnica e institucional para planejamento, execução e monitoramento de iniciativas de fortalecimento da gestão municipal.</p>`,
    `<h3>2. Justificativa</h3>`,
    `<p>A proposta visa ampliar a capacidade de resposta do poder público local, com economicidade e integração regional.</p>`,
    `<h3>3. Vigência</h3>`,
    `<p>Vigência inicial de 90 dias, contados da assinatura.</p>`,
    `<h3>4. Assinatura</h3>`,
    `<p>Ao clicar no link de assinatura, serão registrados data/hora, geolocalização, IP e dispositivo.</p>`,
    `<p style="margin-top:20px">[Cidade], [data].</p>`,
  ].join("");
}

function computeDocumentHash(documentoHtml) {
  return crypto.createHash("sha256").update(String(documentoHtml || "")).digest("hex");
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtpCode(code, token) {
  return crypto.createHmac("sha256", config.auditSecret).update(`${token}|${code}`).digest("hex");
}

function generateTsaToken({ token, documentHash, signedAt, tsaUtc, source }) {
  return crypto
    .createHmac("sha256", config.auditSecret)
    .update([token, documentHash || "-", signedAt || "-", tsaUtc || "-", source || "-"].join("|"))
    .digest("hex");
}

async function getTrustedTimestampUtc() {
  const providers = [
    {
      source: "worldtimeapi",
      url: "https://worldtimeapi.org/api/timezone/Etc/UTC",
      read: (payload) => payload?.utc_datetime,
    },
    {
      source: "timeapiio",
      url: "https://timeapi.io/api/Time/current/zone?timeZone=UTC",
      read: (payload) => payload?.dateTime,
    },
  ];

  for (const provider of providers) {
    try {
      const res = await fetch(provider.url, { method: "GET" });
      if (!res.ok) continue;
      const payload = await res.json();
      const raw = provider.read(payload);
      if (!raw) continue;
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) continue;
      return { utc: parsed.toISOString(), source: provider.source };
    } catch {
      // tenta próximo provedor
    }
  }

  return { utc: new Date().toISOString(), source: "local-fallback" };
}

const TIMBRADO_HEADER_CID = "timbrado-header";
const TIMBRADO_FOOTER_CID = "timbrado-footer";

function resolveTimbradoFile(fileName) {
  const candidates = [
    path.resolve(process.cwd(), "public", "timbrado", fileName),
    path.resolve(process.cwd(), "..", "public", "timbrado", fileName),
    path.resolve(process.cwd(), "backend", "public", "timbrado", fileName),
  ];
  return candidates.find((filePath) => fs.existsSync(filePath)) || null;
}

function getTimbradoEmailAttachments() {
  const headerPath = resolveTimbradoFile("header.png");
  const footerPath = resolveTimbradoFile("footer.png");
  const attachments = [];

  if (headerPath) {
    attachments.push({
      filename: "header.png",
      path: headerPath,
      cid: TIMBRADO_HEADER_CID,
    });
  }

  if (footerPath) {
    attachments.push({
      filename: "footer.png",
      path: footerPath,
      cid: TIMBRADO_FOOTER_CID,
    });
  }

  return attachments;
}

function buildSignatureEmailHtml({ municipio, linkAssinatura, documentoHtml }) {
  const headerSrc = `cid:${TIMBRADO_HEADER_CID}`;
  const footerSrc = `cid:${TIMBRADO_FOOTER_CID}`;

  const linkBlock = linkAssinatura
    ? `
      <div style="margin:16px 0 18px;padding:12px 14px;background:#f2f6fb;border:1px solid #d8e3ef;border-radius:8px;">
        <p style="margin:0 0 8px;font-size:13px;color:#1f2937;"><strong>Ação necessária:</strong> clique no botão abaixo para assinar eletronicamente.</p>
        <p style="margin:0;"><a href="${linkAssinatura}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 14px;border-radius:6px;background:#0f4c81;color:#ffffff;text-decoration:none;font-weight:600;">Assinar documento</a></p>
      </div>
    `
    : "";

  return `
    <div style="font-family:Segoe UI, Arial, sans-serif;background:#eef3f9;padding:20px;color:#1f2937;">
      <div style="max-width:860px;margin:0 auto;background:#ffffff;border:1px solid #d8e3ef;border-radius:10px;overflow:hidden;">
        <div style="padding:0;background:#ffffff;border-bottom:1px solid #e5edf5;">
          <img src="${headerSrc}" alt="Timbrado institucional" style="display:block;width:100%;max-height:130px;object-fit:cover;"/>
        </div>

        <div style="padding:22px 24px 16px;line-height:1.6;">
          <h2 style="margin:0 0 10px;font-size:20px;color:#0f4c81;">Manifestação de Interesse para Assinatura</h2>
          <p style="margin:0 0 8px;">Prezado(a),</p>
          <p style="margin:0 0 8px;">Este e-mail contém o documento completo para análise e assinatura eletrônica.</p>
          <p style="margin:0 0 6px;"><strong>Município:</strong> ${municipio}</p>
          <p style="margin:0 0 4px;"><strong>Emissão:</strong> ${new Date().toLocaleString("pt-BR")}</p>
          ${linkBlock}

          <div style="margin-top:16px;padding:16px;border:1px solid #d8e3ef;border-radius:8px;background:#fcfdff;">
            <p style="margin:0 0 10px;font-size:13px;color:#4b5563;"><strong>Documento na íntegra</strong></p>
            ${documentoHtml}
          </div>
        </div>

        <div style="padding:0;border-top:1px solid #e5edf5;background:#ffffff;">
          <img src="${footerSrc}" alt="Rodapé institucional" style="display:block;width:100%;max-height:95px;object-fit:cover;"/>
        </div>
      </div>
    </div>
  `;
}

function extractTokenFromSignatureLink(link) {
  if (!link || typeof link !== "string") return null;
  try {
    const parsed = new URL(link);
    const hash = String(parsed.hash || "");
    const hashMatch = hash.match(/^#\/assinar\/([^/?#]+)/i);
    if (hashMatch?.[1]) return decodeURIComponent(hashMatch[1]);
    const pathMatch = String(parsed.pathname || "").match(/\/assinar\/([^/?#]+)/i);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
    return null;
  } catch {
    return null;
  }
}

function loginAttemptKey(ip, email) {
  return `${ip || "-"}|${(email || "").toLowerCase().trim()}`;
}

function getRequestIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedIp =
    typeof forwardedFor === "string" && forwardedFor.trim()
      ? forwardedFor.split(",")[0].trim()
      : null;
  return forwardedIp || req.ip || req.socket?.remoteAddress || null;
}

function getRequestDevice(req, clientDevice) {
  const userAgent = String(req.headers["user-agent"] || "").trim();
  const normalizedClientDevice = String(clientDevice || "").trim();
  return [normalizedClientDevice, userAgent].filter(Boolean).join(" | ") || null;
}

function buildSignatureHash({ token, signedAt, ip, device, lat, lon }) {
  return crypto
    .createHmac("sha256", config.auditSecret)
    .update([token, signedAt || "-", ip || "-", device || "-", lat ?? "-", lon ?? "-"].join("|"))
    .digest("hex");
}

async function getLoginAttemptState(ip, email) {
  const db = getDb();
  const key = loginAttemptKey(ip, email);
  const row = await db.get("SELECT * FROM login_attempts WHERE key = ?", [key]);
  if (!row) return { key, fail_count: 0, locked_until: null };
  return row;
}

async function registerLoginFailure(ip, email) {
  const db = getDb();
  const key = loginAttemptKey(ip, email);
  const state = await getLoginAttemptState(ip, email);
  const failCount = Number(state.fail_count || 0) + 1;
  const lock = failCount >= config.loginMaxAttempts
    ? new Date(Date.now() + config.loginLockMinutes * 60000).toISOString()
    : null;

  await db.run(
    `INSERT INTO login_attempts (key, fail_count, last_failed_at, locked_until)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       fail_count = excluded.fail_count,
       last_failed_at = excluded.last_failed_at,
       locked_until = excluded.locked_until`,
    [key, failCount, new Date().toISOString(), lock]
  );

  return { failCount, lockedUntil: lock };
}

async function clearLoginFailures(ip, email) {
  const db = getDb();
  await db.run("DELETE FROM login_attempts WHERE key = ?", [loginAttemptKey(ip, email)]);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "manifestacao-backend" });
});

app.get("/api/client-info", (req, res) => {
  const ip = getRequestIp(req);
  const device = String(req.headers["user-agent"] || "");
  res.json({ ip, device });
});

app.get("/api/csrf-token", (req, res) => {
  const token = generateCsrfToken();
  const hmac = crypto.createHmac("sha256", config.csrfSecret).update(token).digest("hex");
  res.cookie("x-csrf-token", hmac, config.cookieSettings);
  return res.json({ token });
});

app.post("/api/auth/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });

  const attemptState = await getLoginAttemptState(req.ip, parsed.data.email);
  if (attemptState.locked_until && new Date(attemptState.locked_until).getTime() > Date.now()) {
    return res.status(429).json({
      error: "Conta temporariamente bloqueada por excesso de tentativas",
      lockedUntil: attemptState.locked_until,
    });
  }

  const user = await login(parsed.data.email, parsed.data.password);
  if (!user) {
    const failure = await registerLoginFailure(req.ip, parsed.data.email);
    await appendAuditLog({
      actor: null,
      action: "auth.login.failed",
      resourceType: "auth",
      payload: { ip: req.ip, email: parsed.data.email, failCount: failure.failCount },
    });
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  await clearLoginFailures(req.ip, parsed.data.email);

  const token = signToken(user);
  await appendAuditLog({
    actor: user,
    action: "auth.login",
    resourceType: "auth",
    payload: { ip: req.ip },
  });

  res.cookie("auth_token", token, config.cookieSettings);
  return res.json({ token, user, message: "Autenticado com sucesso. Token no cookie HttpOnly." });
});

app.post("/api/auth/logout", authRequired, async (req, res) => {
  await appendAuditLog({
    actor: req.user,
    action: "auth.logout",
    resourceType: "auth",
    payload: {},
  });
  res.clearCookie("auth_token", config.cookieSettings);
  return res.json({ message: "Desconectado com sucesso" });
});

app.post("/api/auth/me", authRequired, async (req, res) => {
  return res.json({ user: req.user });
});

app.post("/api/ai/redigir", authRequired, requirePermission("ai:write"), async (req, res) => {
  const schema = z.object({
    input: z.string().min(3).max(4000),
    docContext: z.string().max(3000).optional(),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(4000),
        })
      )
      .max(12)
      .optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });

  if (!config.anthropicApiKey) {
    return res.status(503).json({ error: "Integração de IA não configurada no servidor" });
  }

  const systemPrompt = `Você é um assistente especializado em documentos públicos municipais brasileiros, consórcios intermunicipais e manifestações de interesse. Ajude a redigir, corrigir e melhorar documentos formais com linguagem jurídica e administrativa adequada. Responda sempre em português brasileiro. Conteúdo atual do documento: ${parsed.data.docContext?.slice(0, 1200) || "(nenhum conteúdo ainda)"}`;
  const history = parsed.data.history || [];
  const messages = [...history, { role: "user", content: parsed.data.input }];

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });

  const data = await upstream.json();
  if (!upstream.ok) {
    return res.status(502).json({ error: data?.error?.message || "Falha ao consultar provedor de IA" });
  }

  const text = data.content?.map((block) => block.text || "").join("").trim() || "Sem resposta.";
  await appendAuditLog({
    actor: req.user,
    action: "ai.redigir",
    resourceType: "ai",
    payload: { inputChars: parsed.data.input.length, historyCount: history.length },
  });

  return res.json({ text });
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/users", authRequired, requirePermission("users:create"), async (req, res) => {
  const schema = z.object({
    nome: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["admin", "juridico", "operador", "auditor"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });

  const db = getDb();
  const exists = await db.get("SELECT id FROM users WHERE email = ?", [parsed.data.email.toLowerCase()]);
  if (exists) return res.status(409).json({ error: "E-mail já cadastrado" });

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.default.hash(parsed.data.password, 10);
  const id = uuidv4();
  await db.run(
    `INSERT INTO users (id, nome, email, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [id, parsed.data.nome, parsed.data.email.toLowerCase(), passwordHash, parsed.data.role]
  );

  await appendAuditLog({
    actor: req.user,
    action: "user.create",
    resourceType: "user",
    resourceId: id,
    payload: { nome: parsed.data.nome, email: parsed.data.email, role: parsed.data.role },
  });

  return res.status(201).json({ id });
});

app.get("/api/municipios", authRequired, requirePermission("municipios:read"), async (_req, res) => {
  const db = getDb();
  const items = await db.all(
    `SELECT id, nome, email, token, activate_at, status, signed_at, geo_lat, geo_lon, signer_ip, device_info, signer_cpf, signer_nome, signature_data_url, documento_html, document_hash, otp_expires_at, otp_verified_at, tsa_utc, tsa_source, tsa_token, hash
     FROM municipios
     ORDER BY id ASC`
  );
  res.json({ items });
});

app.put("/api/municipios/snapshot", authRequired, requirePermission("municipios:write"), async (req, res) => {
  const schema = z.object({
    items: z.array(
      z.object({
        id: z.number(),
        nome: z.string().min(1),
        email: z.string().email(),
        token: z.string().min(4),
        activateAt: z.string().min(10),
        status: z.enum(["pendente", "enviado", "assinado"]),
        signedAt: z.string().nullable().optional(),
        geo: z.object({ lat: z.number(), lon: z.number() }).nullable().optional(),
        ip: z.string().max(120).nullable().optional(),
        device: z.string().max(1024).nullable().optional(),
        documentoHtml: z.string().max(50000).nullable().optional(),
        signerCpf: z.string().max(20).nullable().optional(),
        signerNome: z.string().max(180).nullable().optional(),
        signatureDataUrl: z.string().max(300000).nullable().optional(),
        documentHash: z.string().max(120).nullable().optional(),
        otpExpiresAt: z.string().nullable().optional(),
        otpVerifiedAt: z.string().nullable().optional(),
        tsaUtc: z.string().nullable().optional(),
        tsaSource: z.string().max(120).nullable().optional(),
        tsaToken: z.string().max(180).nullable().optional(),
        hash: z.string().nullable().optional(),
      })
    ),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
  }

  const db = getDb();
  await db.exec("BEGIN TRANSACTION");
  try {
    await db.run("DELETE FROM municipios");
    for (const item of parsed.data.items) {
      await db.run(
        `INSERT INTO municipios (id, nome, email, token, activate_at, status, signed_at, geo_lat, geo_lon, signer_ip, device_info, documento_html, signer_cpf, signer_nome, signature_data_url, document_hash, otp_expires_at, otp_verified_at, tsa_utc, tsa_source, tsa_token, hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.nome,
          item.email,
          item.token,
          item.activateAt,
          item.status,
          item.signedAt || null,
          item.geo?.lat ?? null,
          item.geo?.lon ?? null,
          item.ip || null,
          item.device || null,
          item.documentoHtml || null,
          item.signerCpf || null,
          item.signerNome || null,
          item.signatureDataUrl || null,
          item.documentHash || null,
          item.otpExpiresAt || null,
          item.otpVerifiedAt || null,
          item.tsaUtc || null,
          item.tsaSource || null,
          item.tsaToken || null,
          item.hash || null,
        ]
      );
    }
    await db.exec("COMMIT");
  } catch (err) {
    await db.exec("ROLLBACK");
    throw err;
  }

  await appendAuditLog({
    actor: req.user,
    action: "municipios.snapshot",
    resourceType: "municipio",
    payload: { total: parsed.data.items.length },
  });

  res.json({ ok: true, total: parsed.data.items.length });
});

app.post("/api/assinaturas/otp/enviar", async (req, res) => {
  const schema = z.object({ token: z.string().min(4) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
  }

  const db = getDb();
  const municipio = await db.get("SELECT id, nome, email, token, status FROM municipios WHERE token = ?", [parsed.data.token]);
  if (!municipio) return res.status(404).json({ error: "Link de assinatura inválido ou expirado" });
  if (municipio.status === "assinado") return res.status(409).json({ error: "Documento já assinado" });

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const codeHash = hashOtpCode(code, municipio.token);

  await db.run(
    `UPDATE municipios
     SET otp_code_hash = ?, otp_expires_at = ?, otp_verified_at = NULL
     WHERE id = ?`,
    [codeHash, expiresAt, municipio.id]
  );

  const html = [
    `<p>Olá,</p>`,
    `<p>Seu código de confirmação de assinatura para o município <strong>${municipio.nome}</strong> é:</p>`,
    `<p style="font-size:24px;font-weight:700;letter-spacing:2px;margin:12px 0;">${code}</p>`,
    `<p>Validade: 10 minutos.</p>`,
  ].join("");

  const result = await sendNotification({
    to: municipio.email,
    subject: `Código OTP de assinatura (${municipio.nome})`,
    html,
  });

  if (!result.sent) {
    return res.status(502).json({ error: result.reason || "Falha ao enviar OTP" });
  }

  await appendAuditLog({
    actor: null,
    action: "assinatura.otp.enviado",
    resourceType: "municipio",
    resourceId: String(municipio.id),
    payload: { municipio: municipio.nome, email: municipio.email, expiresAt },
  });

  return res.json({ ok: true, expiresAt });
});

app.post("/api/assinaturas/otp/validar", async (req, res) => {
  const schema = z.object({
    token: z.string().min(4),
    codigo: z.string().min(6).max(6),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
  }

  const db = getDb();
  const municipio = await db.get(
    "SELECT id, nome, token, otp_code_hash, otp_expires_at, otp_verified_at FROM municipios WHERE token = ?",
    [parsed.data.token]
  );
  if (!municipio) return res.status(404).json({ error: "Link de assinatura inválido ou expirado" });
  if (!municipio.otp_code_hash || !municipio.otp_expires_at) {
    return res.status(400).json({ error: "Solicite um código OTP antes de validar" });
  }
  if (new Date(municipio.otp_expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: "Código OTP expirado" });
  }

  const expected = hashOtpCode(parsed.data.codigo, municipio.token);
  if (expected !== municipio.otp_code_hash) {
    return res.status(401).json({ error: "Código OTP inválido" });
  }

  const verifiedAt = new Date().toISOString();
  await db.run("UPDATE municipios SET otp_verified_at = ? WHERE id = ?", [verifiedAt, municipio.id]);

  await appendAuditLog({
    actor: null,
    action: "assinatura.otp.validado",
    resourceType: "municipio",
    resourceId: String(municipio.id),
    payload: { municipio: municipio.nome, verifiedAt },
  });

  return res.json({ ok: true, verifiedAt });
});

app.post("/api/assinaturas/registrar", async (req, res) => {
  const schema = z.object({
    token: z.string().min(4),
    otpCode: z.string().min(6).max(6),
    documentHash: z.string().min(64).max(128),
    cpf: z.string().min(11).max(20),
    signerNome: z.string().min(2).max(180).optional(),
    assinaturaDataUrl: z.string().min(30).max(300000),
    lat: z.number().nullable().optional(),
    lon: z.number().nullable().optional(),
    device: z.string().max(1024).nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
  }

  const db = getDb();
  const municipio = await db.get("SELECT * FROM municipios WHERE token = ?", [parsed.data.token]);
  if (!municipio) {
    return res.status(404).json({ error: "Link de assinatura inválido ou expirado" });
  }

  if (municipio.status === "assinado") {
    return res.json({
      ok: true,
      alreadySigned: true,
      item: {
        id: municipio.id,
        nome: municipio.nome,
        email: municipio.email,
        token: municipio.token,
        activate_at: municipio.activate_at,
        status: municipio.status,
        signed_at: municipio.signed_at,
        geo_lat: municipio.geo_lat,
        geo_lon: municipio.geo_lon,
        signer_ip: municipio.signer_ip,
        device_info: municipio.device_info,
        signer_cpf: municipio.signer_cpf,
        signer_nome: municipio.signer_nome,
        signature_data_url: municipio.signature_data_url,
        document_hash: municipio.document_hash,
        otp_verified_at: municipio.otp_verified_at,
        tsa_utc: municipio.tsa_utc,
        tsa_source: municipio.tsa_source,
        tsa_token: municipio.tsa_token,
        hash: municipio.hash,
      },
    });
  }

  const cpfDigits = String(parsed.data.cpf || "").replace(/\D/g, "");
  if (cpfDigits.length !== 11) {
    return res.status(400).json({ error: "CPF inválido" });
  }

  if (!municipio.document_hash) {
    return res.status(400).json({ error: "Documento não congelado para assinatura" });
  }

  const otpHash = hashOtpCode(parsed.data.otpCode, municipio.token);
  if (!municipio.otp_code_hash || otpHash !== municipio.otp_code_hash) {
    return res.status(401).json({ error: "Código OTP inválido" });
  }
  if (!municipio.otp_expires_at || new Date(municipio.otp_expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: "Código OTP expirado" });
  }
  if (!municipio.otp_verified_at) {
    return res.status(400).json({ error: "Código OTP ainda não validado" });
  }

  if (String(parsed.data.documentHash) !== String(municipio.document_hash)) {
    return res.status(409).json({ error: "Hash do documento divergente. Reabra o link de assinatura." });
  }

  const signedAt = new Date().toISOString();
  const ip = getRequestIp(req);
  const deviceInfo = getRequestDevice(req, parsed.data.device);
  const tsa = await getTrustedTimestampUtc();
  const tsaToken = generateTsaToken({
    token: municipio.token,
    documentHash: municipio.document_hash,
    signedAt,
    tsaUtc: tsa.utc,
    source: tsa.source,
  });
  const hash = buildSignatureHash({
    token: municipio.token,
    signedAt,
    ip,
    device: `${deviceInfo || "-"}|${cpfDigits}|${municipio.document_hash}|${tsa.utc}`,
    lat: parsed.data.lat ?? null,
    lon: parsed.data.lon ?? null,
  });

  await db.run(
    `UPDATE municipios
     SET status = 'assinado', signed_at = ?, geo_lat = ?, geo_lon = ?, signer_ip = ?, device_info = ?, signer_cpf = ?, signer_nome = ?, signature_data_url = ?, tsa_utc = ?, tsa_source = ?, tsa_token = ?, hash = ?
     WHERE id = ?`,
    [
      signedAt,
      parsed.data.lat ?? null,
      parsed.data.lon ?? null,
      ip,
      deviceInfo,
      cpfDigits,
      parsed.data.signerNome || "Representante Municipal",
      parsed.data.assinaturaDataUrl,
      tsa.utc,
      tsa.source,
      tsaToken,
      hash,
      municipio.id,
    ]
  );

  const updated = await db.get(
    `SELECT id, nome, email, token, activate_at, status, signed_at, geo_lat, geo_lon, signer_ip, device_info, signer_cpf, signer_nome, signature_data_url, document_hash, otp_verified_at, tsa_utc, tsa_source, tsa_token, hash
     FROM municipios
     WHERE id = ?`,
    [municipio.id]
  );

  await appendAuditLog({
    actor: null,
    action: "assinatura.publica",
    resourceType: "municipio",
    resourceId: String(municipio.id),
    payload: {
      nome: municipio.nome,
      token: municipio.token,
      ip,
      device: deviceInfo,
      cpf: cpfDigits,
      signerNome: parsed.data.signerNome || "Representante Municipal",
      documentHash: municipio.document_hash,
      otpVerifiedAt: municipio.otp_verified_at,
      tsaUtc: tsa.utc,
      tsaSource: tsa.source,
      tsaToken,
      lat: parsed.data.lat ?? null,
      lon: parsed.data.lon ?? null,
      signedAt,
      hash,
    },
  });

  return res.json({ ok: true, item: updated });
});

app.get("/api/assinaturas/publico/:token", async (req, res) => {
  const token = String(req.params.token || "").trim();
  if (!token) return res.status(400).json({ error: "Token inválido" });

  const db = getDb();
  const item = await db.get(
    `SELECT id, nome, email, token, activate_at, status, signed_at, geo_lat, geo_lon, signer_ip, device_info, signer_cpf, signer_nome, signature_data_url, documento_html, document_hash, otp_expires_at, otp_verified_at, tsa_utc, tsa_source, tsa_token, hash
     FROM municipios
     WHERE token = ?`,
    [token]
  );

  if (!item) return res.status(404).json({ error: "Link de assinatura inválido ou expirado" });
  return res.json({ item });
});

app.get("/api/processos", authRequired, requirePermission("processos:read"), async (req, res) => {
  const db = getDb();
  const { secretaria, status, search } = req.query;
  const { fromIso, toIso, invalid } = parsePeriod(req.query);
  if (invalid) return res.status(400).json({ error: "Período inválido" });
  const page = Number(req.query.page || 1);
  const pageSize = Math.min(Number(req.query.pageSize || 20), 100);
  const offset = (page - 1) * pageSize;

  const where = [];
  const params = [];

  if (secretaria) {
    where.push("secretaria = ?");
    params.push(secretaria);
  }
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (search) {
    where.push("(numero LIKE ? OR titulo LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (fromIso) {
    where.push("created_at >= ?");
    params.push(fromIso);
  }
  if (toIso) {
    where.push("created_at <= ?");
    params.push(toIso);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const items = await db.all(
    `SELECT p.*, 
            (SELECT COUNT(*) FROM documentos d WHERE d.processo_id = p.id) AS total_versions
     FROM processos p
     ${whereSql}
     ORDER BY p.updated_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const totalRow = await db.get(`SELECT COUNT(*) AS total FROM processos p ${whereSql}`, params);

  return res.json({
    page,
    pageSize,
    total: totalRow?.total || 0,
    items,
  });
});

app.post("/api/processos", authRequired, requirePermission("processos:create"), async (req, res) => {
  const schema = z.object({
    numero: z.string().min(2),
    secretaria: z.string().min(2),
    titulo: z.string().min(2),
    status: z.enum(STATUS_VALUES).default("rascunho"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });

  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO processos (id, numero, secretaria, titulo, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, parsed.data.numero, parsed.data.secretaria, parsed.data.titulo, parsed.data.status, req.user.sub, now, now]
  );

  await appendAuditLog({
    actor: req.user,
    action: "processo.create",
    resourceType: "processo",
    resourceId: id,
    payload: parsed.data,
  });

  return res.status(201).json({ id });
});

app.get("/api/processos/:id", authRequired, requirePermission("processos:read"), async (req, res) => {
  const db = getDb();
  const processo = await db.get("SELECT * FROM processos WHERE id = ?", [req.params.id]);
  if (!processo) return res.status(404).json({ error: "Processo não encontrado" });

  return res.json({ processo });
});

app.patch("/api/processos/:id", authRequired, requirePermission("processos:update"), async (req, res) => {
  const schema = z.object({
    numero: z.string().min(2).optional(),
    secretaria: z.string().min(2).optional(),
    titulo: z.string().min(2).optional(),
    status: z.enum(STATUS_VALUES).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });

  const db = getDb();
  const current = await db.get("SELECT * FROM processos WHERE id = ?", [req.params.id]);
  if (!current) return res.status(404).json({ error: "Processo não encontrado" });

  const next = {
    numero: parsed.data.numero ?? current.numero,
    secretaria: parsed.data.secretaria ?? current.secretaria,
    titulo: parsed.data.titulo ?? current.titulo,
    status: parsed.data.status ?? current.status,
  };

  await db.run(
    `UPDATE processos
     SET numero = ?, secretaria = ?, titulo = ?, status = ?, updated_at = ?
     WHERE id = ?`,
    [next.numero, next.secretaria, next.titulo, next.status, new Date().toISOString(), req.params.id]
  );

  await appendAuditLog({
    actor: req.user,
    action: "processo.update",
    resourceType: "processo",
    resourceId: req.params.id,
    payload: next,
  });

  return res.json({ ok: true });
});

app.get("/api/processos/:id/documentos", authRequired, requirePermission("documentos:read"), async (req, res) => {
  const db = getDb();
  const items = await db.all(
    `SELECT d.*, u.nome AS uploaded_by_name, u.email AS uploaded_by_email
     FROM documentos d
     LEFT JOIN users u ON u.id = d.uploaded_by
     WHERE processo_id = ?
     ORDER BY version DESC`,
    [req.params.id]
  );
  res.json({ items });
});

app.post(
  "/api/processos/:id/documentos",
  authRequired,
  requirePermission("documentos:upload"),
  upload.single("arquivo"),
  async (req, res) => {
    const db = getDb();
    const processo = await db.get("SELECT * FROM processos WHERE id = ?", [req.params.id]);
    if (!processo) return res.status(404).json({ error: "Processo não encontrado" });
    if (!req.file) return res.status(400).json({ error: "Arquivo é obrigatório" });

    const nextVersionRow = await db.get("SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM documentos WHERE processo_id = ?", [req.params.id]);
    const version = nextVersionRow?.next_version || 1;
    const id = uuidv4();
    const checksum = checksumFile(req.file.path);

    await db.run(
      `INSERT INTO documentos (
        id, processo_id, version, file_name, storage_path, mime_type, size_bytes, checksum_sha256, notes, uploaded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.params.id,
        version,
        req.file.originalname,
        req.file.path,
        req.file.mimetype,
        req.file.size,
        checksum,
        req.body.notes || null,
        req.user.sub,
        new Date().toISOString(),
      ]
    );

    await db.run("UPDATE processos SET updated_at = ? WHERE id = ?", [new Date().toISOString(), req.params.id]);

    await appendAuditLog({
      actor: req.user,
      action: "documento.upload",
      resourceType: "documento",
      resourceId: id,
      payload: { processoId: req.params.id, version, fileName: req.file.originalname },
    });

    return res.status(201).json({ id, version, checksum });
  }
);

app.get("/api/documentos/:id/download", authRequired, requirePermission("documentos:download"), async (req, res) => {
  const db = getDb();
  const doc = await db.get("SELECT * FROM documentos WHERE id = ?", [req.params.id]);
  if (!doc) return res.status(404).json({ error: "Documento não encontrado" });
  if (!fs.existsSync(doc.storage_path)) return res.status(404).json({ error: "Arquivo físico não encontrado" });

  await appendAuditLog({
    actor: req.user,
    action: "documento.download",
    resourceType: "documento",
    resourceId: doc.id,
    payload: { fileName: doc.file_name, version: doc.version },
  });

  return res.download(doc.storage_path, doc.file_name);
});

app.get("/api/auditoria", authRequired, requirePermission("auditoria:read"), async (req, res) => {
  const db = getDb();
  const { action, resourceType } = req.query;
  const { fromIso, toIso, invalid } = parsePeriod(req.query);
  if (invalid) return res.status(400).json({ error: "Período inválido" });

  const where = [];
  const params = [];

  if (action) {
    where.push("action = ?");
    params.push(action);
  }
  if (resourceType) {
    where.push("resource_type = ?");
    params.push(resourceType);
  }
  if (fromIso) {
    where.push("ts >= ?");
    params.push(fromIso);
  }
  if (toIso) {
    where.push("ts <= ?");
    params.push(toIso);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await db.all(
    `SELECT * FROM audit_logs ${whereSql} ORDER BY ts DESC LIMIT 500`,
    params
  );

  const items = rows.map((row) => ({
    ...row,
    signature_valid: verifyAuditEntry(row),
  }));

  return res.json({ items });
});

app.get("/api/dashboard", authRequired, requirePermission("dashboard:read"), async (req, res) => {
  const db = getDb();
  const { secretaria } = req.query;
  const { fromIso, toIso, invalid } = parsePeriod(req.query);
  if (invalid) return res.status(400).json({ error: "Período inválido" });

  const where = [];
  const params = [];

  if (secretaria) {
    where.push("secretaria = ?");
    params.push(secretaria);
  }
  if (fromIso) {
    where.push("created_at >= ?");
    params.push(fromIso);
  }
  if (toIso) {
    where.push("created_at <= ?");
    params.push(toIso);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalProcessos = await db.get(`SELECT COUNT(*) AS total FROM processos ${whereSql}`, params);
  const porStatus = await db.all(
    `SELECT status, COUNT(*) AS total FROM processos ${whereSql} GROUP BY status`,
    params
  );

  const docsWhere = whereSql
    ? `WHERE d.processo_id IN (SELECT id FROM processos ${whereSql})`
    : "";

  const totalDocumentos = await db.get(
    `SELECT COUNT(*) AS total FROM documentos d ${docsWhere}`,
    params
  );

  const versoesPorProcesso = await db.get(
    `SELECT ROUND(AVG(cnt), 2) AS media FROM (
      SELECT COUNT(*) AS cnt FROM documentos d
      ${docsWhere}
      GROUP BY d.processo_id
    )`,
    params
  );

  const serie = await db.all(
    `SELECT substr(created_at, 1, 10) AS dia, COUNT(*) AS total
     FROM processos
     ${whereSql}
     GROUP BY dia
     ORDER BY dia ASC`,
    params
  );

  const porSecretaria = await db.all(
    `SELECT secretaria, COUNT(*) AS total
     FROM processos
     ${whereSql}
     GROUP BY secretaria
     ORDER BY total DESC`,
    params
  );

  const atrasados = await db.get(
    `SELECT COUNT(*) AS total FROM processos
     ${whereSql ? whereSql + " AND" : "WHERE"} status != 'concluido' AND datetime(updated_at) < datetime('now', '-7 day')`,
    params
  );

  res.json({
    filtros: { secretaria: secretaria || null, from: fromIso, to: toIso },
    kpi: {
      total_processos: totalProcessos?.total || 0,
      total_documentos: totalDocumentos?.total || 0,
      media_versoes_por_processo: versoesPorProcesso?.media || 0,
      processos_atrasados: atrasados?.total || 0,
    },
    por_status: porStatus,
    por_secretaria: porSecretaria,
    serie_processos_por_dia: serie,
  });
});

app.get("/api/alerts/sla", authRequired, requirePermission("alerts:read"), async (req, res) => {
  const db = getDb();
  const days = Number(req.query.days || 7);
  const secretaria = req.query.secretaria;

  const where = ["status != 'concluido'", `datetime(updated_at) < datetime('now', '-${Math.max(1, days)} day')`];
  const params = [];

  if (secretaria) {
    where.push("secretaria = ?");
    params.push(secretaria);
  }

  const items = await db.all(
    `SELECT id, numero, secretaria, titulo, status, updated_at
     FROM processos
     WHERE ${where.join(" AND ")}
     ORDER BY updated_at ASC`,
    params
  );

  res.json({
    days,
    total: items.length,
    items,
  });
});

app.post("/api/assinaturas/disparar", async (req, res) => {
  const schema = z.object({
    to: z.string().email(),
    subject: z.string().min(5),
    html: z.string().min(5),
    municipio: z.string().min(1).max(180).optional(),
    token: z.string().min(4).optional(),
    documentoHtml: z.string().max(25000).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
  }

  const db = getDb();
  if (parsed.data.token) {
    const corpoDocumento = ((parsed.data.documentoHtml || "").trim() || defaultSignatureDocumentHtml()).slice(0, 20000);
    const documentoHash = computeDocumentHash(corpoDocumento);
    await db.run(
      `UPDATE municipios
       SET documento_html = ?,
           document_hash = ?,
           otp_code_hash = NULL,
           otp_expires_at = NULL,
           otp_verified_at = NULL,
           tsa_utc = NULL,
           tsa_source = NULL,
           tsa_token = NULL
       WHERE token = ?`,
      [corpoDocumento, documentoHash, parsed.data.token]
    );
  }

  const result = await sendNotification({
    to: parsed.data.to,
    subject: parsed.data.subject,
    html: parsed.data.html,
    attachments: getTimbradoEmailAttachments(),
  });

  await appendAuditLog({
    actor: null,
    action: "assinatura.dispatch",
    resourceType: "notification",
    payload: {
      to: parsed.data.to,
      municipio: parsed.data.municipio || null,
      sent: result.sent,
      reason: result.reason || null,
      source: "public-endpoint",
    },
  });

  return res.json(result);
});

app.post("/api/assinaturas/teste-envio", async (req, res) => {
  const schema = z.object({
    to: z.string().email(),
    municipio: z.string().min(1).max(180).optional(),
    linkAssinatura: z.string().min(10).optional(),
    subject: z.string().min(5).max(180).optional(),
    html: z.string().min(5).max(50000).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
  }

  const municipio = parsed.data.municipio || "Município Teste";
  const subject = parsed.data.subject || `Teste de envio - Assinatura (${municipio})`;
  const html = parsed.data.html || buildSignatureEmailHtml({
    municipio,
    linkAssinatura: parsed.data.linkAssinatura,
    documentoHtml: defaultSignatureDocumentHtml(),
  });

  const result = await sendNotification({
    to: parsed.data.to,
    subject,
    html,
    attachments: getTimbradoEmailAttachments(),
  });

  await appendAuditLog({
    actor: null,
    action: "assinatura.teste_envio",
    resourceType: "notification",
    payload: {
      to: parsed.data.to,
      municipio,
      sent: result.sent,
      reason: result.reason || null,
      source: "public-endpoint",
    },
  });

  return res.json(result);
});

app.post("/api/assinaturas/disparar-lote", async (req, res) => {
  const schema = z.object({
    documentoHtml: z.string().max(25000).optional(),
    itens: z
      .array(
        z.object({
          to: z.string().email(),
          municipio: z.string().min(1).max(180),
          linkAssinatura: z.string().min(10),
        })
      )
      .min(1)
      .max(500),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
  }

  const corpoDocumento = ((parsed.data.documentoHtml || "").trim() || defaultSignatureDocumentHtml()).slice(0, 20000);
  const db = getDb();
  const documentoHash = computeDocumentHash(corpoDocumento);
  const enviados = [];
  const falhas = [];

  for (const item of parsed.data.itens) {
    const token = extractTokenFromSignatureLink(item.linkAssinatura);
    if (token) {
      await db.run(
        `UPDATE municipios
         SET documento_html = ?,
             document_hash = ?,
             otp_code_hash = NULL,
             otp_expires_at = NULL,
             otp_verified_at = NULL,
             tsa_utc = NULL,
             tsa_source = NULL,
             tsa_token = NULL
         WHERE token = ?`,
        [corpoDocumento || null, documentoHash, token]
      );
    }

    const subject = `Manifestação de Interesse - Assinatura (${item.municipio})`;
    const html = buildSignatureEmailHtml({
      municipio: item.municipio,
      linkAssinatura: item.linkAssinatura,
      documentoHtml: corpoDocumento || `<p><em>Documento não informado no momento do disparo.</em></p>`,
    });

    const result = await sendNotification({
      to: item.to,
      subject,
      html,
      attachments: getTimbradoEmailAttachments(),
    });

    if (result.sent) {
      enviados.push({ municipio: item.municipio, to: item.to });
    } else {
      falhas.push({ municipio: item.municipio, to: item.to, reason: result.reason || "falha" });
    }
  }

  await appendAuditLog({
    actor: null,
    action: "assinatura.dispatch.lote",
    resourceType: "notification",
    payload: {
      total: parsed.data.itens.length,
      enviados: enviados.length,
      falhas: falhas.length,
      source: "public-endpoint",
    },
  });

  return res.json({
    total: parsed.data.itens.length,
    enviados,
    falhas,
  });
});

app.post("/api/alerts/notify", authRequired, requirePermission("alerts:notify"), async (req, res) => {
  const schema = z.object({
    to: z.string().email(),
    subject: z.string().min(5),
    html: z.string().min(5),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });

  const result = await sendNotification(parsed.data);

  await appendAuditLog({
    actor: req.user,
    action: "alerts.notify",
    resourceType: "notification",
    payload: { to: parsed.data.to, subject: parsed.data.subject, sent: result.sent, reason: result.reason || null },
  });

  res.json(result);
});

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Erro de upload: ${err.message}` });
  }
  if (String(err?.message || "").includes("CORS")) {
    return res.status(403).json({ error: "Origem não permitida" });
  }
  if (err?.statusCode) {
    return res.status(err.statusCode).json({ error: err.message || "Erro de validação" });
  }
  return res.status(500).json({ error: "Erro interno do servidor" });
});

const start = async () => {
  await initDb();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API pronta em http://localhost:${config.port}`);
  });
};

start();
