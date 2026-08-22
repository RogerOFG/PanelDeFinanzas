// Capa de persistencia — habla con el backend (FinBot API -> Neon Postgres).
// Mantiene en memoria una copia (this._db) para que el resto de la app siga
// leyendo/escribiendo de forma síncrona como antes; las escrituras se
// reflejan primero en memoria (optimista) y se sincronizan en segundo plano.

const API_BASE = window.FINBOT_API_BASE || 'http://localhost:4000/api';
const PREFS_KEY = 'finbot_prefs_v1'; // solo preferencias locales de la tasa de cambio (no es data financiera)

const ENDPOINTS = {
  cuentas: '/cuentas',
  transacciones: '/transacciones',
  metas: '/metas',
  prestamos: '/prestamos',
  deudas: '/deudas'
};

async function apiFetch(path, options = {}) {
  const token = Auth.getToken();
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error de red (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

const Storage = {
  _db: { cuentas: [], transacciones: [], metas: [], prestamos: [], deudas: [], config: { tasaCambio: 4000 } },
  _ready: false,

  // Carga todas las colecciones del usuario autenticado desde el backend.
  async initFromServer() {
    const prefs = loadPrefs();
    const [cuentas, transacciones, metas, prestamos, deudas, config] = await Promise.all([
      apiFetch('/cuentas'),
      apiFetch('/transacciones'),
      apiFetch('/metas'),
      apiFetch('/prestamos'),
      apiFetch('/deudas'),
      apiFetch('/config')
    ]);
    this._db = {
      cuentas, transacciones, metas, prestamos, deudas,
      config: {
        tasaCambio: config.tasaCambio,
        tasaCambioAuto: prefs.tasaCambioAuto !== false,
        tasaCambioActualizada: prefs.tasaCambioActualizada || null
      }
    };
    this._ready = true;
  },

  load() {
    return this._db;
  },

  get(collection) {
    return this._db[collection];
  },

  find(collection, id) {
    // Los IDs vienen como número desde el servidor, pero como string desde
    // atributos data-* del HTML — comparamos como texto para que siempre calcen.
    return this._db[collection].find(i => String(i.id) === String(id));
  },

  insert(collection, obj) {
    const tempId = 'tmp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    obj.id = tempId;
    this._db[collection].push(obj);

    apiFetch(ENDPOINTS[collection], { method: 'POST', body: JSON.stringify(obj) })
      .then(created => {
        const idx = this._db[collection].findIndex(i => i.id === tempId);
        if (idx !== -1) this._db[collection][idx] = created;
      })
      .catch(err => {
        this._db[collection] = this._db[collection].filter(i => i.id !== tempId);
        UI.toast('No se pudo guardar en el servidor: ' + err.message, 'danger');
      });

    return obj;
  },

  update(collection, id, patch) {
    const item = this.find(collection, id);
    if (!item) return null;
    Object.assign(item, patch);

    apiFetch(`${ENDPOINTS[collection]}/${id}`, { method: 'PUT', body: JSON.stringify(item) })
      .then(updated => Object.assign(item, updated))
      .catch(err => UI.toast('No se pudo actualizar en el servidor: ' + err.message, 'danger'));

    return item;
  },

  remove(collection, id) {
    this._db[collection] = this._db[collection].filter(i => String(i.id) !== String(id));
    apiFetch(`${ENDPOINTS[collection]}/${id}`, { method: 'DELETE' })
      .catch(err => UI.toast('No se pudo eliminar en el servidor: ' + err.message, 'danger'));
  },

  // Ya no hace falta persistir "todo el árbol" como en localStorage — cada insert/update/remove
  // sincroniza su propio cambio. Se mantiene como no-op para no romper vistas que aún la llaman
  // tras una mutación optimista directa sobre un objeto ya cacheado (ej: transferencias).
  save() {},

  // Llamadas a acciones específicas del backend (mueven dinero de forma atómica en el servidor).
  aporteMeta(id, monto) {
    return apiFetch(`/metas/${id}/aporte`, { method: 'POST', body: JSON.stringify({ monto }) });
  },
  pagoPrestamo(id, monto) {
    return apiFetch(`/prestamos/${id}/pago`, { method: 'POST', body: JSON.stringify({ monto }) });
  },
  pagoDeuda(id, monto) {
    return apiFetch(`/deudas/${id}/pago`, { method: 'POST', body: JSON.stringify({ monto }) });
  },

  setConfig(patch) {
    Object.assign(this._db.config, patch);
    savePrefs({
      tasaCambioAuto: this._db.config.tasaCambioAuto,
      tasaCambioActualizada: this._db.config.tasaCambioActualizada
    });
    if ('tasaCambio' in patch) {
      apiFetch('/config', { method: 'PUT', body: JSON.stringify({ tasaCambio: this._db.config.tasaCambio }) })
        .catch(err => UI.toast('No se pudo guardar la tasa en el servidor: ' + err.message, 'danger'));
    }
  },

  exportJSON() {
    return JSON.stringify(this._db, null, 2);
  }
};
