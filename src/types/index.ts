import type { CurrencyCode } from "@/lib/money";
import type { Frequency } from "@/lib/dates";

export type TransactionType = "expense" | "income";
export type TransactionSource = "manual" | "text" | "voice" | "photo" | "import" | "recurring" | "detected";
export type TransactionStatus = "posted" | "pending";

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

export interface Preferences {
  user_id: string;
  locale: string;
  timezone: string;
  primary_currency: CurrencyCode;
  theme: "light" | "dark" | "system";
  date_format: string;
  number_format: string;
  budget_thresholds: string;
  notifications: string;
  biometric_enabled: number;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: string;
  currency: CurrencyCode;
  initial_balance_minor: number;
  sort_order?: number;
  archived: number;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  kind: "expense" | "income";
  color: string;
  icon: string;
  sort_order: number;
  archived: number;
  is_system: number;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  type: TransactionType;
  amount_minor: number;
  currency: CurrencyCode;
  exchange_rate_scaled: number | null;
  base_amount_minor: number | null;
  description: string;
  merchant: string | null;
  category_id: string | null;
  occurred_at: string;
  occurred_date: string;
  payment_method: string | null;
  notes: string | null;
  source: TransactionSource;
  status: TransactionStatus;
  external_id: string | null;
  fingerprint: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithRelations extends Transaction {
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  account_name: string | null;
  tags?: string[];
}

export interface Attachment {
  id: string;
  user_id: string;
  transaction_id: string | null;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  storage_path: string;
  created_at: string;
}

export type BudgetPeriod = "weekly" | "monthly" | "yearly" | "custom";

export interface Budget {
  id: string;
  user_id: string;
  name: string;
  category_id: string | null;
  period: BudgetPeriod;
  amount_minor: number;
  currency: CurrencyCode;
  start_date: string;
  end_date: string | null;
  thresholds: string;
  active: number;
  created_at: string;
}

export interface BudgetWithSpent extends Budget {
  category_name: string | null;
  category_color: string | null;
  spent_minor: number;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_minor: number;
  currency: CurrencyCode;
  target_date: string | null;
  notes: string | null;
  archived: number;
  created_at: string;
}

export interface SavingsContribution {
  id: string;
  goal_id: string;
  user_id: string;
  amount_minor: number;
  kind: "contribution" | "withdrawal";
  occurred_at: string;
  note: string | null;
  created_at: string;
}

export interface SavingsGoalWithProgress extends SavingsGoal {
  saved_minor: number;
  contributions_count: number;
}

export interface Debt {
  id: string;
  user_id: string;
  direction: "owed_by_me" | "owed_to_me";
  counterparty: string;
  description: string;
  amount_minor: number;
  currency: CurrencyCode;
  origin_date: string;
  due_date: string | null;
  installments: number | null;
  status: "open" | "partial" | "paid" | "cancelled";
  created_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  user_id: string;
  amount_minor: number;
  paid_at: string;
  note: string | null;
  created_at: string;
}

export interface DebtWithBalance extends Debt {
  paid_minor: number;
  balance_minor: number;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  amount_minor: number;
  currency: CurrencyCode;
  category_id: string | null;
  account_id: string | null;
  frequency: Frequency;
  interval_count: number;
  start_date: string;
  end_date: string | null;
  next_run_date: string;
  payment_method: string | null;
  active: number;
  auto_post: number;
  created_at: string;
}

export interface ScheduledPayment {
  id: string;
  user_id: string;
  name: string;
  amount_minor: number;
  currency: CurrencyCode;
  due_date: string;
  category_id: string | null;
  status: "pending" | "paid" | "cancelled";
  priority: "low" | "normal" | "high";
  recurring_id: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface CurrencyRow {
  code: CurrencyCode;
  name: string;
  symbol: string;
  decimals: number;
  active: number;
}

export interface ExchangeRate {
  id: string;
  user_id: string | null;
  base_currency: CurrencyCode;
  quote_currency: CurrencyCode;
  rate_scaled: number;
  source: string;
  fetched_at: string;
}

export interface SharedList {
  id: string;
  owner_user_id: string;
  name: string;
  description: string | null;
  currency: CurrencyCode;
  invite_token: string;
  created_at: string;
}

export interface SharedListMember {
  id: string;
  list_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  role: "owner" | "member";
  joined_at: string;
}

export interface SharedExpense {
  id: string;
  list_id: string;
  paid_by_member_id: string;
  description: string;
  amount_minor: number;
  currency: CurrencyCode;
  occurred_at: string;
  split_mode: "equal" | "percentage" | "amount";
  created_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  amount_minor: number;
  percentage: number | null;
  excluded: number;
}

export interface Settlement {
  id: string;
  list_id: string;
  from_member_id: string;
  to_member_id: string;
  amount_minor: number;
  currency: CurrencyCode;
  settled_at: string;
  note: string | null;
}

export interface Invitation {
  id: string;
  list_id: string;
  email: string | null;
  token: string;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
  created_at: string;
}

export interface ImportJob {
  id: string;
  user_id: string;
  filename: string;
  format: string;
  status: "preview" | "completed" | "failed";
  row_count: number;
  imported_count: number;
  duplicate_count: number;
  created_at: string;
}

export interface ImportRow {
  id: string;
  import_id: string;
  row_index: number;
  raw_json: string;
  status: "pending" | "imported" | "duplicate" | "error" | "skipped";
  transaction_id: string | null;
  error: string | null;
}

export interface AiProcessingJob {
  id: string;
  user_id: string;
  kind: "text" | "voice" | "photo" | "assistant" | "classification";
  provider: string;
  status: "completed" | "failed";
  input_json: string;
  output_json: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ClassificationRule {
  id: string;
  user_id: string;
  pattern: string;
  category_id: string;
  source: "user" | "system";
  hit_count: number;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata_json: string | null;
  created_at: string;
}

export interface DashboardData {
  range: { from: string; to: string; label: string };
  previousRange: { from: string; to: string; label: string };
  spentMinor: number;
  incomeMinor: number;
  balanceMinor: number;
  previousSpentMinor: number;
  previousIncomeMinor: number;
  spentChange: number | null;
  incomeChange: number | null;
  transactionCount: number;
  dailyAverageMinor: number;
  budgetTotalMinor: number;
  budgetSpentMinor: number;
  budgets: BudgetWithSpent[];
  categories: Array<{ id: string; name: string; color: string; icon: string; totalMinor: number; count: number }>;
  recentTransactions: TransactionWithRelations[];
  upcomingPayments: ScheduledPayment[];
  goals: SavingsGoalWithProgress[];
  alerts: Array<{ kind: string; title: string; body: string; href: string; severity: "info" | "warning" | "danger" }>;
}
