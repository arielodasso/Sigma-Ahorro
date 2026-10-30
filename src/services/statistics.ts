import "server-only";
import { getDb } from "@/lib/db";
import { elapsedDaysInRange, previousRange, periodRange, todayISO, type PeriodPreset } from "@/lib/dates";
import { listBudgetViews } from "@/services/budgets";
import { listGoalViews } from "@/services/goals";
import { listDebtViews } from "@/services/debts";
import { upcomingPayments } from "@/services/scheduled";
import { listTransactions } from "@/services/transactions";
import type { DashboardData, TransactionWithRelations } from "@/types";

interface TotalsRow {
  spent: number | string | null;
  income: number | string | null;
  count: number | string;
}

async function totals(userId: string, from: string, to: string): Promise<{ spent: number; income: number; count: number }> {
  const db = await getDb();
  const row = await db.get<TotalsRow>(
    `SELECT
       SUM(CASE WHEN type = 'expense' THEN base_amount_minor ELSE 0 END) AS spent,
       SUM(CASE WHEN type = 'income' THEN base_amount_minor ELSE 0 END) AS income,
       COUNT(*) AS count
     FROM transactions
     WHERE user_id = ? AND deleted_at IS NULL AND occurred_date >= ? AND occurred_date <= ?`,
    [userId, from, to],
  );
  return { spent: Number(row?.spent ?? 0), income: Number(row?.income ?? 0), count: Number(row?.count ?? 0) };
}

function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getDashboard(
  userId: string,
  preset: PeriodPreset = "month",
  custom?: { from?: string; to?: string },
): Promise<DashboardData> {
  const today = todayISO();
  const range = periodRange(preset, today, custom);
  const prevRange = previousRange(range, preset);
  const [current, previous] = await Promise.all([totals(userId, range.from, range.to), totals(userId, prevRange.from, prevRange.to)]);
  const [budgets, goals, upcoming, recent, categoryRows, debtViews] = await Promise.all([
    listBudgetViews(userId, today),
    listGoalViews(userId, today),
    upcomingPayments(userId, today, 30),
    listTransactions(userId, { from: range.from, to: range.to, limit: 6 }),
    categoryTotals(userId, range.from, range.to),
    listDebtViews(userId, today),
  ]);

  const budgetTotalMinor = budgets.reduce((acc, budget) => acc + budget.amount_minor, 0);
  const budgetSpentMinor = budgets.reduce((acc, budget) => acc + budget.spent_minor, 0);
  const elapsed = elapsedDaysInRange(range.from, range.to, today);
  const dailyAverageMinor = elapsed > 0 ? Math.round(current.spent / elapsed) : 0;

  const alerts: DashboardData["alerts"] = [];
  for (const budget of budgets) {
    const pct = budget.amount_minor > 0 ? (budget.spent_minor / budget.amount_minor) * 100 : 0;
    if (pct >= 100) {
      alerts.push({
        kind: "budget_exceeded",
        title: `Presupuesto excedido: ${budget.name}`,
        body: `Superaste el límite por ${Math.abs(budget.amount_minor - budget.spent_minor)} en unidades mínimas.`,
        href: "/presupuestos",
        severity: "danger",
      });
    } else if (pct >= 90) {
      alerts.push({
        kind: "budget_warning",
        title: `Presupuesto al ${Math.round(pct)}%: ${budget.name}`,
        body: "Estás cerca del límite de este período.",
        href: "/presupuestos",
        severity: "warning",
      });
    }
  }
  for (const payment of upcoming) {
    const days = Math.ceil((Date.parse(payment.due_date) - Date.parse(today)) / 86_400_000);
    if (days <= 3) {
      alerts.push({
        kind: "payment_due",
        title: days < 0 ? `Pago vencido: ${payment.name}` : `Pago próximo: ${payment.name}`,
        body: days < 0 ? `Venció hace ${Math.abs(days)} días.` : days === 0 ? "Vence hoy." : `Vence en ${days} días.`,
        href: "/programados",
        severity: days < 0 ? "danger" : "warning",
      });
    }
  }
  for (const debt of debtViews) {
    if (debt.status === "paid" || debt.status === "cancelled" || debt.dueInDays === null) continue;
    if (debt.dueInDays <= 7) {
      alerts.push({
        kind: "debt_due",
        title: debt.direction === "owed_by_me" ? `Deuda por pagar: ${debt.counterparty}` : `Cobro pendiente: ${debt.counterparty}`,
        body: debt.overdue ? "Está vencida." : `Vence en ${debt.dueInDays} días.`,
        href: "/deudas",
        severity: debt.overdue ? "danger" : "warning",
      });
    }
  }

  return {
    range,
    previousRange: prevRange,
    spentMinor: current.spent,
    incomeMinor: current.income,
    balanceMinor: current.income - current.spent,
    previousSpentMinor: previous.spent,
    previousIncomeMinor: previous.income,
    spentChange: change(current.spent, previous.spent),
    incomeChange: change(current.income, previous.income),
    transactionCount: current.count,
    dailyAverageMinor,
    budgetTotalMinor,
    budgetSpentMinor,
    budgets,
    categories: categoryRows.slice(0, 8),
    recentTransactions: recent,
    upcomingPayments: upcoming.slice(0, 5),
    goals: goals.slice(0, 3),
    alerts: alerts.slice(0, 6),
  };
}

