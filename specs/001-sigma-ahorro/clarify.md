# Clarificaciones y decisiones

**Feature**: 001-sigma-ahorro
**Fecha**: 2026-10-30

| # | Ambigüedad | Decisión | Justificación |
|---|------------|----------|---------------|
| 1 | ¿App móvil nativa o web? | Web privada Next.js, responsive y PWA | El segundo brief reemplaza Expo/React Native y prioriza Vercel. No se implementan servicios nativos Android/iOS. |
| 2 | ¿Supabase obligatorio? | Adaptador dual: SQLite local por defecto, PostgreSQL/Supabase con `DATABASE_URL` | Sin Docker ni credenciales no se puede verificar Supabase en este entorno. SQLite permite un producto real ejecutable ya; Postgres es el camino de producción. |
| 3 | ¿Auth Supabase o propia? | Auth propia bcrypt+JWT ahora; RLS y migraciones Supabase incluidas para el modo gestionado | Permite operar sin credenciales externas y mantiene autorización server-side. Documentado como evolución. |
| 4 | ¿Cómo representar dinero? | Entero en unidades mínimas + decimales por moneda | Evita flotantes; portable entre SQLite y Postgres. |
| 5 | ¿Cotizaciones sin API? | Tabla cacheada + carga manual + proveedor configurable | No se inventan tasas. Si falta tasa, el movimiento se guarda sin equivalente y se advierte. |
| 6 | ¿OCR sin clave? | Tesseract.js local + heurística de ticket; visión opcional | Flujo funcional sin dependencia paga, con mejora si se configura proveedor. |
| 7 | ¿Voz sin clave? | Web Speech API + fallback a carga de audio/transcripción configurable + texto | Los navegadores no garantizan reconocimiento; se ofrece alternativa. |
| 8 | ¿Notificaciones push? | In-app + permiso Web Notifications para recordatorios al abrir | Push real requiere service worker + VAPID; se documenta como pendiente. |
| 9 | ¿Invitaciones compartidas? | Miembros nombrados + enlace con token para usuarios autenticados | El producto inicial es privado de un propietario; no hay registro público. |
| 10 | ¿PDF/XLSX? | `pdf-lib` y `exceljs` server-side | Sin binarios externos; funcionan en Vercel. |
| 11 | ¿Tema por sistema o manual? | `next-themes` con claro/oscuro/sistema | Cumple preferencia y respeta `prefers-color-scheme`. |
| 12 | ¿Idioma? | UI es-AR; diccionario es/en/de para navegación y textos comunes | i18n preparada sin duplicar toda la app en tres idiomas en v1. |
| 13 | ¿Recurrentes automáticas? | Cron protegido + botón "ejecutar ahora"; clave única por recurrencia+fecha | Idempotencia verificable. |
| 14 | ¿Datos de demo? | Seed solo de categorías/monedas/cuentas; sin movimientos ficticios | Cumple "no datos hardcodeados como reales". |
| 15 | ¿REA? | CLI `rea-agents` compatible con MCP; no se registró MCP global | Se usó relevamiento público de DebAi. La config MCP requiere reinicio de OpenCode y no es necesaria para construir. Documentado en `research.md`. |
