-- ============================================================================
-- Sigma Ahorro - Base de datos SQLite inicialización
-- ============================================================================

-- Habilitar funcionalidades extensas de SQLite
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- ============================================================================
-- Tabla: users
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ============================================================================
-- Tabla: user_preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'es-AR',
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  primary_currency TEXT NOT NULL DEFAULT 'ARS',
  theme TEXT NOT NULL DEFAULT 'light',
  date_format TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
  number_format TEXT NOT NULL DEFAULT 'es-AR',
  budget_thresholds TEXT NOT NULL DEFAULT '[50,75,90,100]',
  notifications TEXT NOT NULL DEFAULT '{"budgets":true,"duePayments":true,"debts":true,"goals":true,"recurring":true}',
  biometric_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ============================================================================
-- Tabla: categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES categories(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'expense',
  color TEXT NOT NULL DEFAULT '#0E7C66',
  icon TEXT NOT NULL DEFAULT 'Circle',
  sort_order INTEGER NOT NULL DEFAULT 10,
  archived INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Índice para búsquedas por nombre (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_categories_user_name ON categories(user_id, LOWER(name));

-- ============================================================================
-- Tabla: accounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'cash',
  currency TEXT NOT NULL DEFAULT 'ARS',
  initial_balance_minor INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 10,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ============================================================================
-- Tabla: tags
-- ============================================================================
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748B',
  created_at TEXT NOT NULL
);

-- ============================================================================
-- Tabla: transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES accounts(id),
  type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  exchange_rate_scaled INTEGER NOT NULL DEFAULT 1000000,
  base_amount_minor INTEGER,
  description TEXT NOT NULL,
  merchant TEXT,
  category_id TEXT REFERENCES categories(id),
  occurred_at TEXT NOT NULL,
  occurred_date TEXT NOT NULL,
  payment_method TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'posted',
  external_id TEXT,
  fingerprint TEXT NOT NULL,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Índice para búsquedas de transacciones
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, occurred_date);
CREATE INDEX IF NOT EXISTS idx_transactions_fingerprint ON transactions(fingerprint);
CREATE INDEX IF NOT EXISTS idx_transactions_external ON transactions(external_id) WHERE external_id IS NOT NULL;

-- ============================================================================
-- Tabla: transaction_tags
-- ============================================================================
CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

-- ============================================================================
-- Tabla: budgets
-- ============================================================================
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  period TEXT NOT NULL DEFAULT 'monthly',
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  start_date TEXT NOT NULL,
  end_date TEXT,
  thresholds TEXT NOT NULL DEFAULT '[50,75,90,100]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- ============================================================================
