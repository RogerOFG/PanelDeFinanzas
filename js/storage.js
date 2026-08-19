// Capa de persistencia — usa localStorage como base de datos del navegador.
const DB_KEY = 'finbot_db_v1';

const DEFAULT_DB = {
  config: {
    tasaCambio: 4000, // 1 USD = X COP — se actualiza automáticamente, pero editable como respaldo
    monedaBase: 'COP',
    tasaCambioAuto: true, // si es true, se refresca sola desde una API pública
    tasaCambioActualizada: null // fecha ISO de la última actualización automática exitosa
  },
  cuentas: [],       // {id, nombre, tipo, moneda, saldo, titular, esPropia, color, notas, creada}
  transacciones: [], // {id, cuentaId, cuentaDestinoId, tipo, monto, categoria, descripcion, fecha}
  metas: [],         // {id, nombre, montoObjetivo, montoActual, moneda, fechaLimite, cuentaId, completada}
  prestamos: [],     // {id, tipo(dado|recibido), contraparte, monto, moneda, montoPagado, fecha, fechaLimite, notas, pagos:[], completado}
  deudas: []         // {id, nombre, tipo(suscripcion|deuda), monto, moneda, diaPago, recordatorioDias, activa, notas, historialPagos:[]}
};

const Storage = {
  _db: null,

  load() {
    if (this._db) return this._db;
    try {
      const raw = localStorage.getItem(DB_KEY);
      this._db = raw ? JSON.parse(raw) : structuredCloneCompat(DEFAULT_DB);
    } catch (e) {
      console.error('Error cargando datos, reiniciando DB', e);
      this._db = structuredCloneCompat(DEFAULT_DB);
    }
    // Asegura estructuras faltantes si el esquema evoluciona
    for (const key of Object.keys(DEFAULT_DB)) {
      if (this._db[key] === undefined) this._db[key] = structuredCloneCompat(DEFAULT_DB[key]);
    }
    return this._db;
  },

  save() {
    localStorage.setItem(DB_KEY, JSON.stringify(this._db));
  },

  get(collection) {
    return this.load()[collection];
  },

  insert(collection, obj) {
    const db = this.load();
    obj.id = obj.id || generateId();
    db[collection].push(obj);
    this.save();
    return obj;
  },

  update(collection, id, patch) {
    const db = this.load();
    const item = db[collection].find(i => i.id === id);
    if (!item) return null;
    Object.assign(item, patch);
    this.save();
    return item;
  },

  remove(collection, id) {
    const db = this.load();
    db[collection] = db[collection].filter(i => i.id !== id);
    this.save();
  },

  find(collection, id) {
    return this.load()[collection].find(i => i.id === id);
  },

  setConfig(patch) {
    const db = this.load();
    Object.assign(db.config, patch);
    this.save();
  },

  exportJSON() {
    return JSON.stringify(this.load(), null, 2);
  },

  importJSON(json) {
    const parsed = JSON.parse(json);
    this._db = parsed;
    this.save();
  },

  resetAll() {
    this._db = structuredCloneCompat(DEFAULT_DB);
    this.save();
  }
};

function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

function structuredCloneCompat(obj) {
  return JSON.parse(JSON.stringify(obj));
}
