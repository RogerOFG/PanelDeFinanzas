# PanelDeFinanzas

Panel administrativo de finanzas personales — cuentas en COP/USD, transacciones,
metas de ahorro, préstamos y deudas/suscripciones con recordatorios. Corre
100% en el navegador (sin backend), con los datos guardados en `localStorage`.

## Requisitos

- Un navegador moderno.
- Node.js (para servir la app localmente con `npx serve`).

## Cómo correr el proyecto en local

1. Clona el repositorio.
2. Desde la carpeta del proyecto, levanta un servidor local en el **puerto 3000**
   (el login con Google está autorizado solo para ese origen):

   ```bash
   npx serve . -l 3000
   ```

3. Abre en el navegador: **http://localhost:3000**

> Google Identity Services exige servir el sitio por HTTP(S), no funciona abriendo
> `index.html` directo con doble clic (`file://`).

## Configurar el login con Gmail

El login usa [Google Identity Services](https://developers.google.com/identity/gsi/web) —
no requiere backend, solo un Client ID de OAuth.

1. Ve a [Google Cloud Console → Credenciales](https://console.cloud.google.com/apis/credentials).
2. Crea un **ID de cliente de OAuth** tipo **Aplicación web**.
3. En **Orígenes de JavaScript autorizados** agrega cada URL desde donde abrirás la app
   (ej. `http://localhost:3000`, y luego la URL de producción cuando la despliegues).
4. Copia el **Client ID** y pégalo en [`js/auth.js`](js/auth.js) → `AUTH_CONFIG.CLIENT_ID`.
5. Agrega tu(s) Gmail en `AUTH_CONFIG.ALLOWED_EMAILS` para restringir el acceso solo a ti.

El archivo de credenciales que descarga Google (`client_secret_*.json`) **no se sube
a GitHub** (está en `.gitignore`) — solo se usa el `client_id` público dentro de `auth.js`.

## Estructura

```
index.html
css/style.css
js/
  storage.js       # persistencia en localStorage
  utils.js         # formato de moneda, fechas, etc.
  ui.js            # modales y toasts
  auth.js          # login con Google
  exchangeRate.js  # tasa de cambio USD/COP automática
  app.js           # navegación y arranque
  views/           # una vista por módulo (cuentas, transacciones, metas, préstamos, deudas, ajustes)
```

## Próximos pasos

- Conectar a una base de datos real (Postgres/Neon, Supabase, etc.) para
  sincronizar entre dispositivos — actualmente todo vive en el navegador.