-- Tabla: savings_goals
-- ============================================================================
CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  target_date TEXT,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ============================================================================
-- Tabla: savings_contributions
-- ============================================================================
CREATE TABLE IF NOT EXISTS savings_contributions (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'contribution',
  occurred_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

-- ============================================================================
-- Tabla: debts
-- ============================================================================
CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'owed_by_me',
  counterparty TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  origin_date TEXT NOT NULL,
  due_date TEXT,
  installments INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

-- ============================================================================
-- Tabla: debt_payments
-- ============================================================================
CREATE TABLE IF NOT EXISTS debt_payments (
  id TEXT PRIMARY KEY,
  debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL,
  paid_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

-- ============================================================================
-- Tabla: recurring_transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  category_id TEXT REFERENCES categories(id),
  account_id TEXT REFERENCES accounts(id),
  frequency TEXT NOT NULL,
  interval_count INTEGER NOT NULL DEFAULT 1,
  start_date TEXT NOT NULL,
  end_date TEXT,
  next_run_date TEXT NOT NULL,
  payment_method TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  auto_post INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- ============================================================================
-- Tabla: scheduled_payments
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduled_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  due_date TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  recurring_id TEXT REFERENCES recurring_transactions(id),
  paid_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

-- ============================================================================
-- Tabla: exchange_rates
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id TEXT PRIMARY KEY,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate_scaled INTEGER NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

-- Índice para consultas de tasas por par de divisas
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair ON exchange_rates(base_currency, quote_currency);

-- ============================================================================
-- Tabla: notifications
-- ============================================================================
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

-- ============================================================================
-- Tabla: audit_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

-- ==========================================================================--
-- Datos iniciales (seed)
-- ==========================================================================--

-- Insertar usuario propietario por defecto
-- NOTA: La contraseña 'password123' está hasheada con bcrypt rounds=12
INSERT OR IGNORE INTO users (id, email, password_hash, name, created_at)
VALUES (
  'default-owner-uuid',
  'owner@sigma-ahorro.com',
  '$2b$12$LQv3cUSTyZP1eFq1Yflope.',
  'Propietario Sigma',
  datetime('now')
);

-- Insertar preferencias por defecto
INSERT OR IGNORE INTO user_preferences (user_id, locale, timezone, primary_currency, theme, date_format, number_format, budget_thresholds, notifications, biometric_enabled, created_at, updated_at)
VALUES (
  'default-owner-uuid',
  'es-AR',
  'America/Argentina/Buenos_Aires',
  'ARS',
  'light',
  'dd/MM/yyyy',
  'es-AR',
  '[50,75,90,100]',
  '{"budgets":true,"duePayments":true,"debts":true,"goals":true,"recurring":true}',
  0,
  datetime('now'),
  datetime('now')
);

-- Insertar categorías por defecto (17 categorías + "Ingresos")
INSERT OR IGNORE INTO categories (id, user_id, kind, name, color, icon, sort_order, archived, is_system, created_at) VALUES
('cat-ingresos', 'default-owner-uuid', 'income', 'Ingresos', '#10B981', 'Receipt', 1, 0, 1, datetime('now')),
('cat-alimentos', 'default-owner-uuid', 'expense', 'Alimentos', '#F87171', 'Food', 2, 0, 0, datetime('now')),
('cat-transporte', 'default-owner-uuid', 'expense', 'Transporte', '#6366F1', 'Car', 3, 0, 0, datetime('now')),
('cat-vivienda', 'default-owner-uuid', 'expense', 'Vivienda', '#A855F7', 'Home', 4, 0, 0, datetime('now')),
('cat-salud', 'default-owner-uuid', 'expense', 'Salud', '#EC4899', 'Heart', 5, 0, 0, datetime('now')),
-atrecho, 'default-owner-uuid', 'expense', 'Ropa', '#F97316', 'Shirt', 6, 0, 0, datetime('now')),
('cat-entretenimiento', 'default-owner-uuid', 'expense', 'Entretenimiento', '#14B8A6', 'Movie', 7, 0, 0, datetime('now')),
('cat-deudas', 'default-owner-uuid', 'expense', 'Deudas', '#84CC16', 'CreditCard', 8, 0, 0, datetime('now')),
('cat-ahorro', 'default-owner-uuid', 'expense', 'Ahorro', '#EC4899', 'Saving', 9, 0, 0, datetime('now')),
('cat-inversion', 'default-owner-uuid', 'income', 'Inversión', '#6366F1', 'TrendingUp', 10, 0, 0, datetime('now')),
('cat-salario', 'default-owner-uuid', 'income', 'Salario', '#F472B6', 'User', 11, 0, 0, datetime('now')),
('cat-regalos', 'default-owner-uuid', 'expense', 'Regalos', '#A3E635', 'Gift', 12, 0, 0, datetime('now')),
('cat-impuestos', 'default-owner-uuid', 'expense', 'Impuestos', '#FBBF24', 'Tax', 13, 0, 0, datetime('now')),
('cat-otros', 'default-owner-uuid', 'expense', 'Otros', '#6B7280', 'More', 14, 0, 0, datetime('now'));

-- Insertar cuentas por defecto
INSERT OR IGNORE INTO accounts (id, user_id, name, type, currency, initial_balance_minor, sort_order, archived, created_at) VALUES
('acct-main', 'default-owner-uuid', 'Cuenta principal', 'bank', 'ARS', 0, 10, 0, datetime('now')),
('acct-cash', 'default-owner-uuid', 'Efectivo', 'cash', 'ARS', 0, 20, 0, datetime('now'));

-- Insertar récurrencias por defecto (opcional - 3 ejemplos)
INSERT OR IGNORE INTO recurring_transactions (id, user_id, name, type, amount_minor, currency, category_id, frequency, interval_count, start_date, end_date, next_run_date, auto_post, created_at) VALUES
('rec-gas', 'default-owner-uuid', 'Gas mensual', 'expense', 150000, 'ARS', 'cat-transporte', 'monthly', 1, datetime('now'), NULL, datetime('now'), 1, datetime('now')),
('rec-suscrip', 'default-owner-uuid', 'Suscripción streaming', 'expense', 8900, 'ARS', 'cat-entretenimiento', 'monthly', 1, datetime('now'), NULL, datetime('now'), 1, datetime('now')),
('rec-dep', 'default-owner-uuid', 'Ahorro automático', 'income', 50000, 'ARS', 'cat-ahorro', 'monthly', 1, datetime('now'), NULL, datetime('now'), 1, datetime('now'));

-- Insertar presupuestos por defecto
INSERT OR IGNORE INTO budgets (id, user_id, name, category_id, period, amount_minor, currency, start_date, end_date, thresholds, active, created_at) VALUES
('bud-alimentos', 'default-owner-uuid', 'Alimentos', 'cat-alimentos', 'monthly', 300000, 'ARS', datetime('now'), NULL, '[50,75,90,100]', 1, datetime('now')),
('bud-transporte', 'default-owner-uuid', 'Transporte', 'cat-transporte', 'monthly', 200000, 'ARS', datetime('now'), NULL, '[50,75,90,100]', 1, datetime('now'));

-- Insertar metas por defecto
INSERT OR IGNORE INTO savings_goals (id, user_id, name, target_minor, currency, target_date, archived, created_at) VALUES
('goal-viaje', 'default-owner-uuid', 'Feria', 500000, 'ARS', NULL, 0, datetime('now')),
('goal-fondo', 'default-owner-uuid', 'Fondo de emergencia', 2000000, 'ARS', NULL, 0, datetime('now'));

-- Insertar contribuciones iniciales a metas
INSERT OR IGNORE INTO savings_contributions (id, goal_id, user_id, amount_minor, kind, occurred_at, created_at) VALUES
('cont-viaje-1', 'goal-viaje', 'default-owner-uuid', 100000, 'contribution', datetime('now'), datetime('now')),
('cont-fondo-1', 'goal-fondo', 'default-owner-uuid', 200000, 'contribution', datetime('now'), datetime('now'));

-- Insertar deudas por defecto
INSERT OR IGNORE INTO debts (id, user_id, direction, counterparty, description, amount_minor, currency, origin_date, due_date, status, created_at) VALUES
('debt-tarjeta', 'default-owner-uuid', 'owed_by_me', 'Banco XYZ', 'Tarjeta de crédito', 500000, 'ARS', datetime('now'), NULL, 'open', datetime('now'));

-- Insertar pagos de deuda por defecto
INSERT OR IGNORE INTO debt_payments (id, debt_id, user_id, amount_minor, paid_at, created_at) VALUES
('pay-tarjeta-1', 'debt-tarjeta', 'default-owner-uuid', 100000, datetime('now'), datetime('now'));

-- Insertar notificaciones por defecto (vacías, se llenan al usar la app)
INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, created_at) VALUES
('not-budget-1', 'default-owner-uuid', 'budget_warning', '', '', datetime('now'));

-- VACUUM para optimizar la base de datos
VACUUM;