# Tasks: Sigma Ahorro

Leyenda: [x] implementado y verificado · [~] implementado, verificación parcial · [ ] pendiente · [!] bloqueado por credenciales/servicio externo.

## Fase 1 — Preparación
- [x] T001 Inspeccionar repositorio y entorno (Node 24, npm, uv, specify, sin Docker/Supabase CLI)
- [x] T002 Inicializar Spec Kit con integración OpenCode
- [x] T003 Instalar UI UX Pro Max y persistir sistema de diseño
- [x] T004 Investigar REA y documentar compatibilidad MCP
- [x] T005 Relevar DebAi público y registrar patrones
- [x] T006 Documentar decisiones y bloqueos (`specs/001-sigma-ahorro/research.md`)

## Fase 2 — Especificación
- [x] T007 Constitución
- [x] T008 Especificación funcional con historias y FR
- [x] T009 Clarificaciones y decisiones
- [x] T010 Plan técnico y arquitectura
- [x] T011 Modelo de datos
- [x] T012 Tareas y criterios de aceptación
- [x] T013 Análisis de consistencia spec/plan/data-model

## Fase 3 — Fundamentos
- [x] T014 Scaffold Next.js 16 + TypeScript + Tailwind 4
- [x] T015 Tokens de diseño, tipografía IBM Plex y modo claro/oscuro
- [x] T016 Primitivas UI (button, card, input, dialog, select, tabs, switch, etc.)
- [x] T017 Shell responsive: sidebar desktop + navegación móvil + quick add
- [x] T018 Adaptador DB SQLite/Postgres, esquema y seed
- [x] T019 Auth: setup propietario, login, sesión JWT, rate limit, guard
- [x] T020 Servicios de preferencias y moneda principal
- [x] T021 Dashboard con agregados reales y selector de período

## Fase 4 — Movimientos e IA
- [x] T022 CRUD de movimientos, filtros, detalle y auditoría
- [x] T023 Categorías iniciales, CRUD, subcategorías y reglas de clasificación
- [x] T024 Parser determinista es-AR (montos, monedas, fechas relativas, tipo, categoría)
- [x] T025 Registro por texto con revisión y confirmación
- [x] T026 Registro por voz (Web Speech API + transcripción opcional + fallback)
- [x] T027 Registro por foto: subida, hash, OCR Tesseract, extracción y revisión
- [x] T028 Detección de duplicados (hash y huella)
- [x] T029 Adjuntos autenticados y almacenamiento local
- [x] T030 Capa de proveedores IA y validación Zod

## Fase 5 — Gestión financiera
- [x] T031 Presupuestos con períodos, umbrales, proyección y alertas
- [x] T032 Metas de ahorro con aportes/retiros e historial
- [x] T033 Deudas con pagos parciales y estado
- [x] T034 Recurrentes con frecuencias, pausa e idempotencia
- [x] T035 Pagos planificados y próximos vencimientos
- [x] T036 Multimoneda, tasas cacheadas, conversión histórica y proveedor configurable
- [x] T037 Estadísticas, gráficos y comparativas

## Fase 6 — Inteligencia y automatización
- [x] T038 Asistente con herramientas deterministas y confirmación de escrituras
- [x] T039 Importación CSV/XLSX con mapeo, preview y duplicados
- [x] T040 Cron protegido de recurrentes y generación de notificaciones
- [x] T041 Notificaciones in-app y permiso Web Notifications

## Fase 7 — Avanzadas
- [x] T042 Listas compartidas, miembros, invitaciones, divisiones y liquidaciones
- [x] T043 Exportación CSV/XLSX/PDF
- [x] T044 PWA (manifest, iconos, offline básico sin cachear datos privados)
- [x] T045 Preferencias, i18n es/en/de, formatos y seguridad de cuenta
- [x] T046 Eliminación de datos y exportación de respaldo

## Fase 8 — Calidad
- [x] T047 Tests unitarios de dinero, parser, presupuestos, recurrencias, divisiones y fechas
- [x] T048 Tests de integración de servicios con SQLite temporal
- [x] T049 Typecheck, lint y build de producción
- [x] T050 Auditoría de seguridad y accesibilidad
- [x] T051 README, `.env.example`, `PROGRESS.md`, migraciones Supabase y Vercel
- [ ] T052 Playwright E2E (requiere navegadores; configuración incluida)
- [!] T053 Supabase Auth + RLS en runtime (requiere proyecto y credenciales)
- [!] T054 Push notifications con VAPID (requiere claves)
- [!] T055 Open banking / lectura de notificaciones nativas (fuera de alcance web)
- [!] T056 OCR/visión y transcripción con proveedor pago (requiere API keys; fallback local operativo)
