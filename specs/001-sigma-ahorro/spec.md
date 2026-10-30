# Feature Specification: Sigma Ahorro

**Feature Branch**: `001-sigma-ahorro`
**Created**: 2026-10-30
**Status**: Implemented (v1) — ver `PROGRESS.md`
**Input**: Aplicación web privada de finanzas personales con IA, inspirada funcionalmente en DebAi.

## User Scenarios & Testing

### User Story 1 - Consultar situación financiera (Priority: P1)

Como persona usuaria quiero abrir Sigma Ahorro y ver en segundos cuánto gasté, cuánto ingresó, mi balance, el presupuesto consumido, los topes por categoría, mis metas y los próximos vencimientos, para decidir sin navegar por varias pantallas.

**Why this priority**: Es el núcleo de valor y el destino natural de cada registro.

**Independent Test**: Con datos cargados, el dashboard muestra totales calculados desde la base para el período elegido, con comparación contra el período anterior y desglose por categoría.

**Acceptance Scenarios**:
1. **Given** movimientos del mes, **When** abro Inicio, **Then** veo gastos, ingresos, balance, presupuesto y topes reales.
2. **Given** un gasto nuevo, **When** lo confirmo, **Then** el dashboard se recalcula sin intervención manual.
3. **Given** un usuario nuevo, **When** abre Inicio, **Then** ve estados vacíos con acciones claras, sin cifras inventadas.

---

### User Story 2 - Registrar un movimiento en segundos (Priority: P1)

Quiero registrar gastos e ingresos escribiendo una frase, hablando, sacando una foto del ticket o completando un formulario, revisar la propuesta y confirmarla.

**Why this priority**: La fricción de registro es el problema central del producto.

**Independent Test**: Cada modalidad produce un borrador editable; al confirmar se persiste un movimiento con importe, moneda, fecha, categoría y origen correctos.

**Acceptance Scenarios**:
1. **Given** la frase "Hoy gasté 12.500 pesos en el supermercado", **When** la interpreto, **Then** obtengo gasto ARS 12.500, fecha hoy, categoría Supermercado y comercio.
2. **Given** una foto de ticket, **When** la proceso, **Then** veo comercio, total, fecha y categoría editables antes de guardar.
3. **Given** un movimiento guardado, **When** edito o elimino, **Then** el cambio queda auditado y los totales se actualizan.

---

### User Story 3 - Controlar presupuestos y topes (Priority: P2)

Quiero definir límites mensuales/semanales por categoría y ver consumo, saldo, proyección y alertas.

**Independent Test**: Un presupuesto de $100.000 con gastos de $80.000 muestra 80%, saldo $20.000 y alerta al superar el umbral configurado.

**Acceptance Scenarios**:
1. **Given** gastos que superan el 90%, **When** consulto presupuestos, **Then** veo alerta y proyección.
2. **Given** un presupuesto vencido, **When** cambio de período, **Then** el cálculo usa el rango correcto en zona horaria argentina.

---

### User Story 4 - Planificar el futuro (Priority: P2)

Quiero crear metas de ahorro, deudas, gastos recurrentes y pagos planificados, y ver qué vence pronto.

**Independent Test**: Una recurrencia mensual genera como máximo un movimiento por período al ejecutar el cron dos veces; una deuda refleja pagos parciales y saldo.

**Acceptance Scenarios**:
1. **Given** una recurrencia con próxima fecha hoy, **When** corre el cron, **Then** crea el gasto una sola vez y avanza la fecha.
2. **Given** una meta con aportes, **When** registro un retiro, **Then** el progreso disminuye y queda historial.

---

### User Story 5 - Operar en varias monedas (Priority: P2)

Quiero registrar en ARS, USD, EUR y otras monedas, ver el importe original y su equivalente consolidado en mi moneda principal.

**Independent Test**: USD 20 con cotización 1.200 ARS/USD consolida ARS 24.000 y conserva el original; cambiar la cotización luego no altera el histórico.

**Acceptance Scenarios**:
1. **Given** una cotización cacheada, **When** registro un gasto USD, **Then** se guarda tasa y equivalente.
2. **Given** falta de cotización, **When** intento consolidar, **Then** el sistema lo informa y permite cargar tasa manual.

---

### User Story 6 - Consultar con IA y asistente (Priority: P2)

Quiero preguntar "¿cuánto gasté en comida este mes?" o "¿me queda para salir a comer?" y recibir respuestas calculadas sobre datos reales.

