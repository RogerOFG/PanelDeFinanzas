# PanelDeFinanzas (FinBot)

Panel de finanzas personales — cuentas en COP/USD, transacciones, metas de
ahorro, préstamos, y deudas/suscripciones (con miembros compartidos y
recordatorios). El frontend es HTML/CSS/JS sin build, y habla con un backend
propio (Node/Express + PostgreSQL) que guarda los datos en la nube, así que
puedes entrar desde cualquier dispositivo con tu cuenta de Google. También es
instalable como app (PWA) gracias a `manifest.json` + `sw.js`.

## Requisitos

- Node.js (para correr el backend y para servir el frontend localmente).
- Una base de datos PostgreSQL (por ejemplo [Neon](https://neon.tech), que
  tiene un plan gratuito).

## Cómo correr el proyecto en local

Son **dos procesos separados** corriendo al mismo tiempo: el backend (API) y
el frontend (archivos estáticos). Necesitas dos terminales.

**1. Backend** — desde `backend/`:

```bash
cd backend
npm install
cp .env.example .env   # y completa las variables (ver siguiente sección)
npm start
```

Queda escuchando en `http://localhost:4000`. Al arrancar corre solo, una
migración idempotente que agrega cualquier columna nueva que falte en la base
de datos (no hay un framework de migraciones aparte — ver `backend/db.js`).

**2. Frontend** — desde la raíz del proyecto, en otra terminal:

```bash
npx serve . -l 3000
```

Abre en el navegador: **http://localhost:3000**

> El login con Google exige servir el sitio por HTTP(S), no funciona abriendo
> `index.html` directo con doble clic (`file://`). El puerto 3000 importa:
> tiene que coincidir con `ALLOWED_ORIGIN` del backend y con los orígenes
> autorizados en Google Cloud Console (ver abajo).

## Configurar el backend (`backend/.env`)

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Cadena de conexión de tu base Postgres (ej. la que te da Neon). |
| `GOOGLE_CLIENT_ID` | El mismo Client ID de OAuth que configuras en `js/auth.js` (ver abajo). |
| `SESSION_SECRET` | Cualquier cadena larga y aleatoria — firma los tokens de sesión (JWT). |
| `ALLOWED_EMAILS` | Gmail(s) permitidos para entrar, separados por coma. Vacío = cualquiera con Google puede entrar. |
| `PORT` | Puerto del backend (por defecto `4000`). |
| `ALLOWED_ORIGIN` | Origen desde el que se sirve el frontend (CORS) — `http://localhost:3000` en local. |

## Configurar el login con Gmail

El login usa [Google Identity Services](https://developers.google.com/identity/gsi/web)
en el navegador; el backend valida ese token y emite su propia sesión (JWT,
30 días) para que no dependas de que el token de Google siga vivo.

1. Ve a [Google Cloud Console → Credenciales](https://console.cloud.google.com/apis/credentials).
2. Crea un **ID de cliente de OAuth** tipo **Aplicación web**.
3. En **Orígenes de JavaScript autorizados** agrega cada URL desde donde abrirás la app
   (ej. `http://localhost:3000`, y luego la URL de producción cuando la despliegues).
4. Copia el **Client ID** y pégalo en dos lugares:
   - [`js/auth.js`](js/auth.js) → `AUTH_CONFIG.CLIENT_ID`
   - `backend/.env` → `GOOGLE_CLIENT_ID`
5. Agrega tu(s) Gmail en `ALLOWED_EMAILS` (en `backend/.env`, y opcionalmente
   también en `AUTH_CONFIG.ALLOWED_EMAILS` dentro de `js/auth.js` para el
   mensaje de error temprano en el navegador) para restringir el acceso solo
   a ti.

El archivo de credenciales que descarga Google (`client_secret_*.json`) **no
se sube a GitHub** (está en `.gitignore`) — solo se usan los Client ID
públicos, nunca ese archivo.

## Desplegar a producción

No hay CI/CD configurado: un `git push` a este repo **no actualiza** el
servidor de producción por sí solo. Para que un cambio llegue hay que, en el
servidor:

1. `git pull origin main`
2. Reiniciar el proceso del backend (para que tome las rutas nuevas y corra
   la migración automática de `db.migrate()`).
3. Si nginx u otro servidor sirve el frontend desde una copia separada del
   repo (no directamente desde esta carpeta), confirmar que esa copia
   también se actualizó.

`backend/Dockerfile` está disponible si prefieres desplegar el backend como
contenedor.

## Instalar como app (PWA)

El sitio declara `manifest.json` y registra un service worker (`sw.js`), así
que Chrome/Edge en Android y desktop ofrecen "Instalar app" (icono en la
barra de direcciones, o "Agregar a pantalla de inicio" en el celular). Esto
solo funciona servido por HTTPS en producción (o en `localhost` para
pruebas) — el service worker no se registra por HTTP plano.

## Estructura

```
index.html
manifest.json         # metadata de la PWA (nombre, íconos, colores)
sw.js                 # service worker: cachea el shell estático, nunca /api/*
css/style.css
assets/               # íconos de la app
js/
  storage.js          # capa que habla con el backend (fetch a /api/*)
  utils.js            # formato de moneda, fechas, iconos SVG compartidos, etc.
  ui.js               # modales, toasts, selects e inputs de dinero reutilizables
  auth.js             # login con Google + sesión propia (JWT del backend)
  exchangeRate.js      # tasa de cambio USD/COP automática
  app.js              # navegación, skeletons de carga y arranque
  views/              # una vista por módulo (dashboard, cuentas, transacciones,
                       # metas, préstamos, deudas, ajustes)
backend/
  server.js           # arranque de Express + montaje de rutas
  db.js               # pool de Postgres + migraciones idempotentes al arrancar
  middleware/auth.js  # valida el JWT de sesión en cada request
  routes/             # un router por recurso (cuentas, transacciones, deudas, etc.)
```

## Próximos pasos

- Configurar un despliegue automático (CI/CD) para que `git push` a `main`
  actualice producción sin pasos manuales.
