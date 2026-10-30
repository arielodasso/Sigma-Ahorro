import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { Account } from "@/types";
import type { CurrencyCode } from "@/lib/money";

export async function listAccounts(userId: string): Promise<Account[]> {
  const db = await getDb();
  return db.all<Account>(
    "SELECT * FROM accounts WHERE user_id = ? AND archived = 0 ORDER BY sort_order, name",
    [userId],
  );
}

export async function getAccount(userId: string, accountId: string): Promise<Account | null> {
  const db = await getDb();
  return (await db.get<Account>("SELECT * FROM accounts WHERE id = ? AND user_id = ?", [accountId, userId])) ?? null;
}

export async function createAccount(
  userId: string,
  input: { name: string; type?: string; currency?: string; initialBalanceMinor?: number },
): Promise<Account> {
  const db = await getDb();
  const max = await db.get<{ max_order: number | null }>(
    "SELECT MAX(sort_order) AS max_order FROM accounts WHERE user_id = ?",
    [userId],
  );
  const account: Account = {
    id: randomUUID(),
    user_id: userId,
    name: input.name.trim(),
    type: input.type ?? "cash",
    currency: (input.currency as CurrencyCode) ?? "ARS",
    initial_balance_minor: input.initialBalanceMinor ?? 0,
    sort_order: Number(max?.max_order ?? 0) + 10,
    archived: 0,
    created_at: new Date().toISOString(),
  };
  await db.run(
    "INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, sort_order, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
    [
      account.id,
      account.user_id,
      account.name,
      account.type,
      account.currency,
      account.initial_balance_minor,
      account.sort_order,
      account.created_at,
    ],
  );
  return account;
}

export async function accountBalances(userId: string): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.all<{ account_id: string; total: number | string | null }>(
    `SELECT account_id, SUM(CASE WHEN type = 'income' THEN amount_minor ELSE -amount_minor END) AS total
     FROM transactions WHERE user_id = ? AND deleted_at IS NULL AND account_id IS NOT NULL GROUP BY account_id`,
    [userId],
  );
  const balances: Record<string, number> = {};
  for (const row of rows) balances[row.account_id] = Number(row.total ?? 0);
  return balances;
}
