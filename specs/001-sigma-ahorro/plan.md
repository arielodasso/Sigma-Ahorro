# Implementation Plan: Sigma Ahorro

**Branch**: `001-sigma-ahorro` | **Date**: 2026-10-30 | **Spec**: `specs/001-sigma-ahorro/spec.md`

## Summary

Aplicación web privada de finanzas personales, mobile-first, con dashboard, registro manual/texto/voz/foto, asistente determinista, presupuestos, metas, deudas, recurrentes, pagos planificados, multimoneda, importación, estadísticas, listas compartidas, exportaciones y PWA. Next.js 16 App Router + TypeScript estricto + Tailwind 4 + componentes shadcn-style. Persistencia dual SQLite/PostgreSQL con el mismo contrato de repositorio y dinero en enteros. IA desacoplada con parser local como fallback y OCR Tesseract local.

## Technical Context

**Language/Version**: TypeScript 5, Node 24
**Framework**: Next.js 16.4 (App Router, Server Actions), React 19.3
**UI**: Tailwind CSS 4, Radix primitives, Lucide, Recharts, IBM Plex Sans/Mono
**Storage**: SQLite (`better-sqlite3`) en local; PostgreSQL/Supabase (`postgres`) en producción
**Auth**: bcryptjs + JWT HS256 en cookie HttpOnly (`jose`), rate limit en memoria
**AI**: proveedor OpenAI/Anthropic-compatible opcional; parser determinista es-AR obligatorio
**OCR**: Tesseract.js local; visión opcional
**Testing**: Vitest (dominio), typecheck, lint, build; Playwright preparado
**Target**: Vercel (Node runtime) + Supabase/Postgres
**Performance**: dashboard < 1.5s en local; consultas indexadas por user_id/fecha
**Scale**: uso personal, decenas de miles de movimientos; diseño multi-usuario

## Constitution Check

| Principio | Cumplimiento |
|-----------|--------------|
| Producto real | Persistencia real, server actions, cron, importación, exportación |
| Dinero exacto | `amount_minor` entero; tasas escaladas; redondeo half-away-from-zero |
| Privacidad | Sesión obligatoria, `user_id` en cada consulta, adjuntos autenticados |
| Separación | `domain/`, `services/`, `lib/db`, `lib/ai`, `app/` |
| Accesibilidad | Tokens, foco, labels, estados, responsive, claro/oscuro |
| Verificación | Tests + typecheck + lint + build antes de cerrar |

Sin violaciones que requieran justificación. La ausencia de Supabase Auth/RLS en runtime local se registra como decisión de entorno, no como deuda de diseño.

## Project Structure

```text
src/
  app/
    (auth)/login, setup
    (app)/dashboard, transactions, budgets, savings, debts, planning,
          statistics, shared, assistant, settings, categories, imports
    api/assistant, attachments, cron, export, import, ocr, rates, transcribe
  components/
    ui/            # primitivas shadcn-style
    layout/        # shell, sidebar, topbar, mobile nav
    dashboard/     # tarjetas, gráficos, listas
    transactions/  # formularios, quick add, review
    charts/
  features/        # módulos verticales por dominio
  domain/          # lógica pura: money, dates, budgets, recurrence, splits, parser
  services/        # casos de uso con DB
  repositories/    # consultas SQL
  lib/
    db/            # adaptador sqlite/postgres + schema + seed
    ai/            # providers, parser, assistant, ocr, transcribe
    auth/          # session, password, guard
    currency/      # formatos, conversión, proveedores
    validations/   # esquemas Zod
    utils.ts
  hooks/
  types/
supabase/migrations/0001_init.sql
specs/001-sigma-ahorro/
tests/
```

**Structure Decision**: Proyecto único Next.js con capas internas; se evita sobrearquitectura. Los servicios son la única puerta a datos para server actions, cron, importación y asistente.

## Data Model

Ver `data-model.md`. Claves: UUID TEXT, timestamps ISO TEXT, fechas `YYYY-MM-DD`, importes INTEGER, tasas INTEGER escaladas 1e6, JSON TEXT. Índices por `(user_id, occurred_date)`, `(user_id, category_id)`, `fingerprint`, `next_run_date`.

## Contracts

- Server Actions: validación Zod, sesión obligatoria, retorno `{ ok, error?, data? }`.
- API routes: JSON o descarga; auth por sesión salvo `/api/cron` (Bearer `CRON_SECRET`).
- IA: `parseTransactionText`, `extractTicket`, `transcribeAudio`, `askAssistant`; toda salida Zod; nunca escritura directa.

## Risks

- Mejor-sqlite3 es nativo y no persiste en Vercel: producción debe usar Postgres.
- Tesseract descarga modelos en runtime; primera ejecución lenta y dependiente de red.
- Web Speech API varía por navegador; fallback obligatorio.
- Sin claves de IA la extracción es heurística; se muestra revisión y se permite corregir.
- RLS de Supabase no aplica si se usa conexión directa; la autorización server-side es la defensa activa.

## Complexity Tracking

No se requieren excepciones. El adaptador dual se justifica por la necesidad de un producto verificable sin credenciales y un camino de producción gestionado.
