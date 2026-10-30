import { parseAmountToMinor, type CurrencyCode, DEFAULT_CURRENCY, isCurrencyCode } from "./money";
import { parseDateExpression, todayISO } from "./dates";

export interface ParsedTransaction {
  type: "expense" | "income";
  amountMinor: number | null;
  currency: CurrencyCode;
  description: string;
  merchant: string | null;
  categoryName: string | null;
  date: string;
  paymentMethod: string | null;
  confidence: number;
  missing: string[];
  rawText: string;
  source: "text" | "voice" | "photo";
}

const CATEGORY_KEYWORDS: Array<{ category: string; words: string[] }> = [
  {
    category: "Supermercado",
    words: ["supermercado", "super", "coto", "carrefour", "jumbo", "disco", "vea", "dia", "chango", "anonima", "almacen", "verduleria", "carniceria", "fiambreria"],
  },
  {
    category: "Restaurantes",
    words: ["restaurante", "resto", "cafe", "cafeteria", "bar", "pizzeria", "hamburguesa", "almuerzo", "cena", "delivery", "pedidosya", "rappi", "sushi", "helado", "panaderia", "confiteria"],
  },
  {
    category: "Alimentación",
    words: ["comida", "alimento", "mercado", "fideos", "arroz", "pan", "leche", "yogur", "fruta", "verdura"],
  },
  {
    category: "Combustible",
    words: ["combustible", "nafta", "gasoil", "ypf", "shell", "axion", "puma", "estacion de servicio", "surtidor"],
  },
  {
    category: "Transporte",
    words: ["taxi", "uber", "cabify", "didi", "colectivo", "subte", "tren", "transporte", "peaje", "estacionamiento", "bicicleta", "monopatín", "monopatin"],
  },
  {
    category: "Vivienda",
    words: ["alquiler", "expensas", "hipoteca", "hogar", "muebles", "ferreteria", "pintura", "reparacion"],
  },
  {
    category: "Servicios",
    words: ["luz", "electricidad", "gas", "agua", "internet", "telefono", "celular", "cable", "edesur", "edenor", "metrogas", "abl", "aySA", "aysa", "tarjeta de credito"],
  },
  {
    category: "Salud",
    words: ["farmacia", "medico", "medicina", "obra social", "prepaga", "hospital", "dentista", "remedios", "kinesiologo", "psicologo"],
  },
  {
    category: "Educación",
    words: ["colegio", "universidad", "curso", "libro", "escuela", "matricula", "capacitacion", "posgrado"],
  },
  {
    category: "Entretenimiento",
    words: ["cine", "teatro", "recital", "juego", "steam", "salida", "boliche", "museo", "concierto", "entrada"],
  },
  {
    category: "Compras",
    words: ["ropa", "zapatillas", "shopping", "regalo", "amazon", "mercado libre", "mercadolibre", "compra", "indumentaria", "perfume"],
  },
  {
    category: "Tecnología",
    words: ["computadora", "notebook", "celular", "iphone", "monitor", "teclado", "electronica", "tablet", "auriculares", "cargador"],
  },
  {
    category: "Suscripciones",
    words: ["suscripcion", "netflix", "spotify", "youtube premium", "disney", "hbo", "max", "chatgpt", "icloud", "google one", "adobe", "prime video", "flow", "paramount"],
  },
  {
    category: "Viajes",
    words: ["viaje", "hotel", "vuelo", "pasaje", "airbnb", "booking", "turismo", "excursion", "vacaciones"],
  },
  {
    category: "Impuestos",
    words: ["impuesto", "iva", "ganancias", "monotributo", "afip", "arca", "patente", "tasa", "retencion", "ingresos brutos"],
  },
  {
    category: "Mascotas",
    words: ["mascota", "perro", "gato", "veterinaria", "balanceado", "petshop", "puppis"],
  },
];

const CURRENCY_WORDS: Array<{ currency: CurrencyCode; patterns: RegExp[] }> = [
  { currency: "USD", patterns: [/\busd\b/, /\bu\$s\b/, /\bdolar(?:es)?\b/, /\bverdes?\b/] },
  { currency: "EUR", patterns: [/\beur\b/, /\beuros?\b/] },
  { currency: "BRL", patterns: [/\bbrl\b/, /\breal(?:es)?\b/] },
  { currency: "CLP", patterns: [/\bclp\b/, /\bpesos? chilenos?\b/] },
  { currency: "UYU", patterns: [/\buyu\b/, /\bpesos? uruguayos?\b/] },
  { currency: "GBP", patterns: [/\bgbp\b/, /\blibras?\b/, /\bpounds?\b/] },
  { currency: "JPY", patterns: [/\bjpy\b/, /\byen(?:es)?\b/] },
  { currency: "ARS", patterns: [/\bars\b/, /\bpesos? argentinos?\b/, /\bpesos?\b/, /\bargentinos?\b/] },
];

