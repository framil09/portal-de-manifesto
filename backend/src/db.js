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

  await ensureSeedData();
  return db;
}

export function getDb() {
  if (!db) throw new Error("Database not initialized");
  return db;
}
