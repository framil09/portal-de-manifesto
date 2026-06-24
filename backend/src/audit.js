import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { config } from "./config.js";
import { getDb } from "./db.js";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sign(value) {
  return crypto.createHmac("sha256", config.auditSecret).update(value).digest("hex");
}

export async function appendAuditLog({ actor, action, resourceType, resourceId = null, payload = {} }) {
  const db = getDb();
  const ts = new Date().toISOString();
  const payloadJson = JSON.stringify(payload);

  const last = await db.get("SELECT hash FROM audit_logs ORDER BY ts DESC LIMIT 1");
  const prevHash = last?.hash || null;

  const base = [ts, actor?.id || "-", actor?.email || "-", action, resourceType, resourceId || "-", payloadJson, prevHash || "-"].join("|");
  const hash = sha256(base);
  const signature = sign(hash);

  await db.run(
    `INSERT INTO audit_logs (id, ts, actor_id, actor_email, action, resource_type, resource_id, payload_json, prev_hash, hash, signature)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      ts,
      actor?.id || null,
      actor?.email || null,
      action,
      resourceType,
      resourceId,
      payloadJson,
      prevHash,
      hash,
      signature,
    ]
  );
}

export function verifyAuditEntry(entry) {
  const expectedSignature = sign(entry.hash);
  return expectedSignature === entry.signature;
}