const INCOME_WORDS = [
  "cobre",
  "cobré",
  "cobrado",
  "ingrese",
  "ingresé",
  "ingreso",
  "recibi",
  "recibí",
  "me pagaron",
  "sueldo",
  "salario",
  "aguinaldo",
  "devolucion",
  "devolución",
  "reembolso",
  "venta",
  "honorarios",
  "facture",
  "facturé",
  "me transfirieron",
];

const EXPENSE_WORDS = [
  "gaste",
  "gasté",
  "gasto",
  "compre",
  "compré",
  "compra",
  "pague",
  "pagué",
  "pago",
  "salió",
  "salio",
  "cargue",
  "cargué",
  "saque",
  "saqué",
  "inverti",
  "invertí",
  "abone",
  "aboné",
];

const PAYMENT_METHODS: Array<{ method: string; pattern: RegExp }> = [
  { method: "Efectivo", pattern: /\befectivo\b/ },
  { method: "Tarjeta de débito", pattern: /\b(debito|débito)\b/ },
  { method: "Tarjeta de crédito", pattern: /\b(credito|crédito|tarjeta)\b/ },
  { method: "Transferencia", pattern: /\btransferencia\b/ },
  { method: "Mercado Pago", pattern: /\bmercado pago\b|\bmp\b/ },
  { method: "QR", pattern: /\bqr\b/ },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCurrency(normalized: string, primaryCurrency: CurrencyCode): CurrencyCode {
  for (const entry of CURRENCY_WORDS) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) return entry.currency;
  }
  if (/\$/.test(normalized)) return primaryCurrency === "ARS" ? "ARS" : primaryCurrency;
  return primaryCurrency;
}

function detectType(normalized: string): "expense" | "income" {
  const incomeScore = INCOME_WORDS.filter((word) => normalized.includes(normalize(word))).length;
  const expenseScore = EXPENSE_WORDS.filter((word) => normalized.includes(normalize(word))).length;
  if (incomeScore > 0 && incomeScore >= expenseScore) return "income";
  if (expenseScore > 0) return "expense";
  if (/\b(sueldo|salario|aguinaldo|cobre|cobré|ingreso)\b/.test(normalized)) return "income";
  return "expense";
}

interface AmountCandidate {
  raw: string;
  index: number;
  score: number;
  multiplier: number;
}

function findAmountCandidates(normalized: string): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  const numberRegex = /(?<![\d/])(-?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|-?\d+(?:[.,]\d{1,2})?)(?![\d/])/g;
  let match: RegExpExecArray | null;
  while ((match = numberRegex.exec(normalized))) {
    const raw = match[1];
    const before = normalized.slice(Math.max(0, match.index - 18), match.index);
    const after = normalized.slice(match.index + raw.length, match.index + raw.length + 22);
    let score = 0;
    if (/\b(usd|eur|brl|clp|uyu|gbp|jpy|ars|pesos?|dolar(?:es)?|euros?|reales?|libras?|yenes?)\b|\$/.test(before)) score += 6;
    if (/\b(pesos?|dolar(?:es)?|euros?|reales?|libras?|yenes?|usd|eur|ars|brl)\b/.test(after)) score += 6;
    if (/[.,]/.test(raw) || raw.replace("-", "").length >= 4) score += 3;
    if (/\b(por|en|de|gaste|gasté|compre|compré|pague|pagué|cobre|cobré|ingrese|ingresé)\s*$/.test(before)) score += 2;
    if (/\b(hace|hace\s+)\s*$/.test(before) || /^\s*(dias?|semanas?|meses?|horas?)\b/.test(after)) score -= 5;
    if (/^\s*(%|por ciento)\b/.test(after)) score -= 4;
    if (/\b(cuotas?|cuota)\b/.test(after)) score -= 1;
    let multiplier = 1;
    if (/\b(lucas?|mil)\b/.test(after) && !/[.,]/.test(raw)) multiplier = 1000;
    if (/\b(palos?|millon(?:es)?)\b/.test(after)) multiplier = 1_000_000;
    candidates.push({ raw, index: match.index, score, multiplier });
  }
  return candidates.sort((a, b) => b.score - a.score || b.index - a.index);
}

