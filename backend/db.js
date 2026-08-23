const { Pool, types } = require('pg');

// Postgres devuelve columnas NUMERIC como texto por defecto (para no perder precisión).
// Como este proyecto no maneja cifras que exijan precisión arbitraria, las convertimos
// a número de una vez aquí para que toda la app pueda sumar/restar montos sin bugs.
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

// Postgres devuelve columnas DATE como objeto Date (medianoche UTC) por defecto.
// El front espera siempre texto 'YYYY-MM-DD', así que dejamos el valor crudo tal cual
// llega del servidor (que ya viene en ese formato) en vez de parsearlo a Date.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// El proyecto no usa un framework de migraciones — las columnas nuevas se
// agregan de forma idempotente al arrancar el backend, así siempre coinciden
// con lo que esperan las rutas sin importar dónde corra (local o producción).
async function migrate() {
  await pool.query(`ALTER TABLE deudas ADD COLUMN IF NOT EXISTS categoria TEXT;`);
}

module.exports = pool;
module.exports.migrate = migrate;
