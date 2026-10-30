import { randomUUID } from "node:crypto";
import type { Database } from "./client";
import { CURRENCIES, DEFAULT_CURRENCY, CURRENCY_CODES } from "@/lib/money";
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from "@/lib/dates";

export const DEFAULT_CATEGORIES: Array<{ name: string; color: string; icon: string }> = [
  { name: "Alimentación", color: "#5F7D4F", icon: "Apple" },
  { name: "Supermercado", color: "#0E7C66", icon: "ShoppingCart" },
  { name: "Restaurantes", color: "#B65B4B", icon: "UtensilsCrossed" },
  { name: "Transporte", color: "#3F6D8E", icon: "Bus" },
  { name: "Combustible", color: "#8A6A3E", icon: "Fuel" },
  { name: "Vivienda", color: "#7A5C8E", icon: "Home" },
  { name: "Servicios", color: "#4C7C8A", icon: "Zap" },
  { name: "Salud", color: "#B04A6A", icon: "HeartPulse" },
  { name: "Educación", color: "#4F6E9E", icon: "GraduationCap" },
  { name: "Entretenimiento", color: "#A56B2E", icon: "Clapperboard" },
  { name: "Compras", color: "#9A5B7A", icon: "ShoppingBag" },
  { name: "Tecnología", color: "#4E6FA8", icon: "Laptop" },
  { name: "Suscripciones", color: "#6E5A9E", icon: "Repeat" },
  { name: "Viajes", color: "#2F7F86", icon: "Plane" },
  { name: "Impuestos", color: "#7C6A4E", icon: "Landmark" },
  { name: "Mascotas", color: "#8A6A9E", icon: "PawPrint" },
  { name: "Otros", color: "#6B7280", icon: "CircleDashed" },
];

export async function seedCurrencies(db: Database): Promise<void> {
  for (const code of CURRENCY_CODES) {
    const meta = CURRENCIES[code];
    await db.run(
      "INSERT INTO currencies (code, name, symbol, decimals, active) VALUES (?, ?, ?, ?, 1) ON CONFLICT (code) DO NOTHING",
      [meta.code, meta.name, meta.symbol, meta.decimals],
    );
  }
}

export async function seedUserData(db: Database, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO user_preferences (user_id, locale, timezone, primary_currency, theme, date_format, number_format, budget_thresholds, notifications, biometric_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'system', 'dd/MM/yyyy', ?, '[50,75,90,100]', '{}', 0, ?, ?)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, DEFAULT_LOCALE, DEFAULT_TIMEZONE, DEFAULT_CURRENCY, DEFAULT_LOCALE, now, now],
  );

  const existing = await db.get<{ count: number | string }>(
    "SELECT COUNT(*) AS count FROM categories WHERE user_id = ?",
    [userId],
  );
  if (Number(existing?.count ?? 0) === 0) {
    for (const category of DEFAULT_CATEGORIES) {
      await db.run(
        "INSERT INTO categories (id, user_id, parent_id, name, kind, color, icon, is_system, created_at) VALUES (?, ?, NULL, ?, 'expense', ?, ?, 1, ?)",
        [randomUUID(), userId, category.name, category.color, category.icon, now],
      );
    }
    await db.run(
      "INSERT INTO categories (id, user_id, parent_id, name, kind, color, icon, is_system, created_at) VALUES (?, ?, NULL, 'Ingresos', 'income', '#0F8A5F', 'Wallet', 1, ?)",
      [randomUUID(), userId, now],
    );
  }

  const accounts = await db.get<{ count: number | string }>(
    "SELECT COUNT(*) AS count FROM accounts WHERE user_id = ?",
    [userId],
  );
  if (Number(accounts?.count ?? 0) === 0) {
    await db.run(
      "INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, archived, created_at) VALUES (?, ?, 'Cuenta principal', 'bank', ?, 0, 0, ?)",
      [randomUUID(), userId, DEFAULT_CURRENCY, now],
    );
    await db.run(
      "INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, archived, created_at) VALUES (?, ?, 'Efectivo', 'cash', ?, 0, 0, ?)",
      [randomUUID(), userId, DEFAULT_CURRENCY, now],
    );
  }
}
