import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { debtBalance } from "@/lib/finance";
import { logAudit } from "@/lib/audit";
import type { Debt, DebtPayment, DebtWithBalance } from "@/types";

export interface DebtInputData {
  direction: "owed_by_me" | "owed_to_me";
  counterparty: string;
  description: string;
  amountMinor: number;
  currency: string;
  originDate: string;
  dueDate?: string | null;
  installments?: number | null;
}

export interface DebtView extends DebtWithBalance {
  progress: number;
  dueInDays: number | null;
  overdue: boolean;
}

export async function listDebts(userId: string, status?: string): Promise<DebtWithBalance[]> {
  const db = await getDb();
  const params: unknown[] = [userId];
  let statusClause = "";
  if (status) {
    statusClause = " AND d.status = ?";
    params.push(status);
  }
  const debts = await db.all<Debt>(
    `SELECT d.* FROM debts d WHERE d.user_id = ?${statusClause} ORDER BY d.created_at DESC`,
    params,
  );
  const result: DebtWithBalance[] = [];
  for (const debt of debts) {
    const row = await db.get<{ paid: number | string | null }>(
      "SELECT SUM(amount_minor) AS paid FROM debt_payments WHERE debt_id = ? AND user_id = ?",
      [debt.id, userId],
    );
    const paid = Number(row?.paid ?? 0);
    result.push({ ...debt, paid_minor: paid, balance_minor: debtBalance(debt.amount_minor, [paid]) });
  }
  return result;
}

export async function listDebtViews(userId: string, today: string, status?: string): Promise<DebtView[]> {
  const debts = await listDebts(userId, status);
  return debts.map((debt) => {
    const dueInDays = debt.due_date
      ? Math.ceil((Date.parse(debt.due_date) - Date.parse(today)) / 86_400_000)
      : null;
    return {
      ...debt,
      progress: debt.amount_minor > 0 ? Math.min(100, Math.round((debt.paid_minor / debt.amount_minor) * 1000) / 10) : 0,
      dueInDays,
      overdue: debt.status !== "paid" && debt.status !== "cancelled" && dueInDays !== null && dueInDays < 0,
    };
  });
}

export async function getDebt(userId: string, debtId: string): Promise<Debt | null> {
  const db = await getDb();
  return (await db.get<Debt>("SELECT * FROM debts WHERE id = ? AND user_id = ?", [debtId, userId])) ?? null;
}

export async function createDebt(userId: string, input: DebtInputData): Promise<Debt> {
  const db = await getDb();
  const debt: Debt = {
    id: randomUUID(),
    user_id: userId,
    direction: input.direction,
    counterparty: input.counterparty.trim(),
    description: input.description.trim(),
    amount_minor: Math.abs(input.amountMinor),
    currency: input.currency as Debt["currency"],
    origin_date: input.originDate,
    due_date: input.dueDate ?? null,
    installments: input.installments ?? null,
    status: "open",
    created_at: new Date().toISOString(),
  };
  await db.run(
    `INSERT INTO debts (id, user_id, direction, counterparty, description, amount_minor, currency, origin_date, due_date, installments, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [
      debt.id,
      debt.user_id,
      debt.direction,
      debt.counterparty,
      debt.description,
      debt.amount_minor,
      debt.currency,
      debt.origin_date,
      debt.due_date,
      debt.installments,
      debt.created_at,
    ],
  );
  await logAudit(userId, "create", "debt", debt.id);
  return debt;
}

export async function updateDebt(
  userId: string,
  debtId: string,
  input: Partial<DebtInputData> & { status?: Debt["status"] },
): Promise<void> {
  const db = await getDb();
  const current = await getDebt(userId, debtId);
  if (!current) throw new Error("Deuda no encontrada");
  await db.run(
    `UPDATE debts SET direction = ?, counterparty = ?, description = ?, amount_minor = ?, currency = ?, origin_date = ?,
     due_date = ?, installments = ?, status = ? WHERE id = ? AND user_id = ?`,
    [
      input.direction ?? current.direction,
      input.counterparty?.trim() || current.counterparty,
      input.description?.trim() || current.description,
      input.amountMinor !== undefined ? Math.abs(input.amountMinor) : current.amount_minor,
      input.currency ?? current.currency,
      input.originDate ?? current.origin_date,
      input.dueDate === undefined ? current.due_date : input.dueDate,
      input.installments === undefined ? current.installments : input.installments,
      input.status ?? current.status,
      debtId,
      userId,
    ],
  );
  await logAudit(userId, "update", "debt", debtId);
}

export async function deleteDebt(userId: string, debtId: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM debts WHERE id = ? AND user_id = ?", [debtId, userId]);
  await logAudit(userId, "delete", "debt", debtId);
}

export async function addDebtPayment(
  userId: string,
  input: { debtId: string; amountMinor: number; paidAt: string; note?: string | null },
): Promise<DebtPayment> {
  const db = await getDb();
  const debt = await getDebt(userId, input.debtId);
  if (!debt) throw new Error("Deuda no encontrada");
  const payment: DebtPayment = {
    id: randomUUID(),
    debt_id: input.debtId,
    user_id: userId,
    amount_minor: Math.abs(input.amountMinor),
    paid_at: input.paidAt,
    note: input.note?.trim() || null,
    created_at: new Date().toISOString(),
  };
  await db.transaction(async (tx) => {
    await tx.run(
      "INSERT INTO debt_payments (id, debt_id, user_id, amount_minor, paid_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [payment.id, payment.debt_id, payment.user_id, payment.amount_minor, payment.paid_at, payment.note, payment.created_at],
    );
    const row = await tx.get<{ paid: number | string | null }>(
      "SELECT SUM(amount_minor) AS paid FROM debt_payments WHERE debt_id = ? AND user_id = ?",
      [input.debtId, userId],
    );
    const paid = Number(row?.paid ?? 0);
    const status = paid >= debt.amount_minor ? "paid" : paid > 0 ? "partial" : "open";
    await tx.run("UPDATE debts SET status = ? WHERE id = ? AND user_id = ?", [status, input.debtId, userId]);
  });
  await logAudit(userId, "payment", "debt", input.debtId);
  return payment;
}

export async function listDebtPayments(userId: string, debtId: string): Promise<DebtPayment[]> {
  const db = await getDb();
  return db.all<DebtPayment>(
    "SELECT * FROM debt_payments WHERE debt_id = ? AND user_id = ? ORDER BY paid_at DESC, created_at DESC",
    [debtId, userId],
  );
}

export async function deleteDebtPayment(userId: string, paymentId: string): Promise<void> {
  const db = await getDb();
  const payment = await db.get<DebtPayment>("SELECT * FROM debt_payments WHERE id = ? AND user_id = ?", [
    paymentId,
    userId,
  ]);
  if (!payment) return;
  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM debt_payments WHERE id = ? AND user_id = ?", [paymentId, userId]);
    const row = await tx.get<{ paid: number | string | null }>(
      "SELECT SUM(amount_minor) AS paid FROM debt_payments WHERE debt_id = ? AND user_id = ?",
      [payment.debt_id, userId],
    );
    const debt = await tx.get<Debt>("SELECT * FROM debts WHERE id = ? AND user_id = ?", [payment.debt_id, userId]);
    if (debt) {
      const paid = Number(row?.paid ?? 0);
      const status = paid >= debt.amount_minor ? "paid" : paid > 0 ? "partial" : "open";
      await tx.run("UPDATE debts SET status = ? WHERE id = ? AND user_id = ?", [status, debt.id, userId]);
    }
  });
}
