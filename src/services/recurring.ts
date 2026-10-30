import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { addFrequency, type Frequency } from "@/lib/dates";
import { createTransaction } from "@/services/transactions";
import { logAudit } from "@/lib/audit";
import type { RecurringTransaction } from "@/types";

export interface RecurringInputData {
  name: string;
  type: "expense" | "income";
  amountMinor: number;
  currency: string;
  categoryId?: string | null;
  accountId?: string | null;
  frequency: Frequency;
  intervalCount?: number;
  startDate: string;
  endDate?: string | null;
  nextRunDate: string;
  paymentMethod?: string | null;
  autoPost?: boolean;
}

export async function listRecurring(userId: string): Promise<RecurringTransaction[]> {
  const db = await getDb();
  return db.all<RecurringTransaction>(
    "SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY active DESC, next_run_date, name",
    [userId],
  );
}

export async function getRecurring(userId: string, id: string): Promise<RecurringTransaction | null> {
  const db = await getDb();
  return (
    (await db.get<RecurringTransaction>("SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?", [
      id,
      userId,
    ])) ?? null
  );
}

export async function createRecurring(userId: string, input: RecurringInputData): Promise<RecurringTransaction> {
  const db = await getDb();
  const recurring: RecurringTransaction = {
    id: randomUUID(),
    user_id: userId,
    name: input.name.trim(),
    type: input.type,
    amount_minor: Math.abs(input.amountMinor),
    currency: input.currency as RecurringTransaction["currency"],
    category_id: input.categoryId ?? null,
    account_id: input.accountId ?? null,
    frequency: input.frequency,
    interval_count: Math.max(1, input.intervalCount ?? 1),
    start_date: input.startDate,
    end_date: input.endDate ?? null,
    next_run_date: input.nextRunDate,
    payment_method: input.paymentMethod?.trim() || null,
    active: 1,
    auto_post: input.autoPost === false ? 0 : 1,
    created_at: new Date().toISOString(),
  };
  await db.run(
    `INSERT INTO recurring_transactions (id, user_id, name, type, amount_minor, currency, category_id, account_id, frequency,
     interval_count, start_date, end_date, next_run_date, payment_method, active, auto_post, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      recurring.id,
      recurring.user_id,
      recurring.name,
      recurring.type,
      recurring.amount_minor,
      recurring.currency,
      recurring.category_id,
      recurring.account_id,
      recurring.frequency,
      recurring.interval_count,
      recurring.start_date,
      recurring.end_date,
      recurring.next_run_date,
      recurring.payment_method,
      recurring.auto_post,
      recurring.created_at,
    ],
  );
  await logAudit(userId, "create", "recurring_transaction", recurring.id);
  return recurring;
}

export async function updateRecurring(
  userId: string,
  id: string,
  input: Partial<RecurringInputData> & { active?: boolean },
): Promise<void> {
  const db = await getDb();
  const current = await getRecurring(userId, id);
  if (!current) throw new Error("Recurrencia no encontrada");
  await db.run(
    `UPDATE recurring_transactions SET name = ?, type = ?, amount_minor = ?, currency = ?, category_id = ?, account_id = ?,
     frequency = ?, interval_count = ?, start_date = ?, end_date = ?, next_run_date = ?, payment_method = ?, active = ?, auto_post = ?
     WHERE id = ? AND user_id = ?`,
    [
      input.name?.trim() || current.name,
      input.type ?? current.type,
      input.amountMinor !== undefined ? Math.abs(input.amountMinor) : current.amount_minor,
      input.currency ?? current.currency,
      input.categoryId === undefined ? current.category_id : input.categoryId,
      input.accountId === undefined ? current.account_id : input.accountId,
      input.frequency ?? current.frequency,
      input.intervalCount !== undefined ? Math.max(1, input.intervalCount) : current.interval_count,
      input.startDate ?? current.start_date,
      input.endDate === undefined ? current.end_date : input.endDate,
      input.nextRunDate ?? current.next_run_date,
      input.paymentMethod === undefined ? current.payment_method : input.paymentMethod?.trim() || null,
      input.active === undefined ? current.active : input.active ? 1 : 0,
      input.autoPost === undefined ? current.auto_post : input.autoPost ? 1 : 0,
      id,
      userId,
    ],
  );
  await logAudit(userId, "update", "recurring_transaction", id);
}

export async function deleteRecurring(userId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?", [id, userId]);
  await logAudit(userId, "delete", "recurring_transaction", id);
}

export interface RunResult {
  created: number;
  scheduled: number;
  skipped: number;
  errors: string[];
}

export async function runDueRecurring(userId: string, today: string): Promise<RunResult> {
  const db = await getDb();
  const rows = await db.all<RecurringTransaction>(
    "SELECT * FROM recurring_transactions WHERE user_id = ? AND active = 1 AND next_run_date <= ? ORDER BY next_run_date",
    [userId, today],
  );
  const result: RunResult = { created: 0, scheduled: 0, skipped: 0, errors: [] };
  for (const recurring of rows) {
    let next = recurring.next_run_date;
    let guard = 0;
    while (next <= today && guard < 36) {
      guard += 1;
      if (recurring.end_date && next > recurring.end_date) {
        await db.run("UPDATE recurring_transactions SET active = 0 WHERE id = ? AND user_id = ?", [recurring.id, userId]);
        break;
      }
      try {
        if (recurring.auto_post) {
          const created = await createTransaction(userId, {
            type: recurring.type,
            amountMinor: recurring.amount_minor,
            currency: recurring.currency,
            description: recurring.name,
            categoryId: recurring.category_id,
            accountId: recurring.account_id,
            occurredDate: next,
            paymentMethod: recurring.payment_method,
            source: "recurring",
            externalId: `recurring:${recurring.id}:${next}`,
          });
          if (created.duplicateOf === created.transaction.id) {
            result.skipped += 1;
          } else {
            result.created += 1;
          }
        } else {
          const existing = await db.get<{ id: string }>(
            "SELECT id FROM scheduled_payments WHERE user_id = ? AND recurring_id = ? AND due_date = ? LIMIT 1",
            [userId, recurring.id, next],
          );
          if (!existing) {
            await db.run(
              `INSERT INTO scheduled_payments (id, user_id, name, amount_minor, currency, due_date, category_id, status, priority, recurring_id, notes, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'normal', ?, NULL, ?)`,
              [
                randomUUID(),
                userId,
                recurring.name,
                recurring.amount_minor,
                recurring.currency,
                next,
                recurring.category_id,
                recurring.id,
                new Date().toISOString(),
              ],
            );
            result.scheduled += 1;
          } else {
            result.skipped += 1;
          }
        }
      } catch (error) {
        result.errors.push(
          `${recurring.name} (${next}): ${error instanceof Error ? error.message : "error desconocido"}`,
        );
      }
      next = addFrequency(next, recurring.frequency, recurring.interval_count);
    }
    const active = recurring.end_date && next > recurring.end_date ? 0 : 1;
    await db.run("UPDATE recurring_transactions SET next_run_date = ?, active = ? WHERE id = ? AND user_id = ?", [
      next,
      active,
      recurring.id,
      userId,
    ]);
  }
  if (result.created + result.scheduled > 0) {
    await logAudit(userId, "run", "recurring_transaction", null, {
      created: result.created,
      scheduled: result.scheduled,
      skipped: result.skipped,
    });
  }
  return result;
}

export async function runDueRecurringForAllUsers(today: string): Promise<RunResult> {
  const db = await getDb();
  const users = await db.all<{ id: string }>("SELECT id FROM users");
  const total: RunResult = { created: 0, scheduled: 0, skipped: 0, errors: [] };
  for (const user of users) {
    const result = await runDueRecurring(user.id, today);
    total.created += result.created;
    total.scheduled += result.scheduled;
    total.skipped += result.skipped;
    total.errors.push(...result.errors);
  }
  return total;
}
