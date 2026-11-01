import "server-only";
import { getDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/session";
import type { User } from "@/types";

export async function countUsers(): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ count: number | string }>("SELECT COUNT(*) AS count FROM users");
  return Number(row?.count ?? 0);
}

export async function authenticate(email: string, password: string): Promise<{ user: User | null; error?: string }> {
  const db = await getDb();
  const user = await db.get<User>("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email.trim()]);
  if (!user) return { user: null, error: "Email o contraseña incorrectos" };
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return { user: null, error: "Email o contraseña incorrectos" };
  return { user, error: undefined };
}

export async function setupOwner(name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const count = await db.get<{ count: number | string }>("SELECT COUNT(*) AS count FROM users");
  if (Number(count?.count ?? 0) > 0) return { success: false, error: "Ya existe una cuenta propietaria. Iniciá sesión." };
  const hashed = await hashPassword(password);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.run("INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)", [
    id,
    email.trim().toLowerCase(),
    hashed,
    name.trim(),
    now,
  ]);
  await db.run("INSERT INTO user_preferences (user_id, locale, timezone, primary_currency, theme, date_format, number_format, budget_thresholds, notifications, biometric_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    id,
    "es-AR",
    "America/Argentina/Buenos_Aires",
    "ARS",
    "light",
    "dd/MM/yyyy",
    "es-AR",
    JSON.stringify([50, 75, 90, 100]),
    JSON.stringify({ budgets: true, duePayments: true, debts: true, goals: true, recurring: true }),
    0,
    now,
    now,
  ]);
  return { success: true };
}

const crypto = require("crypto");