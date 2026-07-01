import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import bcrypt from "bcryptjs";
import { config } from "./config.js";

let db;

async function ensureSeedData() {
  const admin = await db.get("SELECT id FROM users WHERE email = ?", [config.seedAdminEmail]);
  if (!admin) {
    const passwordHash = await bcrypt.hash(config.seedAdminPassword, 10);
    await db.run(
      `INSERT INTO users (id, nome, email, password_hash, role, created_at)
       VALUES (lower(hex(randomblob(16))), ?, ?, ?, 'admin', datetime('now'))`,
      ["Administrador", config.seedAdminEmail, passwordHash]
    );
  }
}

async function ensureMunicipiosColumns() {
  const columns = await db.all("PRAGMA table_info(municipios)");
  const names = new Set(columns.map((col) => col.name));

  if (!names.has("signer_ip")) {
    await db.exec("ALTER TABLE municipios ADD COLUMN signer_ip TEXT");
  }

  if (!names.has("device_info")) {
    await db.exec("ALTER TABLE municipios ADD COLUMN device_info TEXT");
  }

  if (!names.has("documento_html")) {
    await db.exec("ALTER TABLE municipios ADD COLUMN documento_html TEXT");
  }

  if (!names.has("signer_cpf")) {
    await db.exec("ALTER TABLE municipios ADD COLUMN signer_cpf TEXT");
  }

  if (!names.has("signer_nome")) {
    await db.exec("ALTER TABLE municipios ADD COLUMN signer_nome TEXT");
  }

  if (!names.has("signature_data_url")) {
    await db.exec("ALTER TABLE municipios ADD COLUMN signature_data_url TEXT");
  }

  if (!names.has("document_hash")) {
    await db.exec("ALTER TABLE municipios ADD COLUMN document_hash TEXT");
  }

  if (!names.has("otp_code_hash")) {
    await db.exec("ALTER TABLE municipios ADD COLUMN otp_code_hash TEXT");
  }

  if (!names.has("otp_expires_at")) {
    await db.exec("ALTER TABLE municipios ADD COLUMN otp_expires_at TEXT");
  }

  if (!names.has("otp_verified_at")) {
    await db.exec("ALTER TABLE municipios ADD COLUMN otp_verified_at TEXT");
  }

  if (!names.has("tsa_utc")) {
    await db.exec("ALTER TABLE municipios ADD COLUMN tsa_utc TEXT");
  }

  if (!names.has("tsa_source")) {
    await db.exec("ALTER TABLE municipios ADD COLUMN tsa_source TEXT");
  }

  if (!names.has("tsa_token")) {
    await db.exec("ALTER TABLE municipios ADD COLUMN tsa_token TEXT");
  }
}

export async function initDb() {
  const dir = path.dirname(config.dbFile);
  fs.mkdirSync(dir, { recursive: true });

  db = await open({
    filename: config.dbFile,
    driver: sqlite3.Database,
  });

  await db.exec("PRAGMA foreign_keys = ON;");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'juridico', 'operador', 'auditor')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS processos (
      id TEXT PRIMARY KEY,
      numero TEXT NOT NULL,
      secretaria TEXT NOT NULL,
      titulo TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('rascunho', 'revisao', 'envio', 'assinaturas', 'concluido')),
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS documentos (
      id TEXT PRIMARY KEY,
      processo_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      notes TEXT,
      uploaded_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(processo_id) REFERENCES processos(id) ON DELETE CASCADE,
      FOREIGN KEY(uploaded_by) REFERENCES users(id),
      UNIQUE(processo_id, version)
    );

    CREATE TABLE IF NOT EXISTS municipios (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      token TEXT NOT NULL,
      activate_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pendente', 'enviado', 'assinado')),
      signed_at TEXT,
      geo_lat REAL,
      geo_lon REAL,
      signer_ip TEXT,
      device_info TEXT,
      documento_html TEXT,
      signer_cpf TEXT,
      signer_nome TEXT,
      signature_data_url TEXT,
      document_hash TEXT,
      otp_code_hash TEXT,
      otp_expires_at TEXT,
      otp_verified_at TEXT,
      tsa_utc TEXT,
      tsa_source TEXT,
      tsa_token TEXT,
      hash TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      actor_id TEXT,
      actor_email TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      payload_json TEXT NOT NULL,
      prev_hash TEXT,
      hash TEXT NOT NULL,
      signature TEXT NOT NULL,
      FOREIGN KEY(actor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      key TEXT PRIMARY KEY,
      fail_count INTEGER NOT NULL DEFAULT 0,
      last_failed_at TEXT,
      locked_until TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT
    );

    CREATE TRIGGER IF NOT EXISTS trg_audit_no_update
    BEFORE UPDATE ON audit_logs
    BEGIN
      SELECT RAISE(ABORT, 'audit_logs is immutable');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_audit_no_delete
    BEFORE DELETE ON audit_logs
    BEGIN
      SELECT RAISE(ABORT, 'audit_logs is immutable');
    END;
  `);

  await ensureMunicipiosColumns();

  await ensureSeedData();
  return db;
}

export function getDb() {
  if (!db) throw new Error("Database not initialized");
  return db;
}
