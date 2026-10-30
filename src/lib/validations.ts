import { z } from "zod";
import { CURRENCY_CODES } from "@/lib/money";
import { isValidISODate } from "@/lib/dates";

const currency = z.enum(CURRENCY_CODES);
const isoDate = z.string().refine(isValidISODate, "Fecha inválida");
const optionalIsoDate = z
  .string()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value) => value === undefined || isValidISODate(value), "Fecha inválida");

export const setupSchema = z
  .object({
    name: z.string().trim().min(2, "Ingresá tu nombre").max(80),
    email: z.string().trim().email("Email inválido"),
    password: z.string().min(10, "La contraseña debe tener al menos 10 caracteres").max(200),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export const transactionSchema = z.object({
  type: z.enum(["expense", "income"]),
  amount: z.string().trim().min(1, "Ingresá un importe"),
  currency,
  description: z.string().trim().min(1, "Ingresá una descripción").max(160),
  merchant: z.string().trim().max(120).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  occurredDate: isoDate,
  paymentMethod: z.string().trim().max(60).optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  source: z.enum(["manual", "text", "voice", "photo", "import", "recurring", "detected"]).default("manual"),
  attachmentId: z.string().uuid().optional().nullable(),
  externalId: z.string().trim().max(160).optional().nullable(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto").max(60),
  kind: z.enum(["expense", "income"]).default("expense"),
  parentId: z.string().uuid().optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido").default("#0E7C66"),
  icon: z.string().trim().min(1).max(40).default("Circle"),
});

export const budgetSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    categoryId: z.string().uuid().optional().nullable(),
    period: z.enum(["weekly", "monthly", "yearly", "custom"]).default("monthly"),
    amount: z.string().trim().min(1, "Ingresá un límite"),
    currency,
    startDate: isoDate,
    endDate: optionalIsoDate,
    thresholds: z.array(z.number().int().min(1).max(300)).min(1).max(6).default([50, 75, 90, 100]),
  })
  .refine((data) => data.period !== "custom" || Boolean(data.endDate), {
    message: "Un presupuesto personalizado necesita fecha de fin",
    path: ["endDate"],
  });

export const goalSchema = z.object({
  name: z.string().trim().min(2).max(80),
  target: z.string().trim().min(1, "Ingresá un objetivo"),
  currency,
  targetDate: optionalIsoDate,
  notes: z.string().trim().max(500).optional().nullable(),
});

export const contributionSchema = z.object({
  goalId: z.string().uuid(),
  amount: z.string().trim().min(1),
  kind: z.enum(["contribution", "withdrawal"]).default("contribution"),
  occurredAt: isoDate,
  note: z.string().trim().max(300).optional().nullable(),
});

export const debtSchema = z.object({
  direction: z.enum(["owed_by_me", "owed_to_me"]),
  counterparty: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(160),
  amount: z.string().trim().min(1),
  currency,
  originDate: isoDate,
  dueDate: optionalIsoDate,
  installments: z.coerce.number().int().min(1).max(120).optional().nullable(),
});

export const debtPaymentSchema = z.object({
  debtId: z.string().uuid(),
  amount: z.string().trim().min(1),
  paidAt: isoDate,
  note: z.string().trim().max(300).optional().nullable(),
});

export const recurringSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(["expense", "income"]).default("expense"),
  amount: z.string().trim().min(1),
  currency,
  categoryId: z.string().uuid().optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  frequency: z.enum([
    "daily",
    "weekly",
    "biweekly",
    "monthly",
    "bimonthly",
    "quarterly",
    "semiannual",
    "yearly",
    "custom_days",
    "custom_months",
  ]),
  intervalCount: z.coerce.number().int().min(1).max(365).default(1),
  startDate: isoDate,
  endDate: optionalIsoDate,
  nextRunDate: isoDate,
  paymentMethod: z.string().trim().max(60).optional().nullable(),
  autoPost: z.boolean().default(true),
});

export const scheduledPaymentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  amount: z.string().trim().min(1),
  currency,
  dueDate: isoDate,
  categoryId: z.string().uuid().optional().nullable(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  notes: z.string().trim().max(300).optional().nullable(),
});

export const sharedListSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().nullable(),
  currency,
});

export const sharedMemberSchema = z.object({
  listId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().optional().nullable(),
});

export const sharedExpenseSchema = z.object({
  listId: z.string().uuid(),
  description: z.string().trim().min(2).max(160),
  amount: z.string().trim().min(1),
  paidByMemberId: z.string().uuid(),
  occurredAt: isoDate,
  splitMode: z.enum(["equal", "percentage", "amount"]).default("equal"),
  participants: z.array(z.string().uuid()).min(1),
  percentages: z.record(z.string(), z.number().min(0).max(100)).optional(),
  amounts: z.record(z.string(), z.number().int().min(0)).optional(),
});

export const settlementSchema = z.object({
  listId: z.string().uuid(),
  fromMemberId: z.string().uuid(),
  toMemberId: z.string().uuid(),
  amount: z.string().trim().min(1),
  settledAt: isoDate,
  note: z.string().trim().max(300).optional().nullable(),
});

export const settingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  locale: z.enum(["es-AR", "en-US", "de-DE"]),
  timezone: z.string().trim().min(3).max(60),
  primaryCurrency: currency,
  theme: z.enum(["light", "dark", "system"]),
  dateFormat: z.enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"]),
  numberFormat: z.enum(["es-AR", "en-US", "de-DE"]),
  budgetThresholds: z.array(z.number().int().min(1).max(300)).min(1).max(6),
  notifications: z.object({
    budgets: z.boolean(),
    duePayments: z.boolean(),
    debts: z.boolean(),
    goals: z.boolean(),
    recurring: z.boolean(),
  }),
  biometricEnabled: z.boolean(),
});

export const assistantSchema = z.object({
  question: z.string().trim().min(2, "Escribí una consulta").max(500),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type DebtInput = z.infer<typeof debtSchema>;
export type RecurringInput = z.infer<typeof recurringSchema>;
export type SharedExpenseInput = z.infer<typeof sharedExpenseSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
