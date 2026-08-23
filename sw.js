// Service worker mínimo: solo cachea el "shell" estático (HTML/CSS/JS/íconos)
// para que Chrome considere la app instalable. Nunca cachea /api/* — los
// datos financieros siempre deben venir del servidor, no de una copia vieja.
const CACHE_NAME = 'finbot-shell-v2';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/storage.js',
  '/js/utils.js',
  '/js/ui.js',
  '/js/auth.js',
  '/js/exchangeRate.js',
  '/js/app.js',
  '/js/views/dashboard.js',
  '/js/views/cuentas.js',
  '/js/views/transacciones.js',
  '/js/views/metas.js',
  '/js/views/prestamos.js',
  '/js/views/deudas.js',
  '/js/views/ajustes.js',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Deja pasar todo lo que no sea del propio origen (Google Fonts, Google Identity, etc.)
  // y cualquier llamada a la API — esas siempre van directo a la red.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET') return;

  // Network-first: siempre intenta traer la versión más reciente del shell;
  // solo cae al caché si no hay red (offline). Con cache-first el navegador
  // quedaba pegado a una copia vieja del HTML/CSS/JS para siempre, aunque
  // se publicaran cambios — network-first evita ese problema.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
