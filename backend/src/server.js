import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { config } from "./config.js";
import { initDb, getDb } from "./db.js";
import { appendAuditLog, verifyAuditEntry } from "./audit.js";
import { authRequired, login, signToken } from "./auth.js";
import { sendNotification } from "./notifications.js";

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "4mb" }));
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
  const fromIso = from ? new Date(from).toISOString() : null;
  const toIso = to ? new Date(to).toISOString() : null;
  return { fromIso, toIso };
}

function loginAttemptKey(ip, email) {
  return `${ip || "-"}|${(email || "").toLowerCase().trim()}`;
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

  return res.json({ token, user });
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
    `SELECT id, nome, email, token, activate_at, status, signed_at, geo_lat, geo_lon, hash
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
        `INSERT INTO municipios (id, nome, email, token, activate_at, status, signed_at, geo_lat, geo_lon, hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

app.get("/api/processos", authRequired, requirePermission("processos:read"), async (req, res) => {
  const db = getDb();
  const { secretaria, status, search } = req.query;
  const { fromIso, toIso } = parsePeriod(req.query);
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
  const { fromIso, toIso } = parsePeriod(req.query);

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
  const { fromIso, toIso } = parsePeriod(req.query);

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