function extractAmount(normalized: string, currency: CurrencyCode): { amountMinor: number | null; raw: string | null } {
  const candidates = findAmountCandidates(normalized);
  if (candidates.length === 0) return { amountMinor: null, raw: null };
  const best = candidates[0];
  const parsed = parseAmountToMinor(best.raw, currency);
  if (parsed === null) return { amountMinor: null, raw: best.raw };
  return { amountMinor: Math.abs(parsed) * best.multiplier, raw: best.raw };
}

function detectCategory(normalized: string): string | null {
  let best: { category: string; score: number } | null = null;
  for (const entry of CATEGORY_KEYWORDS) {
    let score = 0;
    for (const word of entry.words) {
      const normalizedWord = normalize(word);
      if (normalized.includes(normalizedWord)) {
        score += normalizedWord.length > 5 ? 3 : 2;
        if (new RegExp(`\\b${normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(normalized)) score += 1;
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { category: entry.category, score };
  }
  return best?.category ?? null;
}

function detectPaymentMethod(normalized: string): string | null {
  for (const entry of PAYMENT_METHODS) {
    if (entry.pattern.test(normalized)) return entry.method;
  }
  return null;
}

function cleanMerchant(value: string): string {
  return value
    .replace(/^(el|la|los|las|un|una|mi|mis|su|sus)\s+/i, "")
    .replace(/\b(por|con|de|en|para|a)\s*$/i, "")
    .replace(/[.,;!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function extractMerchant(original: string, normalized: string): string | null {
  const patterns = [
    /\b(?:en|de|para)\s+(?:el|la|los|las|un|una|mi|su)?\s*([a-záéíóúñü0-9][a-záéíóúñü0-9\s&.'-]{1,48})/i,
    /\b(?:compre|compré|pague|pagué|cargue|cargué|saque|saqué)\s+(?:un|una|el|la|los|las)?\s*([a-záéíóúñü0-9][a-záéíóúñü0-9\s&.'-]{1,48})/i,
  ];
  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match?.[1]) {
      const merchant = cleanMerchant(match[1].split(/\b(?:por|con|a las|el|la)\b/i)[0]);
      if (merchant.length >= 2 && !/^\d+$/.test(merchant)) return merchant;
    }
  }
  const wordMatch = normalized.match(/\b(?:en|de)\s+([a-z0-9]{3,}(?:\s+[a-z0-9]{3,})?)/);
  return wordMatch?.[1] ? cleanMerchant(wordMatch[1]) : null;
}

export function parseTransactionText(
  text: string,
  options: { today?: string; primaryCurrency?: CurrencyCode } = {},
): ParsedTransaction {
  const today = options.today ?? todayISO();
  const primaryCurrency = options.primaryCurrency ?? DEFAULT_CURRENCY;
  const normalized = normalize(text);
  const type = detectType(normalized);
  const currency = detectCurrency(normalized, primaryCurrency);
  const { amountMinor } = extractAmount(normalized, currency);
  const categoryName = detectCategory(normalized);
  const merchant = extractMerchant(text, normalized);
  const date = parseDateExpression(text, today) ?? today;
  const paymentMethod = detectPaymentMethod(normalized);
  const missing: string[] = [];
  if (amountMinor === null || amountMinor <= 0) missing.push("amount");

  const description = merchant ?? (categoryName ? `${categoryName}` : text.trim().slice(0, 80));

  let confidence = 0.35;
  if (amountMinor !== null) confidence += 0.3;
  if (categoryName) confidence += 0.15;
  if (merchant) confidence += 0.1;
  if (paymentMethod) confidence += 0.05;
  if (type === "income") confidence += 0.05;

  return {
    type,
    amountMinor,
    currency,
    description: description || text.trim().slice(0, 80),
    merchant,
    categoryName,
    date,
    paymentMethod,
    confidence: Math.min(0.99, Math.round(confidence * 100) / 100),
    missing,
    rawText: text.trim(),
    source: "text",
  };
}

export interface ParsedTicket extends ParsedTransaction {
  subtotalMinor: number | null;
  taxMinor: number | null;
  items: Array<{ description: string; amountMinor: number | null }>;
  time: string | null;
}

export function parseTicketText(
  text: string,
  options: { today?: string; primaryCurrency?: CurrencyCode } = {},
): ParsedTicket {
  const today = options.today ?? todayISO();
  const primaryCurrency = options.primaryCurrency ?? DEFAULT_CURRENCY;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const normalized = normalize(text);
  const currency = detectCurrency(normalized, primaryCurrency);

  const totalLine = lines.find((line) => /\b(total|importe total|total a pagar|monto total)\b/i.test(line) && !/subtotal/i.test(line));
  const subtotalLine = lines.find((line) => /\bsubtotal\b/i.test(line));
  const taxLine = lines.find((line) => /\b(iva|impuesto|tax)\b/i.test(line));
  const dateLine = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  const timeLine = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);

  const extractFromLine = (line?: string): number | null => {
    if (!line) return null;
    const candidate = findAmountCandidates(normalize(line))[0];
    if (!candidate) return null;
    const parsed = parseAmountToMinor(candidate.raw, currency);
    return parsed === null ? null : Math.abs(parsed) * candidate.multiplier;
  };

  let total = extractFromLine(totalLine);
  if (total === null) {
    const candidates = findAmountCandidates(normalized).filter((candidate) => candidate.score > 0);
    total = candidates.length > 0 ? parseAmountToMinor(candidates[0].raw, currency) : null;
    if (total !== null) total = Math.abs(total) * (candidates[0]?.multiplier ?? 1);
  }

  const merchantLine = lines.find(
    (line) => line.length >= 2 && line.length <= 48 && !/\d{2}[\/\-.]\d{2}/.test(line) && !/\b(total|iva|subtotal|cuit|telefono|www)\b/i.test(line),
  );
  const merchant = merchantLine ? cleanMerchant(merchantLine) : extractMerchant(text, normalized);
  const categoryName = detectCategory(normalized);

  let date = today;
  if (dateLine) {
    const day = Number(dateLine[1]);
    const month = Number(dateLine[2]);
    let year = Number(dateLine[3]);
    if (year < 100) year += 2000;
    const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) date = candidate;
  } else {
    date = parseDateExpression(text, today) ?? today;
  }

  const items = lines
    .filter((line) => !/\b(total|subtotal|iva|impuesto|cuit|gracias)\b/i.test(line))
    .map((line) => {
      const amount = extractFromLine(line);
      if (amount === null) return null;
      return { description: line.replace(/[\d.,$]+\s*$/, "").trim().slice(0, 60), amountMinor: amount };
    })
    .filter((item): item is { description: string; amountMinor: number } => Boolean(item?.description))
    .slice(0, 20);

  const missing: string[] = [];
  if (total === null || total <= 0) missing.push("amount");

  return {
    type: "expense",
    amountMinor: total,
    currency,
    description: merchant ?? "Ticket",
    merchant,
    categoryName,
    date,
    paymentMethod: null,
    confidence: total ? (merchant ? 0.82 : 0.7) : 0.4,
    missing,
    rawText: text.trim().slice(0, 4000),
    source: "photo",
    subtotalMinor: extractFromLine(subtotalLine),
    taxMinor: extractFromLine(taxLine),
    items,
    time: timeLine ? `${timeLine[1].padStart(2, "0")}:${timeLine[2]}` : null,
  };
}

export function detectCategoryFromText(text: string): string | null {
  return detectCategory(normalize(text));
}

export function suggestCategory(merchant: string | null, description: string): string | null {
  return detectCategory(normalize(`${merchant ?? ""} ${description}`));
}

export function currencyFromText(text: string, primary: CurrencyCode = DEFAULT_CURRENCY): CurrencyCode {
  return detectCurrency(normalize(text), primary);
}

export function isCurrencyText(text: string): boolean {
  const normalized = normalize(text);
  return CURRENCY_WORDS.some((entry) => entry.patterns.some((pattern) => pattern.test(normalized)));
}

export function normalizeForMatch(text: string): string {
  return normalize(text);
}

export function parseAmountFromText(text: string, currency: CurrencyCode = DEFAULT_CURRENCY): number | null {
  return extractAmount(normalize(text), currency).amountMinor;
}

export function isCurrencyCodeSafe(value: string): value is CurrencyCode {
  return isCurrencyCode(value);
}
