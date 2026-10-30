import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { createTransaction } from "@/services/transactions";
import { logAudit } from "@/lib/audit";
import type { ScheduledPayment } from "@/types";

export interface ScheduledInputData {
  name: string;
  amountMinor: number;
  currency: string;
  dueDate: string;
  categoryId?: string | null;
  priority?: "low" | "normal" | "high";
  notes?: string | null;
}

export interface ScheduledView extends ScheduledPayment {
  daysUntil: number;
  overdue: boolean;
}

export async function listScheduled(userId: string, includePaid = false): Promise<ScheduledPayment[]> {
  const db = await getDb();
  const where = includePaid ? "" : " AND status = 'pending'";
  return db.all<ScheduledPayment>(
    `SELECT * FROM scheduled_payments WHERE user_id = ?${where} ORDER BY due_date, priority DESC`,
    [userId],
  );
}

export async function listScheduledViews(userId: string, today: string, includePaid = false): Promise<ScheduledView[]> {
  const rows = await listScheduled(userId, includePaid);
  return rows.map((row) => {
    const daysUntil = Math.ceil((Date.parse(row.due_date) - Date.parse(today)) / 86_400_000);
    return { ...row, daysUntil, overdue: row.status === "pending" && daysUntil < 0 };
  });
}

export async function upcomingPayments(userId: string, today: string, days = 30): Promise<ScheduledPayment[]> {
  const db = await getDb();
  const limit = new Date(`${today}T12:00:00.000Z`);
  limit.setUTCDate(limit.getUTCDate() + days);
  const limitDate = limit.toISOString().slice(0, 10);
  return db.all<ScheduledPayment>(
    `SELECT * FROM scheduled_payments WHERE user_id = ? AND status = 'pending' AND due_date >= ? AND due_date <= ?
     ORDER BY due_date, CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END`,
    [userId, today, limitDate],
  );
}

export async function createScheduled(userId: string, input: ScheduledInputData): Promise<ScheduledPayment> {
  const db = await getDb();
  const payment: ScheduledPayment = {
    id: randomUUID(),
    user_id: userId,
    name: input.name.trim(),
    amount_minor: Math.abs(input.amountMinor),
    currency: input.currency as ScheduledPayment["currency"],
    due_date: input.dueDate,
    category_id: input.categoryId ?? null,
    status: "pending",
    priority: input.priority ?? "normal",
    recurring_id: null,
    paid_at: null,
    notes: input.notes?.trim() || null,
    created_at: new Date().toISOString(),
  };
  await db.run(
    `INSERT INTO scheduled_payments (id, user_id, name, amount_minor, currency, due_date, category_id, status, priority, recurring_id, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?)`,
    [
      payment.id,
      payment.user_id,
      payment.name,
      payment.amount_minor,
      payment.currency,
      payment.due_date,
      payment.category_id,
      payment.priority,
      payment.notes,
      payment.created_at,
    ],
  );
  await logAudit(userId, "create", "scheduled_payment", payment.id);
  return payment;
}

export async function updateScheduled(
  userId: string,
  id: string,
  input: Partial<ScheduledInputData> & { status?: ScheduledPayment["status"] },
): Promise<void> {
  const db = await getDb();
  const current = await db.get<ScheduledPayment>(
    "SELECT * FROM scheduled_payments WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!current) throw new Error("Pago programado no encontrado");
  await db.run(
    `UPDATE scheduled_payments SET name = ?, amount_minor = ?, currency = ?, due_date = ?, category_id = ?, status = ?, priority = ?, notes = ?
     WHERE id = ? AND user_id = ?`,
    [
      input.name?.trim() || current.name,
      input.amountMinor !== undefined ? Math.abs(input.amountMinor) : current.amount_minor,
      input.currency ?? current.currency,
      input.dueDate ?? current.due_date,
      input.categoryId === undefined ? current.category_id : input.categoryId,
      input.status ?? current.status,
      input.priority ?? current.priority,
      input.notes === undefined ? current.notes : input.notes?.trim() || null,
      id,
      userId,
    ],
  );
  await logAudit(userId, "update", "scheduled_payment", id);
}

export async function markScheduledPaid(
  userId: string,
  id: string,
  paidAt: string,
  options: { createTransaction?: boolean; accountId?: string | null } = {},
): Promise<ScheduledPayment> {
  const db = await getDb();
  const current = await db.get<ScheduledPayment>(
    "SELECT * FROM scheduled_payments WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (!current) throw new Error("Pago programado no encontrado");
  if (current.status === "paid") return current;
  if (options.createTransaction !== false) {
    await createTransaction(userId, {
      type: "expense",
      amountMinor: current.amount_minor,
      currency: current.currency,
      description: current.name,
      categoryId: current.category_id,
      accountId: options.accountId ?? null,
      occurredDate: paidAt,
      source: "manual",
      notes: current.notes,
      externalId: `scheduled:${current.id}`,
    });
  }
  await db.run("UPDATE scheduled_payments SET status = 'paid', paid_at = ? WHERE id = ? AND user_id = ?", [
    paidAt,
    id,
    userId,
  ]);
  await logAudit(userId, "pay", "scheduled_payment", id);
  return { ...current, status: "paid", paid_at: paidAt };
}

export async function deleteScheduled(userId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM scheduled_payments WHERE id = ? AND user_id = ?", [id, userId]);
  await logAudit(userId, "delete", "scheduled_payment", id);
}
