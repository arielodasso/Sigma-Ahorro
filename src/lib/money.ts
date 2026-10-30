export const CURRENCY_CODES = ["ARS", "USD", "EUR", "BRL", "CLP", "UYU", "GBP", "JPY"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  symbol: string;
  decimals: number;
  locale: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  ARS: { code: "ARS", name: "Peso argentino", symbol: "$", decimals: 2, locale: "es-AR" },
  USD: { code: "USD", name: "Dólar estadounidense", symbol: "US$", decimals: 2, locale: "en-US" },
  EUR: { code: "EUR", name: "Euro", symbol: "€", decimals: 2, locale: "de-DE" },
  BRL: { code: "BRL", name: "Real brasileño", symbol: "R$", decimals: 2, locale: "pt-BR" },
  CLP: { code: "CLP", name: "Peso chileno", symbol: "CLP$", decimals: 0, locale: "es-CL" },
  UYU: { code: "UYU", name: "Peso uruguayo", symbol: "$U", decimals: 2, locale: "es-UY" },
  GBP: { code: "GBP", name: "Libra esterlina", symbol: "£", decimals: 2, locale: "en-GB" },
  JPY: { code: "JPY", name: "Yen japonés", symbol: "¥", decimals: 0, locale: "ja-JP" },
};

export const DEFAULT_CURRENCY: CurrencyCode = "ARS";
export const RATE_SCALE = 1_000_000;

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value);
}

export function currencyDecimals(currency: string): number {
  return isCurrencyCode(currency) ? CURRENCIES[currency].decimals : 2;
}

/**
 * Convierte un importe escrito por una persona a unidades mínimas enteras.
 * Acepta formatos es-AR y en-US: "12.500,50", "12,500.50", "$ 3.000", "-20",
 * "1,5", "2.000.000". Devuelve null si no hay un número válido.
 */
export function parseAmountToMinor(input: string | number, currency: string = DEFAULT_CURRENCY): number | null {
  const decimals = currencyDecimals(currency);
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return roundHalfAwayFromZero(input * 10 ** decimals);
  }

  const raw = input.trim();
  if (!raw) return null;

  const negative = raw.includes("-") || /^\(.*\)$/.test(raw);
  let s = raw.replace(/[^\d.,]/g, "");
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let decimalSep: "," | "." | null = null;

  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = lastComma > lastDot ? "," : ".";
  } else if (lastComma >= 0) {
    const parts = s.split(",");
    const after = parts[parts.length - 1]?.length ?? 0;
    decimalSep = parts.length === 2 && after === 3 && parts[0].length <= 3 ? null : ",";
  } else if (lastDot >= 0) {
    const parts = s.split(".");
    const after = parts[parts.length - 1]?.length ?? 0;
    decimalSep = parts.length === 2 && after === 3 ? null : ".";
  }

  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    const intPart = s.slice(0, idx).replace(/[.,]/g, "");
    const decPart = s.slice(idx + 1).replace(/[.,]/g, "").slice(0, decimals + 2);
    s = `${intPart}.${decPart}`;
  } else {
    s = s.replace(/[.,]/g, "");
  }

  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  const minor = roundHalfAwayFromZero(value * 10 ** decimals);
  return negative ? -minor : minor;
}

export function roundHalfAwayFromZero(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

export function minorToNumber(minor: number, currency: string): number {
  return minor / 10 ** currencyDecimals(currency);
}

export function formatMoney(
  minor: number,
  currency: string = DEFAULT_CURRENCY,
  options: { locale?: string; compact?: boolean; showCurrency?: boolean; signed?: boolean } = {},
): string {
  const meta = isCurrencyCode(currency) ? CURRENCIES[currency] : CURRENCIES[DEFAULT_CURRENCY];
  const locale = options.locale ?? meta.locale;
  const value = minorToNumber(minor, meta.code);
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: meta.code,
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
    notation: options.compact ? "compact" : "standard",
    signDisplay: options.signed ? "exceptZero" : "auto",
  });
  const text = formatter.format(value);
  if (options.showCurrency === false) {
    let result = text;
    // Remove currency symbol at beginning (e.g., es-AR: "$ 1.250,50")
    result = result.replace(/^\s*\$/, "").replace(/^\s*US\$/, "");
    // Remove currency symbol at end (e.g., en-US: "1.250,50 $")
    result = result.replace(/\s?[A-Z]{3}$/, "").replace(/\s?US\$|\s?\$/, (m) => m.trim());
    return result;
  }
  return text;
}

export function formatNumber(value: number, locale = "es-AR", maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

/** Convierte un importe a la moneda base usando una tasa escalada (1 unidad = rate/1e6 base). */
export function convertMinor(amountMinor: number, rateScaled: number): number {
  if (!Number.isFinite(amountMinor) || !Number.isFinite(rateScaled)) return 0;
  return roundHalfAwayFromZero((amountMinor * rateScaled) / RATE_SCALE);
}

export function rateToScaled(rate: string | number): number | null {
  if (typeof rate === "number") {
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return roundHalfAwayFromZero(rate * RATE_SCALE);
  }
  const parsed = parseAmountToMinor(rate, "USD");
  if (parsed === null || parsed <= 0) return null;
  return parsed;
}

export function scaledRateToNumber(rateScaled: number): number {
  return rateScaled / RATE_SCALE;
}

export function formatRate(rateScaled: number, from: string, to: string, locale = "es-AR"): string {
  const value = scaledRateToNumber(rateScaled);
  return `1 ${from} = ${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value)} ${to}`;
}

export function sumMinor(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, value) => acc + (typeof value === "number" && Number.isFinite(value) ? value : 0), 0);
}

export function percentage(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}
