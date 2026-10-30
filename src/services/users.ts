import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { seedUserData } from "@/lib/db/seed";
import { hashPassword, verifyPassword } from "@/lib/auth/session";
import type { Preferences, User } from "@/types";

export interface CreateOwnerInput {
  name: string;
  email: string;
  password: string;
}

export async function createOwner(input: CreateOwnerInput): Promise<User> {
  const db = await getDb();
  const count = await db.get<{ count: number | string }>("SELECT COUNT(*) AS count FROM users");
  if (Number(count?.count ?? 0) > 0) {
    throw new Error("La cuenta propietaria ya existe. Iniciá sesión.");
  }
  const now = new Date().toISOString();
  const user: User = {
    id: randomUUID(),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    password_hash: await hashPassword(input.password),
    created_at: now,
  };
  await db.transaction(async (tx) => {
    await tx.run("INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)", [
      user.id,
      user.email,
      user.password_hash,
      user.name,
      user.created_at,
    ]);
    await seedUserData(tx, user.id);
  });
  return user;
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  const db = await getDb();
  const user = await db.get<User>("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email.trim()]);
  if (!user) return null;
  const valid = await verifyPassword(password, user.password_hash);
  return valid ? user : null;
}

export async function getUserById(userId: string): Promise<User | null> {
  const db = await getDb();
  return (await db.get<User>("SELECT * FROM users WHERE id = ?", [userId])) ?? null;
}

export async function getPreferences(userId: string): Promise<Preferences> {
  const db = await getDb();
  const prefs = await db.get<Preferences>("SELECT * FROM user_preferences WHERE user_id = ?", [userId]);
  if (prefs) return prefs;
  await seedUserData(db, userId);
  const created = await db.get<Preferences>("SELECT * FROM user_preferences WHERE user_id = ?", [userId]);
  if (!created) throw new Error("No se pudieron crear las preferencias");
  return created;
}

export interface PreferencesUpdate {
  name: string;
  locale: string;
  timezone: string;
  primaryCurrency: string;
  theme: string;
  dateFormat: string;
  numberFormat: string;
  budgetThresholds: number[];
  notifications: Record<string, boolean>;
  biometricEnabled: boolean;
}

export async function updatePreferences(userId: string, update: PreferencesUpdate): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.run("UPDATE users SET name = ? WHERE id = ?", [update.name, userId]);
    await tx.run(
      `UPDATE user_preferences SET locale = ?, timezone = ?, primary_currency = ?, theme = ?, date_format = ?, number_format = ?,
       budget_thresholds = ?, notifications = ?, biometric_enabled = ?, updated_at = ? WHERE user_id = ?`,
      [
        update.locale,
        update.timezone,
        update.primaryCurrency,
        update.theme,
        update.dateFormat,
        update.numberFormat,
        JSON.stringify(update.budgetThresholds),
        JSON.stringify(update.notifications),
        update.biometricEnabled ? 1 : 0,
        now,
        userId,
      ],
    );
  });
}

export async function deleteAllUserData(userId: string): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM audit_logs WHERE user_id = ?", [userId]);
    await tx.run("DELETE FROM users WHERE id = ?", [userId]);
  });
}

export function parseThresholds(value: string | null | undefined): number[] {
  if (!value) return [50, 75, 90, 100];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const values = parsed.map(Number).filter((item) => Number.isFinite(item) && item > 0);
      return values.length > 0 ? values.sort((a, b) => a - b) : [50, 75, 90, 100];
    }
  } catch {
    // Valor corrupto: usar defaults.
  }
  return [50, 75, 90, 100];
}

export function parseNotifications(value: string | null | undefined): Record<string, boolean> {
  const defaults = { budgets: true, duePayments: true, debts: true, goals: true, recurring: true };
  if (!value) return defaults;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      budgets: parsed.budgets !== false,
      duePayments: parsed.duePayments !== false,
      debts: parsed.debts !== false,
      goals: parsed.goals !== false,
      recurring: parsed.recurring !== false,
    };
  } catch {
    return defaults;
  }
}
