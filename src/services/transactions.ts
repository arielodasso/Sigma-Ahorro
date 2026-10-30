import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { transactionFingerprint } from "@/lib/fingerprint";
import { getPreferences } from "@/services/users";
import { convertToBase, ensureRate } from "@/services/currency";
import { learnClassification } from "@/services/categories";
import { logAudit } from "@/lib/audit";
import type { Transaction, TransactionSource, TransactionType, TransactionWithRelations } from "@/types";

export interface CreateTransactionData {
  type: TransactionType;
  amountMinor: number;
  currency: string;
  description: string;
  merchant?: string | null;
  categoryId?: string | null;
  occurredDate: string;
  paymentMethod?: string | null;
  accountId?: string | null;
  notes?: string | null;
  tags?: string[];
  source?: TransactionSource;
  attachmentId?: string | null;
  externalId?: string | null;
  status?: "posted" | "pending";
  learnRule?: boolean;
}

export interface CreateTransactionResult {
  transaction: Transaction;
  duplicateOf: string | null;
}

export interface TransactionFilters {
  type?: TransactionType;
  categoryId?: string;
  accountId?: string;
  from?: string;
  to?: string;
  search?: string;
  source?: string;
  limit?: number;
  offset?: number;
}

function occurredAt(date: string): string {
  return `${date}T12:00:00.000Z`;
}

async function ensureTags(userId: string, names: string[]): Promise<string[]> {
  const db = await getDb();
  const ids: string[] = [];
  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;
    const existing = await db.get<{ id: string }>(
      "SELECT id FROM tags WHERE user_id = ? AND LOWER(name) = LOWER(?)",
      [userId, name],
    );
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const id = randomUUID();
    await db.run("INSERT INTO tags (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)", [
      id,
      userId,
      name,
      "#64748B",
      new Date().toISOString(),
    ]);
    ids.push(id);
  }
  return ids;
}

export async function createTransaction(
  userId: string,
  data: CreateTransactionData,
): Promise<CreateTransactionResult> {
  if (!Number.isFinite(data.amountMinor) || data.amountMinor === 0) {
    throw new Error("El importe debe ser distinto de cero");
  }
  const db = await getDb();
  const prefs = await getPreferences(userId);
  await ensureRate(userId, prefs.primary_currency, data.currency);
  const conversion = await convertToBase(userId, Math.abs(data.amountMinor), data.currency, prefs.primary_currency);
  const fingerprint = transactionFingerprint({
    date: data.occurredDate,
    amountMinor: data.amountMinor,
    currency: data.currency,
    description: data.description,
  });

  if (data.externalId) {
    const existingExternal = await db.get<Transaction>(
      "SELECT * FROM transactions WHERE user_id = ? AND external_id = ? LIMIT 1",
      [userId, data.externalId],
    );
    if (existingExternal) return { transaction: existingExternal, duplicateOf: existingExternal.id };
  }

  const duplicate = await db.get<{ id: string }>(
    "SELECT id FROM transactions WHERE user_id = ? AND fingerprint = ? AND deleted_at IS NULL LIMIT 1",
    [userId, fingerprint],
  );

  const now = new Date().toISOString();
  const transaction: Transaction = {
    id: randomUUID(),
    user_id: userId,
    account_id: data.accountId ?? null,
    type: data.type,
    amount_minor: Math.abs(data.amountMinor),
    currency: data.currency as Transaction["currency"],
    exchange_rate_scaled: conversion.rateScaled,
    base_amount_minor: conversion.baseMinor,
    description: data.description.trim(),
    merchant: data.merchant?.trim() || null,
    category_id: data.categoryId ?? null,
    occurred_at: occurredAt(data.occurredDate),
    occurred_date: data.occurredDate,
    payment_method: data.paymentMethod?.trim() || null,
    notes: data.notes?.trim() || null,
    source: data.source ?? "manual",
    status: data.status ?? "posted",
    external_id: data.externalId ?? null,
    fingerprint,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  };

  const tagIds = data.tags?.length ? await ensureTags(userId, data.tags) : [];

  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO transactions (id, user_id, account_id, type, amount_minor, currency, exchange_rate_scaled, base_amount_minor,
       description, merchant, category_id, occurred_at, occurred_date, payment_method, notes, source, status, external_id,
       fingerprint, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transaction.id,
        transaction.user_id,
        transaction.account_id,
        transaction.type,
        transaction.amount_minor,
        transaction.currency,
        transaction.exchange_rate_scaled,
        transaction.base_amount_minor,
        transaction.description,
        transaction.merchant,
        transaction.category_id,
        transaction.occurred_at,
        transaction.occurred_date,
        transaction.payment_method,
        transaction.notes,
        transaction.source,
        transaction.status,
        transaction.external_id,
        transaction.fingerprint,
        transaction.created_at,
        transaction.updated_at,
      ],
    );
    for (const tagId of tagIds) {
      await tx.run("INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)", [transaction.id, tagId]);
    }
    if (data.attachmentId) {
      await tx.run("UPDATE attachments SET transaction_id = ? WHERE id = ? AND user_id = ?", [
        transaction.id,
        data.attachmentId,
        userId,
      ]);
    }
  });

  if (data.learnRule && transaction.category_id) {
    await learnClassification(userId, transaction.description, transaction.merchant, transaction.category_id);
  }
  await logAudit(userId, "create", "transaction", transaction.id, {
    source: transaction.source,
    currency: transaction.currency,
    hasBase: transaction.base_amount_minor !== null,
  });

  return { transaction, duplicateOf: duplicate?.id ?? null };
}