export async function categoryTotals(
  userId: string,
  from: string,
  to: string,
): Promise<DashboardData["categories"]> {
  const db = await getDb();
  const rows = await db.all<{
    id: string | null;
    name: string | null;
    color: string | null;
    icon: string | null;
    total: number | string | null;
    count: number | string;
  }>(
    `SELECT t.category_id AS id, c.name, c.color, c.icon, SUM(t.base_amount_minor) AS total, COUNT(*) AS count
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = ? AND t.deleted_at IS NULL AND t.type = 'expense' AND t.base_amount_minor IS NOT NULL
       AND t.occurred_date >= ? AND t.occurred_date <= ?
     GROUP BY t.category_id, c.name, c.color, c.icon
     ORDER BY total DESC`,
    [userId, from, to],
  );
  return rows.map((row) => ({
    id: row.id ?? "uncategorized",
    name: row.name ?? "Sin categoría",
    color: row.color ?? "#94A3B8",
    icon: row.icon ?? "Circle",
    totalMinor: Number(row.total ?? 0),
    count: Number(row.count ?? 0),
  }));
}

export interface MonthlyPoint {
  month: string;
  label: string;
  incomeMinor: number;
  expenseMinor: number;
  balanceMinor: number;
}

export async function monthlySeries(userId: string, months = 12, today = todayISO()): Promise<MonthlyPoint[]> {
  const db = await getDb();
  const start = `${today.slice(0, 7)}-01`;
  const startDate = new Date(`${start}T12:00:00.000Z`);
  startDate.setUTCMonth(startDate.getUTCMonth() - (months - 1));
  const from = startDate.toISOString().slice(0, 10);
  const rows = await db.all<{ month: string; type: string; total: number | string | null }>(
    `SELECT substr(occurred_date, 1, 7) AS month, type, SUM(base_amount_minor) AS total
     FROM transactions WHERE user_id = ? AND deleted_at IS NULL AND base_amount_minor IS NOT NULL AND occurred_date >= ?
     GROUP BY substr(occurred_date, 1, 7), type`,
    [userId, from],
  );
  const map = new Map<string, { income: number; expense: number }>();
  for (let index = 0; index < months; index += 1) {
    const date = new Date(`${start}T12:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() - (months - 1 - index));
    map.set(date.toISOString().slice(0, 7), { income: 0, expense: 0 });
  }
  for (const row of rows) {
    const entry = map.get(row.month);
    if (!entry) continue;
    if (row.type === "income") entry.income += Number(row.total ?? 0);
    else entry.expense += Number(row.total ?? 0);
  }
  const formatter = new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" });
  return [...map.entries()].map(([month, value]) => ({
    month,
    label: formatter.format(new Date(`${month}-01T12:00:00.000Z`)),
    incomeMinor: value.income,
    expenseMinor: value.expense,
    balanceMinor: value.income - value.expense,
  }));
}

export interface MerchantRow {
  merchant: string;
  totalMinor: number;
  count: number;
}

export async function merchantTotals(userId: string, from: string, to: string, limit = 10): Promise<MerchantRow[]> {
  const db = await getDb();
  const rows = await db.all<{ merchant: string; total: number | string | null; count: number | string }>(
    `SELECT merchant, SUM(base_amount_minor) AS total, COUNT(*) AS count FROM transactions
     WHERE user_id = ? AND deleted_at IS NULL AND type = 'expense' AND merchant IS NOT NULL AND merchant <> ''
       AND occurred_date >= ? AND occurred_date <= ?
     GROUP BY merchant ORDER BY total DESC LIMIT ?`,
    [userId, from, to, limit],
  );
  return rows.map((row) => ({ merchant: row.merchant, totalMinor: Number(row.total ?? 0), count: Number(row.count) }));
}

export interface PaymentMethodRow {
  method: string;
  totalMinor: number;
  count: number;
}

export async function paymentMethodTotals(userId: string, from: string, to: string): Promise<PaymentMethodRow[]> {
  const db = await getDb();
  const rows = await db.all<{ method: string | null; total: number | string | null; count: number | string }>(
    `SELECT payment_method AS method, SUM(base_amount_minor) AS total, COUNT(*) AS count FROM transactions
     WHERE user_id = ? AND deleted_at IS NULL AND type = 'expense' AND occurred_date >= ? AND occurred_date <= ?
     GROUP BY payment_method ORDER BY total DESC`,
    [userId, from, to],
  );
  return rows.map((row) => ({
    method: row.method ?? "Sin especificar",
    totalMinor: Number(row.total ?? 0),
    count: Number(row.count),
  }));
}

export interface StatisticsData {
  range: { from: string; to: string; label: string };
  spentMinor: number;
  incomeMinor: number;
  savingsRate: number;
  averageTicketMinor: number;
  transactionCount: number;
  monthly: MonthlyPoint[];
  categories: DashboardData["categories"];
  merchants: MerchantRow[];
  paymentMethods: PaymentMethodRow[];
  largestTransactions: TransactionWithRelations[];
}

export async function getStatistics(
  userId: string,
  preset: PeriodPreset = "month",
  custom?: { from?: string; to?: string },
): Promise<StatisticsData> {
  const range = periodRange(preset, todayISO(), custom);
  const [current, categories, merchants, paymentMethods, monthly, largest] = await Promise.all([
    totals(userId, range.from, range.to),
    categoryTotals(userId, range.from, range.to),
    merchantTotals(userId, range.from, range.to),
    paymentMethodTotals(userId, range.from, range.to),
    monthlySeries(userId, 12),
    listTransactions(userId, { from: range.from, to: range.to, limit: 5, type: "expense" }),
  ]);
  const savingsRate = current.income > 0 ? Math.round(((current.income - current.spent) / current.income) * 1000) / 10 : 0;
  return {
    range,
    spentMinor: current.spent,
    incomeMinor: current.income,
    savingsRate,
    averageTicketMinor: current.count > 0 ? Math.round(current.spent / current.count) : 0,
    transactionCount: current.count,
    monthly,
    categories,
    merchants,
    paymentMethods,
    largestTransactions: largest,
  };
}
