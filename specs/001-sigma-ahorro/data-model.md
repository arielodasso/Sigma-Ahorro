# Modelo de datos

Convenciones: `id TEXT` UUID; `user_id TEXT` propietario; fechas de calendario `TEXT YYYY-MM-DD`; timestamps `TEXT ISO-8601 UTC`; importes `INTEGER` en unidades mínimas; tasas `INTEGER` escaladas ×1.000.000; JSON `TEXT`. SQLite y PostgreSQL comparten columnas; los DDL específicos viven en `src/lib/db/schema.ts` y `supabase/migrations/0001_init.sql`.

## Núcleo

| Tabla | Campos principales | Relaciones / reglas |
|-------|--------------------|---------------------|
| users | id, email UNIQUE, password_hash, name, created_at | Raíz de todo |
| user_preferences | user_id PK/FK, locale, timezone, primary_currency, theme, date_format, number_format, budget_thresholds, notifications, biometric_enabled | 1:1 users |
| accounts | id, user_id, name, type, currency, initial_balance_minor, archived | 1:N transactions |
| categories | id, user_id, parent_id, name, kind, color, icon, is_system, budget_id? | Árbol; unique(user_id,parent_id,name) |
| tags | id, user_id, name, color | N:M transactions |
| transactions | id, user_id, account_id, type, amount_minor, currency, exchange_rate_scaled, base_amount_minor, description, merchant, category_id, occurred_at, occurred_date, payment_method, notes, source, status, external_id, fingerprint, deleted_at | unique(user_id, external_id); index(user_id, occurred_date) |
| transaction_tags | transaction_id, tag_id | PK compuesta |
| attachments | id, user_id, transaction_id, filename, mime, size, sha256, storage_path | Adjunto autenticado |

## Planificación

| Tabla | Campos principales | Reglas |
|-------|--------------------|--------|
| budgets | id, user_id, name, category_id NULL, period, amount_minor, currency, start_date, end_date, thresholds, active | General si category_id NULL |
| savings_goals | id, user_id, name, target_minor, currency, target_date, notes, archived | |
| savings_contributions | id, goal_id, user_id, amount_minor, kind, occurred_at, note | kind contribution/withdrawal |
| debts | id, user_id, direction, counterparty, description, amount_minor, currency, origin_date, due_date, installments, status | direction owed_by_me/owed_to_me |
| debt_payments | id, debt_id, user_id, amount_minor, paid_at, note | saldo = deuda - pagos |
| recurring_transactions | id, user_id, name, type, amount_minor, currency, category_id, account_id, frequency, interval_count, start_date, end_date, next_run_date, payment_method, active, auto_post | index(next_run_date) |
| scheduled_payments | id, user_id, name, amount_minor, currency, due_date, category_id, status, priority, recurring_id, paid_at, notes | status pending/overdue/paid/cancelled |

## Monedas

| Tabla | Campos | Reglas |
|-------|--------|--------|
| currencies | code PK, name, symbol, decimals, active | ARS, USD, EUR, BRL, CLP, UYU, GBP, JPY |
| exchange_rates | id, user_id NULL, base_currency, quote_currency, rate_scaled, source, fetched_at | unique(base,quote,fetched_at) |

`base_amount_minor = round(amount_minor × rate_scaled / 10^6)` con redondeo half-away-from-zero. La tasa se congela en el movimiento.

## Compartidas

| Tabla | Campos | Reglas |
|-------|--------|--------|
| shared_lists | id, owner_user_id, name, description, currency, invite_token UNIQUE | |
| shared_list_members | id, list_id, user_id NULL, name, email, role, joined_at | unique(list_id, lower(email)) |
| shared_expenses | id, list_id, paid_by_member_id, description, amount_minor, currency, occurred_at, split_mode | |
| expense_splits | id, expense_id, member_id, amount_minor, percentage, excluded | suma de amounts = total |
| settlements | id, list_id, from_member_id, to_member_id, amount_minor, settled_at, note | |
| invitations | id, list_id, email, token, status, expires_at | |

## Automatización y control

| Tabla | Campos |
|-------|--------|
| imports | id, user_id, filename, format, status, row_count, imported_count, duplicate_count, created_at |
| import_rows | id, import_id, row_index, raw_json, status, transaction_id, error |
| ai_processing_jobs | id, user_id, kind, provider, status, input_json, output_json, error, created_at, completed_at |
| classification_rules | id, user_id, pattern, category_id, source, hit_count, created_at |
| notifications | id, user_id, kind, title, body, link, read_at, created_at |
| audit_logs | id, user_id, action, entity, entity_id, metadata_json, created_at |

## Integridad

- Borrado lógico de movimientos (`deleted_at`) para trazabilidad; los agregados excluyen borrados.
- Borrado en cascada de hijos al eliminar usuario/lista/meta/deuda/recurrencia.
- `fingerprint` = SHA-256 de `occurred_date|amount_minor|currency|merchant|description` normalizados; índice único parcial por usuario.
- Idempotencia de recurrencias: `external_id = recurring:{id}:{fecha}` único por usuario.
- RLS Supabase: toda tabla con `user_id` usa `auth.uid() = user_id`; tablas hijas validan pertenencia por join. La conexión directa server-side aplica autorización en servicios.

## Índices

`transactions(user_id, occurred_date DESC)`, `transactions(user_id, category_id)`, `transactions(user_id, fingerprint)`, `transactions(user_id, external_id)`, `budgets(user_id, active)`, `savings_contributions(goal_id)`, `debts(user_id, status)`, `recurring_transactions(user_id, next_run_date)`, `scheduled_payments(user_id, due_date)`, `shared_expenses(list_id)`, `expense_splits(expense_id)`, `notifications(user_id, read_at)`.