export interface UpdateTransactionData extends Partial<Omit<CreateTransactionData, "source" | "attachmentId">> {
  learnRule?: boolean;
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  data: UpdateTransactionData,
): Promise<Transaction> {
  const db = await getDb();
  const current = await getTransaction(userId, transactionId);
  if (!current) throw new Error("Movimiento no encontrado");
  const prefs = await getPreferences(userId);

  const amountMinor = data.amountMinor !== undefined ? Math.abs(data.amountMinor) : current.amount_minor;
  const currency = data.currency ?? current.currency;
  const occurredDate = data.occurredDate ?? current.occurred_date;
  const description = data.description?.trim() ?? current.description;
  const type = data.type ?? current.type;

  await ensureRate(userId, prefs.primary_currency, currency);
  const conversion = await convertToBase(userId, amountMinor, currency, prefs.primary_currency);
  const fingerprint = transactionFingerprint({
    date: occurredDate,
    amountMinor,
    currency,
    description,
  });

  const updated: Transaction = {
    ...current,
    account_id: data.accountId === undefined ? current.account_id : data.accountId,
    type,
    amount_minor: amountMinor,
    currency: currency as Transaction["currency"],
    exchange_rate_scaled: conversion.rateScaled,
    base_amount_minor: conversion.baseMinor,
    description,
    merchant: data.merchant === undefined ? current.merchant : data.merchant?.trim() || null,
    category_id: data.categoryId === undefined ? current.category_id : data.categoryId,
    occurred_at: occurredAt(occurredDate),
    occurred_date: occurredDate,
    payment_method: data.paymentMethod === undefined ? current.payment_method : data.paymentMethod?.trim() || null,
    notes: data.notes === undefined ? current.notes : data.notes?.trim() || null,
    fingerprint,
    updated_at: new Date().toISOString(),
  };

  const tagIds = data.tags ? await ensureTags(userId, data.tags) : null;

  await db.transaction(async (tx) => {
    await tx.run(
      `UPDATE transactions SET account_id = ?, type = ?, amount_minor = ?, currency = ?, exchange_rate_scaled = ?,
       base_amount_minor = ?, description = ?, merchant = ?, category_id = ?, occurred_at = ?, occurred_date = ?,
       payment_method = ?, notes = ?, fingerprint = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      [
        updated.account_id,
        updated.type,
        updated.amount_minor,
        updated.currency,
        updated.exchange_rate_scaled,
        updated.base_amount_minor,
        updated.description,
        updated.merchant,
        updated.category_id,
        updated.occurred_at,
        updated.occurred_date,
        updated.payment_method,
        updated.notes,
        updated.fingerprint,
        updated.updated_at,
        transactionId,
        userId,
      ],
    );
    if (tagIds) {
      await tx.run("DELETE FROM transaction_tags WHERE transaction_id = ?", [transactionId]);
      for (const tagId of tagIds) {
        await tx.run("INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)", [transactionId, tagId]);
      }
    }
  });

  if (data.learnRule && updated.category_id) {
    await learnClassification(userId, updated.description, updated.merchant, updated.category_id);
  }
  await logAudit(userId, "update", "transaction", transactionId);
  return updated;
}

export async function deleteTransaction(userId: string, transactionId: string): Promise<void> {
  const db = await getDb();
  const current = await getTransaction(userId, transactionId);
  if (!current) throw new Error("Movimiento no encontrado");
  await db.run("UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?", [
    new Date().toISOString(),
    new Date().toISOString(),
    transactionId,
    userId,
  ]);
  await logAudit(userId, "delete", "transaction", transactionId);
}

export async function getTransaction(userId: string, transactionId: string): Promise<Transaction | null> {
  const db = await getDb();
  return (
    (await db.get<Transaction>("SELECT * FROM transactions WHERE id = ? AND user_id = ? AND deleted_at IS NULL", [
      transactionId,
      userId,
    ])) ?? null
  );
}

export async function getTransactionWithRelations(
  userId: string,
  transactionId: string,
): Promise<TransactionWithRelations | null> {
  const db = await getDb();
  const row = await db.get<TransactionWithRelations>(
    `SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon, a.name AS account_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts a ON a.id = t.account_id
     WHERE t.id = ? AND t.user_id = ? AND t.deleted_at IS NULL`,
    [transactionId, userId],
  );
  return row ?? null;
}

function buildFilters(userId: string, filters: TransactionFilters): { where: string; params: unknown[] } {
  const clauses = ["t.user_id = ?", "t.deleted_at IS NULL"];
  const params: unknown[] = [userId];
  if (filters.type) {
    clauses.push("t.type = ?");
    params.push(filters.type);
  }
  if (filters.categoryId) {
    clauses.push("t.category_id = ?");
    params.push(filters.categoryId);
  }
  if (filters.accountId) {
    clauses.push("t.account_id = ?");
    params.push(filters.accountId);
  }
  if (filters.from) {
    clauses.push("t.occurred_date >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push("t.occurred_date <= ?");
    params.push(filters.to);
  }
  if (filters.source) {
    clauses.push("t.source = ?");
    params.push(filters.source);
  }
  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`;
    clauses.push("(LOWER(t.description) LIKE ? OR LOWER(COALESCE(t.merchant, '')) LIKE ? OR LOWER(COALESCE(t.notes, '')) LIKE ?)");
    params.push(term, term, term);
  }
  return { where: clauses.join(" AND "), params };
}

export async function listTransactions(
  userId: string,
  filters: TransactionFilters = {},
): Promise<TransactionWithRelations[]> {
  const db = await getDb();
  const { where, params } = buildFilters(userId, filters);
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);
  return db.all<TransactionWithRelations>(
    `SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon, a.name AS account_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts a ON a.id = t.account_id
     WHERE ${where}
     ORDER BY t.occurred_date DESC, t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
}

export async function countTransactions(userId: string, filters: TransactionFilters = {}): Promise<number> {
  const db = await getDb();
  const { where, params } = buildFilters(userId, filters);
  const row = await db.get<{ count: number | string }>(`SELECT COUNT(*) AS count FROM transactions t WHERE ${where}`, params);
  return Number(row?.count ?? 0);
}

export async function transactionTags(userId: string, transactionIds: string[]): Promise<Record<string, string[]>> {
  if (transactionIds.length === 0) return {};
  const db = await getDb();
  const placeholders = transactionIds.map(() => "?").join(", ");
  const rows = await db.all<{ transaction_id: string; name: string }>(
    `SELECT tt.transaction_id, tg.name FROM transaction_tags tt
     JOIN tags tg ON tg.id = tt.tag_id
     JOIN transactions t ON t.id = tt.transaction_id
     WHERE t.user_id = ? AND tt.transaction_id IN (${placeholders})`,
    [userId, ...transactionIds],
  );
  const result: Record<string, string[]> = {};
  for (const row of rows) {
    (result[row.transaction_id] ??= []).push(row.name);
  }
  return result;
}

export async function recentMerchants(userId: string, limit = 12): Promise<Array<{ merchant: string; count: number }>> {
  const db = await getDb();
  const rows = await db.all<{ merchant: string; count: number | string }>(
    `SELECT merchant, COUNT(*) AS count FROM transactions
     WHERE user_id = ? AND deleted_at IS NULL AND merchant IS NOT NULL AND merchant <> ''
     GROUP BY merchant ORDER BY count DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map((row) => ({ merchant: row.merchant, count: Number(row.count) }));
}
