import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from "@/lib/money";
import type { ExchangeRate } from "@/types";

const SCALE = 1_000_000;

export async function latestRate(
  userId: string,
  base: string,
  quote: string,
): Promise<ExchangeRate | null> {
  if (base === quote) {
    return {
      id: "identity",
      user_id: userId,
      base_currency: base as CurrencyCode,
      quote_currency: quote as CurrencyCode,
      rate_scaled: SCALE,
      source: "identity",
      fetched_at: new Date(0).toISOString(),
    };
  }
  const db = await getDb();
  const direct = await db.get<ExchangeRate>(
    `SELECT * FROM exchange_rates WHERE base_currency = ? AND quote_currency = ? AND (user_id = ? OR user_id IS NULL)
     ORDER BY CASE WHEN user_id = ? THEN 0 ELSE 1 END, fetched_at DESC LIMIT 1`,
    [base, quote, userId, userId],
  );
  if (direct) return direct;
  const inverse = await db.get<ExchangeRate>(
    `SELECT * FROM exchange_rates WHERE base_currency = ? AND quote_currency = ? AND (user_id = ? OR user_id IS NULL)
     ORDER BY CASE WHEN user_id = ? THEN 0 ELSE 1 END, fetched_at DESC LIMIT 1`,
    [quote, base, userId, userId],
  );
  if (inverse && inverse.rate_scaled > 0) {
    return {
      ...inverse,
      base_currency: base as CurrencyCode,
      quote_currency: quote as CurrencyCode,
      rate_scaled: Math.round((SCALE * SCALE) / inverse.rate_scaled),
      source: `${inverse.source} (inversa)`,
    };
  }
  return null;
}

export async function convertToBase(
  userId: string,
  amountMinor: number,
  currency: string,
  primaryCurrency: string,
): Promise<{ baseMinor: number | null; rateScaled: number | null; source: string | null }> {
  if (currency === primaryCurrency) {
    return { baseMinor: amountMinor, rateScaled: SCALE, source: "identity" };
  }
  const rate = await latestRate(userId, currency, primaryCurrency);
  if (!rate) return { baseMinor: null, rateScaled: null, source: null };
  return {
    baseMinor: Math.round((amountMinor * rate.rate_scaled) / SCALE),
    rateScaled: rate.rate_scaled,
    source: rate.source,
  };
}

export async function setRate(
  userId: string,
  base: string,
  quote: string,
  rateScaled: number,
  source = "manual",
): Promise<void> {
  if (!Number.isFinite(rateScaled) || rateScaled <= 0) throw new Error("La cotización debe ser mayor a cero");
  if (base === quote) return;
  const db = await getDb();
  await db.run(
    "INSERT INTO exchange_rates (id, user_id, base_currency, quote_currency, rate_scaled, source, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [randomUUID(), userId, base, quote, Math.round(rateScaled), source, new Date().toISOString()],
  );
}

export async function listRates(userId: string, primaryCurrency: string): Promise<ExchangeRate[]> {
  const db = await getDb();
  const rows = await db.all<ExchangeRate>(
    `SELECT * FROM exchange_rates WHERE (user_id = ? OR user_id IS NULL) ORDER BY fetched_at DESC`,
    [userId],
  );
  const seen = new Set<string>();
  const result: ExchangeRate[] = [];
  for (const row of rows) {
    const key = `${row.base_currency}:${row.quote_currency}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (row.base_currency === primaryCurrency) continue;
    result.push(row);
  }
  return result;
}

export async function refreshRates(userId: string, primaryCurrency: string): Promise<number> {
  let payload: { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(primaryCurrency)}`, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Proveedor de cotizaciones respondió ${response.status}`);
    payload = (await response.json()) as typeof payload;
  } catch (error) {
    throw new Error(
      `No se pudieron obtener cotizaciones automáticas: ${error instanceof Error ? error.message : "error de red"}`,
    );
  }
  if (payload.result !== "success" || !payload.rates) {
    throw new Error("El proveedor de cotizaciones devolvió una respuesta inválida");
  }
  const db = await getDb();
  const now = new Date().toISOString();
  let stored = 0;
  for (const code of CURRENCY_CODES) {
    if (code === primaryCurrency) continue;
    const value = payload.rates[code];
    if (!value || value <= 0) continue;
    const rateScaled = Math.round(SCALE / value);
    if (!Number.isFinite(rateScaled) || rateScaled <= 0) continue;
    await db.run(
      "INSERT INTO exchange_rates (id, user_id, base_currency, quote_currency, rate_scaled, source, fetched_at) VALUES (?, NULL, ?, ?, ?, ?, ?)",
      [randomUUID(), code, primaryCurrency, rateScaled, "open.er-api.com", now],
    );
    stored += 1;
  }
  if (stored === 0) throw new Error("No se encontraron cotizaciones para las monedas configuradas");
  return stored;
}

export async function ensureRate(userId: string, primaryCurrency: string, currency: string): Promise<void> {
  if (currency === primaryCurrency) return;
  const rate = await latestRate(userId, currency, primaryCurrency);
  if (rate) return;
  try {
    await refreshRates(userId, primaryCurrency);
  } catch {
    // Sin red: la transacción se guarda sin equivalente en moneda principal.
  }
}

export function currencyName(code: string): string {
  const info = CURRENCIES[code as CurrencyCode];
  return info ? `${info.name} (${info.symbol})` : code;
}
