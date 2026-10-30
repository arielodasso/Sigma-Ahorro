# Sigma Ahorro Constitution

## Core Principles

### I. Producto real, no demostración
Toda funcionalidad visible debe operar sobre datos persistidos y verificables. No se admiten botones inertes, cifras ficticias presentadas como reales, integraciones simuladas ni flujos que solo funcionen con mocks. Los datos de ejemplo, si existen, deben estar rotulados y poder eliminarse.

### II. Dinero exacto y trazabilidad
Los importes se almacenan en unidades mínimas enteras (`amount_minor`) y nunca en punto flotante. Cada movimiento conserva moneda original, cotización aplicada, fuente y fecha. Las modificaciones financieras generan auditoría y las operaciones automáticas son idempotentes.

### III. Privacidad y autorización por defecto
La aplicación es privada: no hay registro público. Toda consulta y mutación valida la sesión y el `user_id` propietario. Los secretos viven en variables de entorno del servidor. La IA nunca escribe directamente en la base: propone operaciones validadas por Zod y confirmadas por la persona usuaria.

### IV. Separación de dominio e infraestructura
UI, server actions, servicios de dominio, repositorios y adaptadores de proveedores están separados. La lógica financiera (conversión, presupuestos, recurrencias, divisiones) vive en módulos puros y testeables, reutilizados por web, cron, importación y asistente. No se duplica lógica de negocio.

### V. Accesibilidad y consistencia visual
Interfaz mobile-first y responsive, modo claro/oscuro, contraste AA, foco visible, navegación por teclado, etiquetas de formulario y estados de carga/vacío/error/éxito. Identidad propia Sigma: minimalismo fintech, tipografía IBM Plex, verde Sigma, sin emojis estructurales ni gradientes decorativos.

### VI. Verificación antes de declarar terminado
Cada módulo requiere typecheck, lint, tests unitarios de su lógica y build de producción. Las pruebas se ejecutan de verdad y sus resultados se registran. Las dependencias externas no configuradas se documentan como bloqueo, no se simulan.

## Restricciones técnicas

- Next.js App Router + TypeScript estricto + Tailwind CSS + componentes shadcn-style.
- Persistencia: SQLite local (better-sqlite3) y PostgreSQL/Supabase vía `DATABASE_URL`, con el mismo esquema lógico y adaptador de consultas.
- Auth local: bcrypt + JWT HttpOnly firmado; Supabase Auth y RLS preparados en `supabase/migrations` para despliegue gestionado.
- IA: capa de proveedores intercambiable (OpenAI-compatible / Anthropic-compatible) con parser determinista en español rioplatense como fallback sin claves.
- OCR local con Tesseract.js y extracción asistida opcional por modelo de visión.
- Cotizaciones por proveedor configurable, cacheadas con fuente y fecha; nunca se recalculan movimientos históricos.
- Despliegue objetivo: Vercel + Supabase/Postgres; cron protegido por `CRON_SECRET`.

## Flujo de desarrollo

1. Especificar y clarificar antes de planificar.
2. Planificar con modelo de datos y contratos.
3. Implementar por módulos verticales con trazabilidad a requisitos.
4. Ejecutar tests, typecheck, lint y build.
5. Actualizar `PROGRESS.md`, `TASKS.md` y documentación de bloqueos.

## Governance

La constitución prevalece sobre atajos de implementación. Cualquier violación debe justificarse en el plan y registrarse. Los cambios de alcance se reflejan primero en `specs/001-sigma-ahorro/spec.md` y luego en tareas y código.

**Version**: 1.0.0 | **Ratified**: 2026-10-30 | **Last Amended**: 2026-10-30
