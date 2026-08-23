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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tarjetas_credito (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
      nombre TEXT NOT NULL,
      cupo NUMERIC,
      moneda TEXT NOT NULL DEFAULT 'COP',
      dia_corte INTEGER NOT NULL,
      cuota_manejo NUMERIC NOT NULL DEFAULT 0,
      activa BOOLEAN NOT NULL DEFAULT true,
      notas TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS compras_tarjeta (
      id SERIAL PRIMARY KEY,
      tarjeta_id INTEGER NOT NULL REFERENCES tarjetas_credito(id) ON DELETE CASCADE,
      descripcion TEXT NOT NULL,
      monto_total NUMERIC NOT NULL,
      cuotas INTEGER NOT NULL DEFAULT 1,
      cuotas_pagadas INTEGER NOT NULL DEFAULT 0,
      tiene_intereses BOOLEAN NOT NULL DEFAULT false,
      categoria TEXT,
      fecha DATE NOT NULL DEFAULT CURRENT_DATE
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pagos_tarjeta (
      id SERIAL PRIMARY KEY,
      tarjeta_id INTEGER NOT NULL REFERENCES tarjetas_credito(id) ON DELETE CASCADE,
      monto NUMERIC NOT NULL,
      cuenta_id INTEGER REFERENCES cuentas(id),
      transaccion_id INTEGER REFERENCES transacciones(id),
      fecha DATE NOT NULL DEFAULT CURRENT_DATE
    );
  `);
  await pool.query(`ALTER TABLE tarjetas_credito ADD COLUMN IF NOT EXISTS cuota_manejo_modo TEXT NOT NULL DEFAULT 'siempre';`);
}

module.exports = pool;
module.exports.migrate = migrate;
