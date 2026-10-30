# Research

## DebAi — relevamiento público (2026-10-30)

Fuente: https://debai.app/es/ (contenido público; no se copiaron recursos propietarios).

- Propuesta: "Tus gastos claros. Solo o en compañía." Registro por voz, foto de ticket, texto y notificaciones bancarias.
- Dashboard: total del mes y topes por categoría como foco principal.
- Listas compartidas: invitación por link, quién pagó, división entre participantes, actualización en vivo, marcar parte pagada.
- Voz: micrófono, transcripción editable antes de enviar; en listas se indica quién pagó.
- Banco: Android lee notificaciones; iOS usa automatización de Atajos; nada se guarda sin confirmar.
- Multimoneda: cada gasto conserva su moneda; total convertido a moneda elegida.
- Planificación: recurrencias automáticas y pagos planificados con vencidos/próximos.
- Personalización: modo minimalista con iconos (en lugar de emojis), modo oscuro, bloqueo biométrico.
- Extras: metas de ahorro, deudas, widgets, es/en/de.
- Estética: minimalismo suizo, mucho aire, tarjetas limpias, jerarquía tipográfica fuerte, un acento de color, números protagonistas.

### Traducción a Sigma Ahorro
- Se adopta la misma arquitectura de información, no la marca ni assets.
- Identidad propia: IBM Plex Sans/Mono, verde Sigma, papel cálido, tarjetas de radio moderado, iconografía Lucide.
- En web no se leen notificaciones del sistema: se implementa importación CSV/XLSX y se documenta open banking futuro.
- Se mantiene la regla "nada se guarda sin confirmación" en todas las modalidades.

## UI UX Pro Max

- Instalado `ui-ux-pro-max-cli` y ejecutado `uipro init --ai opencode`.
- Sistema generado y persistido en `design-system/sigma-ahorro/MASTER.md` con consultas de fintech/minimalismo, charts y UX de formularios.
- Se ajusta la paleta generada (oro/púrpura) para evitar el anti-patrón "AI purple/pink gradients" y priorizar el verde financiero.
- Reglas aplicadas: contraste AA, foco visible, labels, error inline + resumen, estados de carga, reduced motion, targets 44px, charts con tabla/etiquetas y no solo color.

## Spec Kit

- `specify-cli 0.12.18` inicializado con `specify init --here --integration opencode --script ps`.
- Comandos en `.opencode/commands/speckit.*`; artefactos en `specs/001-sigma-ahorro/`.
- Se ejecutó el flujo de artefactos (constitución → spec → clarify → plan → tasks → analyze) y se mantiene trazabilidad en `TASKS.md`.

## REA

- Repo oficial `morluto/rea`, paquete `rea-agents`, MCP local para análisis de binarios, apps JS/Electron, .NET y sitios web.
- Compatible con OpenCode vía registro MCP manual; el setup interactivo no se ejecutó para no modificar configuración global del agente.
- Para este proyecto el análisis de un sitio público se cubrió con `webfetch`; no se accedió a código privado ni se eludieron protecciones.
- Capacidades nativas (Hopper/Ghidra/IDA) no son necesarias. Se documenta la activación MCP en `README.md`.

## Decisiones técnicas

| Tema | Decisión | Alternativa descartada |
|------|----------|------------------------|
| Runtime local | SQLite better-sqlite3 | Supabase local: requiere Docker, no disponible |
| Producción | PostgreSQL/Supabase por `DATABASE_URL` | Solo SQLite: no persiste en Vercel |
| Dinero | Enteros minor units | NUMERIC/float: errores y diferencias entre motores |
| Auth | bcrypt + JWT HttpOnly | Supabase Auth: no verificable sin credenciales; queda preparado |
| IA | Provider abstraction + parser determinista | Dependencia dura de un LLM: no funciona sin clave |
| OCR | Tesseract.js local | Solo visión por API: no funciona sin clave |
| Voz | Web Speech API + API de transcripción opcional | Solo API paga: falla en navegadores sin soporte |
| Charts | Recharts | Librería pesada/D3 a medida |
| Export | papaparse + exceljs + pdf-lib | Servicios externos |
