import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { config } from "./config.js";
import { getDb } from "./db.js";

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      nome: user.nome,
    },
    config.jwtSecret,
    { expiresIn: "12h" }
  );
}

export async function login(email, password) {
  const db = getDb();
  const user = await db.get("SELECT * FROM users WHERE email = ?", [email.toLowerCase().trim()]);
  if (!user) return null;

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;

  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
  };
}

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = req.cookies?.auth_token;
  const token = bearerToken || cookieToken;

  if (!token) return res.status(401).json({ error: "Token ausente" });

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Não autenticado" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Sem permissão" });
    }
    return next();
  };
}