**Independent Test**: Las preguntas de gasto, categoría, presupuesto y top devuelven cifras idénticas a las consultas SQL de referencia; una orden de escritura devuelve un borrador sujeto a confirmación.

**Acceptance Scenarios**:
1. **Given** gastos de comida, **When** pregunto por el mes, **Then** la cifra coincide con Movimientos filtrados.
2. **Given** "agregá 15.000 de combustible", **When** respondo, **Then** recibo un borrador y nada se guarda hasta confirmar.

---

### User Story 7 - Compartir y dividir gastos (Priority: P3)

Quiero crear listas para pareja, viajes o roommates, registrar quién pagó y cómo se divide, y ver saldos.

**Independent Test**: Un gasto de $30.000 pagado por A dividido entre A, B y C produce deudas de $10.000 de B y C hacia A; un settlement cancela el saldo.

**Acceptance Scenarios**:
1. **Given** una lista con tres miembros, **When** divido equitativamente, **Then** los saldos suman cero.
2. **Given** una invitación, **When** se acepta, **Then** el miembro se incorpora sin ver otras listas.

---

### User Story 8 - Importar, analizar y exportar (Priority: P3)

Quiero importar un CSV/XLSX bancario con vista previa y detección de duplicados, analizar tendencias y exportar CSV/XLSX/PDF.

**Independent Test**: Importar dos veces el mismo archivo no duplica movimientos; la exportación respeta los filtros y los importes coinciden.

**Acceptance Scenarios**:
1. **Given** un CSV con columnas fecha/importe/descripción, **When** mapeo y confirmo, **Then** se crean movimientos y se reportan duplicados.
2. **Given** un rango de fechas, **When** exporto, **Then** el archivo contiene exactamente esos movimientos.

---

### Edge Cases

- Zona horaria: un gasto a las 23:30 de Argentina debe pertenecer al día/mes argentino, no UTC.
- Importes con separadores `12.500,50`, `12,500.50`, `$ 12.500`, negativos y decimales.
- Cotización faltante o proveedor caído: no inventar tasa; informar y permitir carga manual.
- Recurrencia ejecutada dos veces o en paralelo: idempotencia por clave única.
- Ticket procesado dos veces: detectar por hash y por huella fecha+monto+comercio.
- IA devuelve JSON inválido o campos fuera de esquema: descartar y usar parser determinista o pedir revisión.
- Sesión expirada: redirigir a login sin perder el borrador cuando sea posible.
- Eliminación de cuenta: borrar datos propios y adjuntos, conservar solo auditoría mínima anonimizada.
- Presupuesto con moneda distinta a la principal: convertir con tasa histórica del movimiento.

## Requirements

### Functional Requirements

