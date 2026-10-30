export const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";
export const DEFAULT_LOCALE = "es-AR";

export type PeriodPreset = "week" | "month" | "year" | "custom";

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

const DAY_MS = 86_400_000;

export function todayISO(timeZone = DEFAULT_TIMEZONE, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function nowISO(now = new Date()): string {
  return now.toISOString();
}

export function toDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

export function fromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = toDate(value);
  return !Number.isNaN(date.getTime()) && fromDate(date) === value;
}

export function addDays(isoDate: string, days: number): string {
  const date = toDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return fromDate(date);
}

export function addMonths(isoDate: string, months: number): string {
  const date = toDate(isoDate);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return fromDate(date);
}

export function addYears(isoDate: string, years: number): string {
  return addMonths(isoDate, years * 12);
}

export function startOfWeek(isoDate: string): string {
  const date = toDate(isoDate);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(isoDate, diff);
}

export function endOfWeek(isoDate: string): string {
  return addDays(startOfWeek(isoDate), 6);
}

export function startOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function endOfMonth(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${isoDate.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

export function startOfYear(isoDate: string): string {
  return `${isoDate.slice(0, 4)}-01-01`;
}

export function endOfYear(isoDate: string): string {
  return `${isoDate.slice(0, 4)}-12-31`;
}

export function daysInMonth(isoDate: string): number {
  return Number(endOfMonth(isoDate).slice(8, 10));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);
}

export function elapsedDaysInRange(from: string, to: string, today: string): number {
  if (today < from) return 0;
  if (today > to) return daysBetween(from, to) + 1;
  return daysBetween(from, today) + 1;
}

export function periodRange(
  preset: PeriodPreset,
  reference: string = todayISO(),
  custom?: { from?: string; to?: string },
): DateRange {
  switch (preset) {
    case "week":
      return { from: startOfWeek(reference), to: endOfWeek(reference), label: "Esta semana" };
    case "year":
      return { from: startOfYear(reference), to: endOfYear(reference), label: "Este año" };
    case "custom": {
      const from = custom?.from && isValidISODate(custom.from) ? custom.from : startOfMonth(reference);
      const to = custom?.to && isValidISODate(custom.to) ? custom.to : reference;
      return { from, to, label: "Período personalizado" };
    }
    case "month":
    default:
      return { from: startOfMonth(reference), to: endOfMonth(reference), label: "Este mes" };
  }
}

export function previousRange(range: DateRange, preset: PeriodPreset): DateRange {
  switch (preset) {
    case "week":
      return { ...range, from: addDays(range.from, -7), to: addDays(range.to, -7), label: "Semana anterior" };
    case "year":
      return {
        ...range,
        from: addYears(range.from, -1),
        to: addYears(range.to, -1),
        label: "Año anterior",
      };
    case "custom": {
      const span = daysBetween(range.from, range.to);
      return { from: addDays(range.from, -span - 1), to: addDays(range.from, -1), label: "Período anterior" };
    }
    case "month":
    default:
      return {
        ...range,
        from: addMonths(range.from, -1),
        to: endOfMonth(addMonths(range.from, -1)),
        label: "Mes anterior",
      };
  }
}

export function formatDate(isoDate: string, locale = DEFAULT_LOCALE, style: "short" | "medium" | "long" = "medium"): string {
  const date = toDate(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { day: "2-digit", month: "2-digit" }
      : style === "long"
        ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
        : { day: "2-digit", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date);
}

export function formatMonth(isoDate: string, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(toDate(isoDate));
}

export function relativeDayLabel(isoDate: string, today = todayISO(), locale = DEFAULT_LOCALE): string {
  const diff = daysBetween(today, isoDate);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  if (diff < 0 && diff >= -7) return `Hace ${Math.abs(diff)} días`;
  if (diff > 0 && diff <= 7) return `En ${diff} días`;
  return formatDate(isoDate, locale, "medium");
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miércoles: 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sábado: 6,
  sabado: 6,
};

/**
 * Interpreta expresiones de fecha coloquiales en español rioplatense.
 * Devuelve YYYY-MM-DD o null si no reconoce una fecha.
 */
export function parseDateExpression(input: string, today = todayISO()): string | null {
  const text = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/\bpasado manana\b/.test(text)) return addDays(today, 2);
  if (/\bmanana\b/.test(text)) return addDays(today, 1);
  if (/\banteayer\b|\bantes de ayer\b/.test(text)) return addDays(today, -2);
  if (/\bayer\b/.test(text)) return addDays(today, -1);
  if (/\bhoy\b/.test(text)) return today;

  const hace = text.match(/hace\s+(\d{1,3})\s+(dias?|semanas?|meses?|mes)\b/);
  if (hace) {
    const amount = Number(hace[1]);
    if (/dia/.test(hace[2])) return addDays(today, -amount);
    if (/semana/.test(hace[2])) return addDays(today, -amount * 7);
    return addMonths(today, -amount);
  }

  if (/\b(la|esta)\s+semana\s+pasada\b|\bsemana\s+pasada\b/.test(text)) return addDays(today, -7);
  if (/\b(el|este)\s+mes\s+pasado\b|\bmes\s+pasado\b/.test(text)) return addMonths(today, -1);
  if (/\b(el|este)\s+ano\s+pasado\b|\bano\s+pasado\b/.test(text)) return addYears(today, -1);

  const weekdayMatch = text.match(/\b(?:el\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\s+(pasado|anterior)\b/);
  if (weekdayMatch) {
    const target = WEEKDAYS[weekdayMatch[1]];
    const current = toDate(today).getUTCDay();
    let diff = current - target;
    if (diff <= 0) diff += 7;
    return addDays(today, -diff);
  }

  const dayMonth = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const month = Number(dayMonth[2]);
    let year = dayMonth[3] ? Number(dayMonth[3]) : Number(today.slice(0, 4));
    if (year < 100) year += 2000;
    const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (isValidISODate(candidate)) return candidate;
  }

  const written = text.match(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+)?(\d{4}))?/);
  if (written) {
    const months = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];
    const monthIndex = months.indexOf(written[2] === "setiembre" ? "septiembre" : written[2]);
    const year = written[3] ? Number(written[3]) : Number(today.slice(0, 4));
    const candidate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(Number(written[1])).padStart(2, "0")}`;
    if (isValidISODate(candidate)) return candidate;
  }

  return null;
}

export type Frequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "bimonthly"
  | "quarterly"
  | "semiannual"
  | "yearly"
  | "custom_days"
  | "custom_months";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Diaria",
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  yearly: "Anual",
  custom_days: "Personalizada (días)",
  custom_months: "Personalizada (meses)",
};

export function addFrequency(isoDate: string, frequency: Frequency, intervalCount = 1): string {
  const interval = Math.max(1, intervalCount);
  switch (frequency) {
    case "daily":
      return addDays(isoDate, interval);
    case "weekly":
      return addDays(isoDate, 7 * interval);
    case "biweekly":
      return addDays(isoDate, 14 * interval);
    case "monthly":
      return addMonths(isoDate, interval);
    case "bimonthly":
      return addMonths(isoDate, 2 * interval);
    case "quarterly":
      return addMonths(isoDate, 3 * interval);
    case "semiannual":
      return addMonths(isoDate, 6 * interval);
    case "yearly":
      return addMonths(isoDate, 12 * interval);
    case "custom_days":
      return addDays(isoDate, interval);
    case "custom_months":
      return addMonths(isoDate, interval);
  }
}

export function nextDueDate(
  nextRunDate: string,
  frequency: Frequency,
  intervalCount: number,
  today: string,
  endDate?: string | null,
): string | null {
  let next = nextRunDate;
  let guard = 0;
  while (next <= today && guard < 500) {
    next = addFrequency(next, frequency, intervalCount);
    guard += 1;
  }
  if (endDate && next > endDate) return null;
  return next;
}
