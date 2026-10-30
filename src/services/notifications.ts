import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { NotificationRow } from "@/types";
import { listBudgetViews } from "@/services/budgets";
import { upcomingPayments } from "@/services/scheduled";
import { listDebtViews } from "@/services/debts";

export async function generateNotifications(userId: string): Promise<NotificationRow[]> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const result: NotificationRow[] = [];

  const budgets = await listBudgetViews(userId, today);
  for (const budget of budgets) {
    const pct = budget.amount_minor > 0 ? (budget.spent_minor / budget.amount_minor) * 100 : 0;
    if (pct >= 100) continue;
    if (pct >= 90) {
      const key = `budget_${budget.id}_${today}`;
      const exists = await db.get<{ id: string }>(
        "SELECT id FROM notifications WHERE user_id = ? AND kind = ? AND link = ? AND created_at >= ?",
        [userId, "budget_exceeded", key, today],
      );
      if (exists) continue;
      await db.run(
        "INSERT INTO notifications (id, user_id, kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [randomUUID(), userId, "budget_warning", `Presupuesto ${Math.round(pct)}%: ${budget.name}`,
          `Estás cerca del límite de ${budget.name}.`, `budget_${budget.id}`, today],
      );
      result.push({ id: randomUUID(), user_id: userId, kind: "budget_warning", title: `Presupuesto ${Math.round(pct)}%: ${budget.name}`,
        body: `Estás cerca del límite de ${budget.name}.`, link: `budget_${budget.id}`, created_at: today } as NotificationRow);
    }
  }

  const upcoming = await upcomingPayments(userId, today, 14);
  for (const payment of upcoming) {
    const days = Math.ceil((Date.parse(payment.due_date) - Date.parse(today)) / 86_400_000);
    if (days > 3 || days <= 0) continue;
    const kind = days < 0 ? "debt_due" : "payment_due";
    const key = kind === "payment_due" ? `payment_${payment.id}_${today}` : `debt_${payment.id}_${today}`;
    const exists = await db.get<{ id: string }>(
      "SELECT id FROM notifications WHERE user_id = ? AND kind = ? AND link = ? AND created_at >= ?",
      [userId, kind, key, today],
    );
    if (exists) continue;
    const title = days < 0 ? `Pago vencido: ${payment.name}` : `Pago próximo: ${payment.name}`;
    const body = days < 0 ? "Venció hace varios días." : days === 0 ? "Vence hoy." : `Vence en ${days} días.`;
    await db.run(
      "INSERT INTO notifications (id, user_id, kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [randomUUID(), userId, kind, title, body, key, today],
    );
    result.push({ id: randomUUID(), user_id: userId, kind, title, body, link: key, created_at: today } as NotificationRow);
  }

  const debts = await listDebtViews(userId, today);
  for (const debt of debts) {
    if (debt.overdue || (debt.dueInDays !== null && debt.dueInDays <= 7 && debt.status !== "paid" && debt.status !== "cancelled")) {
      const kind = debt.overdue ? "debt_overdue" : "debt_due";
      const key = `${debt.id}_${today}`;
      const exists = await db.get<{ id: string }>(
        "SELECT id FROM notifications WHERE user_id = ? AND kind = ? AND link = ? AND created_at >= ?",
        [userId, kind, key, today],
      );
      if (exists) continue;
      const title = debt.overdue ? "Deuda vencida" : `Deuda próxima: ${debt.counterparty}`;
      const body = debt.overdue ? "La deuda está vencida." : `Vence en ${debt.dueInDays} días.`;
      await db.run(
        "INSERT INTO notifications (id, user_id, kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [randomUUID(), userId, kind, title, body, key, today],
      );
      result.push({ id: randomUUID(), user_id: userId, kind, title, body, link: key, created_at: today } as NotificationRow);
    }
  }

  return result;
}

export async function listNotifications(userId: string, unreadOnly = true): Promise<NotificationRow[]> {
  const db = await getDb();
  const where = unreadOnly ? " AND read_at IS NULL" : "";
  return db.all<NotificationRow>(
    `SELECT * FROM notifications WHERE user_id = ? ${where} ORDER BY created_at DESC LIMIT 20`,
    [userId],
  );
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const db = await getDb();
  await db.run("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?", [new Date().toISOString(), notificationId, userId]);
}

export async function markAllRead(userId: string): Promise<void> {
  const db = await getDb();
  await db.run("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", [new Date().toISOString(), userId]);
}