- **FR-001**: El sistema MUST autenticar con email/contraseña, sesión HttpOnly firmada y bloqueo tras intentos fallidos; sin registro público.
- **FR-002**: El sistema MUST permitir crear la cuenta propietaria una sola vez mediante `/setup`.
- **FR-003**: El sistema MUST persistir usuarios, preferencias, cuentas, categorías, etiquetas, movimientos, adjuntos, presupuestos, metas, aportes, deudas, pagos, recurrencias, pagos planificados, monedas, cotizaciones, listas, miembros, gastos compartidos, divisiones, liquidaciones, invitaciones, importaciones, trabajos IA, reglas de clasificación, notificaciones y auditoría.
- **FR-004**: Los importes MUST almacenarse como enteros en unidades mínimas y formatearse según moneda/locale.
- **FR-005**: El dashboard MUST calcular gastos, ingresos, balance, comparación, presupuesto, topes, categorías, últimos movimientos, próximos pagos, metas y alertas para semana/mes/año/rango.
- **FR-006**: El registro manual MUST validar tipo, importe, moneda, fecha, categoría y permitir comercio, método de pago, cuenta, etiquetas, notas y adjunto.
- **FR-007**: El registro por texto MUST interpretar español rioplatense: montos, monedas, fechas relativas, tipo, comercio y categoría; MUST devolver un borrador editable.
- **FR-008**: El registro por voz MUST transcribir audio cuando el proveedor esté configurado y ofrecer fallback de texto; el navegador puede usar Web Speech API.
- **FR-009**: El registro por foto MUST ejecutar OCR local (Tesseract) y/o visión configurada, extraer comercio/fecha/total/moneda/categoría y exigir confirmación.
- **FR-010**: El sistema MUST detectar duplicados por hash de imagen y por huella normalizada fecha+monto+comercio+moneda.
- **FR-011**: La IA MUST validar toda salida con Zod; MUST NOT escribir directamente en la base; las escrituras requieren confirmación.
- **FR-012**: El asistente MUST responder consultas de totales, categorías, topes, presupuestos, mayores gastos, períodos y comparaciones usando servicios deterministas; las propuestas de escritura quedan pendientes.
- **FR-013**: Categorías MUST ser editables, jerárquicas, con color/icono y presupuesto; MUST existir las 17 categorías iniciales.
- **FR-014**: La clasificación MUST aprender de correcciones mediante reglas comercio→categoría reutilizables.
- **FR-015**: Presupuestos MUST soportar períodos semanal/mensual/anual/personalizado, general o por categoría, con umbrales configurables 50/75/90/100/excedido y proyección.
- **FR-016**: Metas MUST registrar aportes y retiros, progreso, restante y proyección.
- **FR-017**: Deudas MUST soportar dirección, contraparte, cuotas, vencimiento, pagos parciales, saldo y estado.
- **FR-018**: Recurrentes MUST soportar frecuencias diaria a anual y personalizada, pausa, fin, próxima ejecución e idempotencia.
- **FR-019**: Pagos planificados MUST mostrar pendiente/vencido/pagado/cancelado, días restantes y prioridad.
- **FR-020**: Monedas MUST incluir ARS, USD, EUR, BRL, CLP, UYU, GBP, JPY; cotizaciones con fuente/fecha y sin recálculo histórico.
- **FR-021**: Listas compartidas MUST permitir miembros, quién pagó, división equitativa/porcentaje/importe, exclusiones, saldos, pagos parciales y liquidaciones, con aislamiento por lista.
- **FR-022**: Estadísticas MUST incluir evolución, categorías, comparación, comercios, métodos de pago, promedio diario, proyección y balance.
- **FR-023**: Exportación MUST generar CSV, XLSX y PDF filtrados.
- **FR-024**: Importación MUST aceptar CSV/XLSX, mapear columnas, previsualizar, detectar duplicados y confirmar antes de persistir.
- **FR-025**: Notificaciones in-app MUST cubrir presupuestos, vencimientos, deudas, metas y recurrentes, sin duplicados excesivos.
- **FR-026**: Preferencias MUST incluir tema, moneda principal, locale, formatos, umbrales y notificaciones; i18n preparada para es/en/de.
- **FR-027**: Seguridad MUST incluir hash bcrypt, JWT firmado, rate limit de login, autorización por user_id, adjuntos autenticados, auditoría y eliminación de datos.
- **FR-028**: La app MUST ser PWA instalable con manifest e iconos y no cachear datos financieros privados.
- **FR-029**: El sistema MUST exponer un cron protegido para recurrencias y alertas.
- **FR-030**: El sistema MUST funcionar con SQLite local sin configuración y con PostgreSQL/Supabase mediante `DATABASE_URL`.

### Key Entities

Usuario, preferencias, cuenta, categoría, etiqueta, movimiento, adjunto, presupuesto, meta, aporte, deuda, pago de deuda, recurrencia, pago planificado, moneda, cotización, lista compartida, miembro, gasto compartido, división, liquidación, invitación, importación, fila de importación, trabajo IA, regla de clasificación, notificación y auditoría. Ver `data-model.md`.

## Success Criteria

- **SC-001**: Registrar un gasto por texto o manual insume menos de 30 segundos y 4 interacciones.
- **SC-002**: El 100% de los totales del dashboard coincide con agregados SQL de referencia.
- **SC-003**: No se pierde ni duplica un movimiento al ejecutar dos veces cron o importación.
- **SC-004**: Conversiones y divisiones cierran con diferencia cero (enteros) y redondeo half-away-from-zero.
- **SC-005**: Build de producción, typecheck, lint y tests unitarios pasan en la entrega.
- **SC-006**: La app es usable a 375px, 768px, 1024px y 1440px, en claro y oscuro, con foco visible.
- **SC-007**: Un usuario no autorizado no accede a datos ni adjuntos de otro usuario.

## Assumptions

- Uso personal inicial, un propietario; listas compartidas usan miembros nombrados y aceptación por enlace para usuarios autenticados.
- Argentina/ARS/es-AR/America/Argentina/Buenos_Aires por defecto.
- No se integran APIs bancarias ni se leen notificaciones del sistema: la importación es CSV/XLSX y la arquitectura queda preparada para open banking.
- Sin claves de IA, el parser determinista y el OCR local cubren el flujo; con claves se mejora la extracción.
- El despliegue productivo usa PostgreSQL/Supabase; SQLite es el runtime local sin configuración.
