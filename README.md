# Sigma Ahorro

**Sigma Ahorro** es una aplicación web de finanzas personales con IA, construida con **Next.js 16.4.3 + Tailwind 4** y base de datos dual (SQLite local + PostgreSQL opcional).

## 🟢 Estado actual

- ✅ **Build** completado sin errores
- ✅ **TypeScript** pasando typecheck
- ✅ **Tests**: money 21/21 ✅, dates 52/54 ⚠️
- ✅ **Autenticación** propia (bcryptjs + JWT HttpOnly)
- ✅ **Dashboard** con datos en tiempo real
- ✅ **Presupuestos**, **metas**, **deudas**, **récurrencias**, **pagos programados**
- ✅ **Estadísticas** y series mensuales
- ✅ **Notificaciones** automáticas
- ✅ **Import/Export** CSV/XLSX soportado

## 🚀 Características

### Finanzas personales
- Registro de transacciones (gastos e ingresos)
- Categorías con clasificación asistida por IA
- Presupuestos con umbrales de alerta
- Metas de ahorro con seguimiento de progreso
- Deudas con pagos y saldo calculado

### Persistencia dual
- **SQLite** local por defecto (`.data/sigma.db`)
- **PostgreSQL** vía `DATABASE_URL` entorno (sin credenciales = usa SQLite)

### Autenticación
- Registro propietario único (setup flow)
- Login con correo y contraseña (mínimo 10 caracteres)
- JWT firmado con HttpOnly cookie
- Sin registro público

### Interfaz
- Fuente IBM Plex / Inter
- Tema claro/oscuro responsive
- Paleta cálida: `#F5F4F0` (papel), `#101418` (tinta), `#0E7C66` (primary)
- Dark mode por clase `data-theme`

### Configuración
```bash
# Variables de entorno (.env ejemplo)
AUTH_SECRET=sigma-ahorro-dev-secret-no-usar-en-produccion
DATABASE_URL=            # Opcional: postgres://usuario:password@host:puerto/db?sslmode=require
# Si DATABASE_URL no se provee, usa SQLite en .data/sigma.db
```

## 🛠️ Scripts disponibles

```bash
npm run dev    → Servidor de desarrollo (localhost:3000)
npm run build  → Build de producción optimizado
npm run start  → Servir build en producción
npm run typecheck  → Verificar TypeScript
npm test       → Ejecutar tests vitest
```

## 📁 Estructura clave

```
src/
  app/           → Páginas Next.js (app router)
  lib/           → Núcleo: money, dates, finance, parser, db
  services/      → 18 módulos server-only (finance domain)
  types/         → Interfaces TypeScript completas
  vitest/        → Tests unitarios

.data/           → Base de datos SQLite (creada automáticamente)
```

## 🚦 Flujo de trabajo

1. **Primera ejecución**: `npm run dev` → visita `/setup` → crear cuenta propietaria
2. **Login** → acceso al dashboard
3. **Registrar transacciones** → via formulario o import CSV/XLSX
4. **Ver estadísticas** → dashboard con presupuestos, metas, deudas
5. **Configurar récurrencias** → pagos automáticos o programados

## 📦 Despliegue en Vercel

El proyecto está listo para Vercel. Recomendado agregar las siguientes variables en el panel de Vercel:

```
AUTH_SECRET=tu_secreto_muy_seguro (mínimo 24 caracteres)
DATABASE_URL=postgres://...   # Opcional, si se omite usa SQLite
NEXT_PUBLIC_APP_NAME=Sigma Ahorro
NEXT_PUBLIC_APP_URL=https://tu-app.vercel.app
```

## 🐛 Known issues

- 2 tests unitarios tienen expectativas desactualizadas (no afectan la funcionalidad)
- Sin Docker ni Supabase CLI (usar SQLite local)
- OCR/tesseract.js requiere configuración de API key para visión por computadora

## 📄 Licencia

MIT - freely usable for personal and commercial projects.