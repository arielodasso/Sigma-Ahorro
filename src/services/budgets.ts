import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { budgetWindow, type BudgetWindow } from "@/lib/finance";
import { todayISO } from "@/lib/dates";
import { latestRate } from "@/services/currency";
import { getPreferences } from "@/services/users";
import { logAudit } from "@/lib/audit";
import type { Budget, BudgetWithSpent } from "@/types";

export interface BudgetInputData {
  name: string;
  categoryId?: string | null;
  period: "weekly" | "monthly" | "yearly" | "custom";
  amountMinor: number;
  currency: string;
  startDate: string;
  endDate?: string | null;
  thresholds?: number[];
}

export interface BudgetView extends BudgetWithSpent {
  window: BudgetWindow;
  thresholdsList: number[];
  daysLeft: number;
}

function parseThresholds(value: string | null | undefined, fallback: number[]): number[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const list = parsed.map(Number).filter((item) => Number.isFinite(item) && item > 0);
      if (list.length > 0) return list.sort((a, b) => a - b);
    }
  } catch {
    // Ignorar JSON corrupto.
  }
  return fallback;
}

export async function listBudgets(userId: string, includeInactive = false): Promise<Budget[]> {
  const db = await getDb();
  const where = includeInactive ? "" : " AND active = 1";
  return db.all<Budget>(`SELECT * FROM budgets WHERE user_id = ?${where} ORDER BY created_at DESC`, [userId]);
}

export async function listBudgetViews(userId: string, today = todayISO()): Promise<BudgetView[]> {
  const db = await getDb();
  const prefs = await getPreferences(userId);
  const budgets = await listBudgets(userId);
  const result: BudgetView[] = [];
  for (const budget of budgets) {
    const window = budgetWindow(
      {
        amountMinor: budget.amount_minor,
        period: budget.period,
        startDate: budget.start_date,
        endDate: budget.end_date,
      },
      today,
    );
    const params: unknown[] = [userId, window.from, window.to];
    let categoryClause = "";
    if (budget.category_id) {
      categoryClause = " AND category_id = ?";
      params.push(budget.category_id);
    }
    const row = await db.get<{ total: number | string | null }>(
      `SELECT SUM(base_amount_minor) AS total FROM transactions
       WHERE user_id = ? AND deleted_at IS NULL AND type = 'expense' AND base_amount_minor IS NOT NULL
       AND occurred_date >= ? AND occurred_date <= ?${categoryClause}`,
      params,
    );
    let spent = Number(row?.total ?? 0);
    if (budget.currency !== prefs.primary_currency) {
      const rate = await latestRate(userId, prefs.primary_currency, budget.currency);
      if (rate) spent = Math.round((spent * rate.rate_scaled) / 1_000_000);
    }
    const defaults = parseThresholds(null, [50, 75, 90, 100]);
    result.push({
      ...budget,
      category_name: null,
      category_color: null,
      spent_minor: spent,
      window,
      thresholdsList: parseThresholds(budget.thresholds, defaults),
      daysLeft: window.to >= today ? Math.max(0, Math.ceil((Date.parse(window.to) - Date.parse(today)) / 86_400_000)) : 0,
    });
  }
  if (result.length > 0) {
    const categories = await db.all<{ id: string; name: string; color: string }>(
      `SELECT id, name, color FROM categories WHERE user_id = ?`,
      [userId],
    );
    const map = new Map(categories.map((category) => [category.id, category]));
    for (const budget of result) {
      const category = budget.category_id ? map.get(budget.category_id) : undefined;
      budget.category_name = category?.name ?? null;
      budget.category_color = category?.color ?? null;
    }
  }
  return result;
}

export async function createBudget(userId: string, input: BudgetInputData): Promise<Budget> {
  const db = await getDb();
  const budget: Budget = {
    id: randomUUID(),
    user_id: userId,
    name: input.name.trim(),
    category_id: input.categoryId ?? null,
    period: input.period,
    amount_minor: Math.abs(input.amountMinor),
    currency: input.currency as Budget["currency"],
    start_date: input.startDate,
    end_date: input.endDate ?? null,
    thresholds: JSON.stringify(input.thresholds ?? [50, 75, 90, 100]),
    active: 1,
    created_at: new Date().toISOString(),
  };
  await db.run(
    `INSERT INTO budgets (id, user_id, name, category_id, period, amount_minor, currency, start_date, end_date, thresholds, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      budget.id,
      budget.user_id,
      budget.name,
      budget.category_id,
      budget.period,
      budget.amount_minor,
      budget.currency,
      budget.start_date,
      budget.end_date,
      budget.thresholds,
      budget.created_at,
    ],
  );
  await logAudit(userId, "create", "budget", budget.id);
  return budget;
}

export async function updateBudget(
  userId: string,
  budgetId: string,
  input: Partial<BudgetInputData> & { active?: boolean },
): Promise<void> {
  const db = await getDb();
  const current = await db.get<Budget>("SELECT * FROM budgets WHERE id = ? AND user_id = ?", [budgetId, userId]);
  if (!current) throw new Error("Presupuesto no encontrado");
  await db.run(
    `UPDATE budgets SET name = ?, category_id = ?, period = ?, amount_minor = ?, currency = ?, start_date = ?, end_date = ?,
     thresholds = ?, active = ? WHERE id = ? AND user_id = ?`,
    [
      input.name?.trim() || current.name,
      input.categoryId === undefined ? current.category_id : input.categoryId,
      input.period ?? current.period,
      input.amountMinor !== undefined ? Math.abs(input.amountMinor) : current.amount_minor,
      input.currency ?? current.currency,
      input.startDate ?? current.start_date,
      input.endDate === undefined ? current.end_date : input.endDate,
      input.thresholds ? JSON.stringify(input.thresholds) : current.thresholds,
      input.active === undefined ? current.active : input.active ? 1 : 0,
      budgetId,
      userId,
    ],
  );
  await logAudit(userId, "update", "budget", budgetId);
}

export async function deleteBudget(userId: string, budgetId: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM budgets WHERE id = ? AND user_id = ?", [budgetId, userId]);
  await logAudit(userId, "delete", "budget", budgetId);
}

export async function budgetTotalMinor(userId: string, today = todayISO()): Promise<number> {
  const views = await listBudgetViews(userId, today);
  return views.reduce((acc, budget) => acc + budget.amount_minor, 0);
}
