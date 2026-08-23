# PanelDeFinanzas (FinBot)

Panel de finanzas personales — cuentas en COP/USD, transacciones, metas de
ahorro, préstamos, deudas y suscripciones (con miembros que comparten el
gasto y recordatorios), tarjetas de crédito (fecha de corte, compras a
cuotas y cuota de manejo configurable), e historial mensual de
ingresos/gastos por categoría. El frontend es HTML/CSS/JS sin build, y habla
con un backend propio (Node/Express + PostgreSQL) que guarda los datos en la
nube, así que puedes entrar desde cualquier dispositivo con tu cuenta de
Google. También es instalable como app (PWA) gracias a `manifest.json` +
`sw.js`.

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
migración idempotente que crea las tablas/columnas nuevas que falten en la
base de datos (no hay un framework de migraciones aparte — ver
`backend/db.js`).

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
en el navegador; el backend valida ese token **una sola vez** contra Google y
a cambio emite su propia sesión (JWT firmado con `SESSION_SECRET`, válida 30
días) — así la app no depende de que el token de Google (que dura ~1 hora)
siga vivo, y no hace falta volver a iniciar sesión todo el tiempo.

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

## Desplegar a producción (CI/CD)

Cada `git push` a `main` dispara [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
que despliega automáticamente sin pasos manuales:

1. **`test`** — revisa la sintaxis de todos los `.js` del repo (`node --check`).
   Si algo no compila, el despliegue se cancela ahí y producción no se toca.
2. **`deploy`** — se conecta por SSH al servidor, actualiza el código
   (`git fetch` + `git reset --hard origin/main`, lo que también deja el
   frontend estático al día porque nginx lo sirve directo de esa misma
   carpeta), construye una imagen Docker nueva del backend y la levanta en un
   puerto aparte (`4001`) para probarla en caliente contra `/health` antes de
   tocar nada. Solo si responde sana, la pone en el puerto real (`4000`) y
   reemplaza el contenedor anterior — si falla, producción queda intacta y el
   contenedor viejo sigue corriendo.

Requiere estos secretos configurados en el repo de GitHub (Settings →
Secrets → Actions): `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`. El servidor
necesita Docker instalado y `~/finbot` con un checkout de este repo y su
propio `backend/.env` (no versionado — se crea a mano una vez ahí).

`backend/Dockerfile` es la imagen que usa ese pipeline; también sirve para
correr el backend en contenedor en cualquier otro lado.

## Instalar como app (PWA)

El sitio declara `manifest.json` y registra un service worker (`sw.js`), así
que Chrome/Edge en Android y desktop ofrecen "Instalar app" (icono en la
barra de direcciones, o "Agregar a pantalla de inicio" en el celular). El
service worker usa estrategia *network-first* para el shell estático (HTML/
CSS/JS): siempre intenta traer la versión más nueva y solo cae al caché si no
hay red, para que un despliegue nuevo no quede "pegado" en una copia vieja.
Nunca cachea `/api/*` — los datos financieros siempre vienen del servidor.
Esto solo funciona servido por HTTPS en producción (o en `localhost` para
pruebas) — el service worker no se registra por HTTP plano.

## Estructura

```
index.html
manifest.json         # metadata de la PWA (nombre, íconos, colores)
sw.js                 # service worker: cachea el shell estático, nunca /api/*
css/style.css
assets/               # íconos de la app
js/
  storage.js          # capa que habla con el backend (fetch a /api/*), caché en memoria
  utils.js            # formato de moneda/fechas, iconos SVG e íconos de categoría compartidos
  ui.js               # modales, toasts, selects e inputs de dinero reutilizables
  auth.js             # login con Google + sesión propia (JWT del backend)
  exchangeRate.js      # tasa de cambio USD/COP automática
  app.js              # navegación, notificaciones, skeletons de carga y arranque
  views/
    dashboard.js      # resumen: patrimonio, cuentas, movimientos recientes, próximos pagos
    cuentas.js         # cuentas multi-moneda (efectivo, banco, inversión, terceros)
    transacciones.js  # historial con filtros por cuenta/tipo/categoría y agrupación por fecha
    metas.js           # metas de ahorro
    prestamos.js       # préstamos dados/recibidos
    deudas.js          # deudas y suscripciones (incluye miembros que comparten el pago)
    tarjetas.js        # tarjetas de crédito: corte, compras a cuotas, cuota de manejo
    historial.js       # historial mensual de ingresos/gastos por categoría
    ajustes.js         # configuración general
backend/
  server.js           # arranque de Express + montaje de rutas
  db.js               # pool de Postgres + migraciones idempotentes al arrancar
  middleware/auth.js  # valida el JWT de sesión propio en cada request
  routes/
    auth.js           # intercambia el token de Google por la sesión propia (JWT 30 días)
    cuentas.js
    transacciones.js
    metas.js
    prestamos.js
    deudas.js          # incluye /deudas/:id/pago y los endpoints de miembros
    miembros.js        # miembros de una suscripción compartida y sus pagos
    tarjetas.js        # tarjetas, compras a cuotas y pago del extracto mensual
    config.js          # preferencias generales (tasa de cambio, etc.)
```
