export const SQLITE_SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'es-AR',
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  primary_currency TEXT NOT NULL DEFAULT 'ARS',
  theme TEXT NOT NULL DEFAULT 'system',
  date_format TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
  number_format TEXT NOT NULL DEFAULT 'es-AR',
  budget_thresholds TEXT NOT NULL DEFAULT '[50,75,90,100]',
  notifications TEXT NOT NULL DEFAULT '{}',
  biometric_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank',
  currency TEXT NOT NULL DEFAULT 'ARS',
  initial_balance_minor INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'expense',
  color TEXT NOT NULL DEFAULT '#0E7C66',
  icon TEXT NOT NULL DEFAULT 'Circle',
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0E7C66'
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('expense','income')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  exchange_rate_scaled INTEGER,
  base_amount_minor INTEGER,
  description TEXT NOT NULL,
  merchant TEXT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  occurred_at TEXT NOT NULL,
  occurred_date TEXT NOT NULL,
  payment_method TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'posted',
  external_id TEXT,
  fingerprint TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  start_date TEXT NOT NULL,
  end_date TEXT,
  thresholds TEXT NOT NULL DEFAULT '[50,75,90,100]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_minor INTEGER NOT NULL CHECK (target_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  target_date TEXT,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS savings_contributions (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  kind TEXT NOT NULL DEFAULT 'contribution' CHECK (kind IN ('contribution','withdrawal')),
  occurred_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('owed_by_me','owed_to_me')),
  counterparty TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  origin_date TEXT NOT NULL,
  due_date TEXT,
  installments INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id TEXT PRIMARY KEY,
  debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  paid_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  interval_count INTEGER NOT NULL DEFAULT 1,
  start_date TEXT NOT NULL,
  end_date TEXT,
  next_run_date TEXT NOT NULL,
  payment_method TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  auto_post INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  due_date TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  recurring_id TEXT REFERENCES recurring_transactions(id) ON DELETE SET NULL,
  paid_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 2,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate_scaled INTEGER NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_lists (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'ARS',
  invite_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_list_members (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_expenses (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
  paid_by_member_id TEXT NOT NULL REFERENCES shared_list_members(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  occurred_at TEXT NOT NULL,
  split_mode TEXT NOT NULL DEFAULT 'equal',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_splits (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL REFERENCES shared_expenses(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES shared_list_members(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL,
  percentage REAL,
  excluded INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
  from_member_id TEXT NOT NULL REFERENCES shared_list_members(id) ON DELETE CASCADE,
  to_member_id TEXT NOT NULL REFERENCES shared_list_members(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  settled_at TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
  email TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'preview',
  row_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_rows (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS ai_processing_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS classification_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'user',
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, occurred_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_fingerprint ON transactions(user_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_transactions_user_external ON transactions(user_id, external_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_active ON budgets(user_id, active);
CREATE INDEX IF NOT EXISTS idx_goals_user ON savings_goals(user_id, archived);
CREATE INDEX IF NOT EXISTS idx_contributions_goal ON savings_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_status ON debts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_recurring_user_next ON recurring_transactions(user_id, next_run_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_user_due ON scheduled_payments(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(base_currency, quote_currency, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_expenses_list ON shared_expenses(list_id);
CREATE INDEX IF NOT EXISTS idx_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_unique ON transactions(user_id, external_id) WHERE external_id IS NOT NULL;
`;

export const POSTGRES_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'es-AR',
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  primary_currency TEXT NOT NULL DEFAULT 'ARS',
  theme TEXT NOT NULL DEFAULT 'system',
  date_format TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
  number_format TEXT NOT NULL DEFAULT 'es-AR',
  budget_thresholds TEXT NOT NULL DEFAULT '[50,75,90,100]',
  notifications TEXT NOT NULL DEFAULT '{}',
  biometric_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank',
  currency TEXT NOT NULL DEFAULT 'ARS',
  initial_balance_minor BIGINT NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'expense',
  color TEXT NOT NULL DEFAULT '#0E7C66',
  icon TEXT NOT NULL DEFAULT 'Circle',
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0E7C66'
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('expense','income')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  exchange_rate_scaled BIGINT,
  base_amount_minor BIGINT,
  description TEXT NOT NULL,
  merchant TEXT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  occurred_at TEXT NOT NULL,
  occurred_date TEXT NOT NULL,
  payment_method TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'posted',
  external_id TEXT,
  fingerprint TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  start_date TEXT NOT NULL,
  end_date TEXT,
  thresholds TEXT NOT NULL DEFAULT '[50,75,90,100]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_minor BIGINT NOT NULL CHECK (target_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  target_date TEXT,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS savings_contributions (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  kind TEXT NOT NULL DEFAULT 'contribution' CHECK (kind IN ('contribution','withdrawal')),
  occurred_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('owed_by_me','owed_to_me')),
  counterparty TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  origin_date TEXT NOT NULL,
  due_date TEXT,
  installments INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id TEXT PRIMARY KEY,
  debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  paid_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  interval_count INTEGER NOT NULL DEFAULT 1,
  start_date TEXT NOT NULL,
  end_date TEXT,
  next_run_date TEXT NOT NULL,
  payment_method TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  auto_post INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  due_date TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  recurring_id TEXT REFERENCES recurring_transactions(id) ON DELETE SET NULL,
  paid_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 2,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate_scaled BIGINT NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_lists (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'ARS',
  invite_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_list_members (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_expenses (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
  paid_by_member_id TEXT NOT NULL REFERENCES shared_list_members(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  occurred_at TEXT NOT NULL,
  split_mode TEXT NOT NULL DEFAULT 'equal',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_splits (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL REFERENCES shared_expenses(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES shared_list_members(id) ON DELETE CASCADE,
  amount_minor BIGINT NOT NULL,
  percentage REAL,
  excluded INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
  from_member_id TEXT NOT NULL REFERENCES shared_list_members(id) ON DELETE CASCADE,
  to_member_id TEXT NOT NULL REFERENCES shared_list_members(id) ON DELETE CASCADE,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  settled_at TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shared_lists(id) ON DELETE CASCADE,
  email TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'preview',
  row_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_rows (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS ai_processing_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS classification_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'user',
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, occurred_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_fingerprint ON transactions(user_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_transactions_user_external ON transactions(user_id, external_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_active ON budgets(user_id, active);
CREATE INDEX IF NOT EXISTS idx_goals_user ON savings_goals(user_id, archived);
CREATE INDEX IF NOT EXISTS idx_contributions_goal ON savings_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_status ON debts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_recurring_user_next ON recurring_transactions(user_id, next_run_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_user_due ON scheduled_payments(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(base_currency, quote_currency, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_expenses_list ON shared_expenses(list_id);
CREATE INDEX IF NOT EXISTS idx_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_unique ON transactions(user_id, external_id) WHERE external_id IS NOT NULL;
`;
