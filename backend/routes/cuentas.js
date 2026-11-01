const express = require('express');
const pool = require('../db');
const router = express.Router();

const errorDb = (res, e) => res.status(e.code && /^22/.test(e.code) ? 400 : 500).json({ error: e.message });

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM cuentas WHERE usuario_id = $1 ORDER BY creada_en ASC;`,
      [req.usuario.id]
    );
    res.json(rows);
  } catch (e) { errorDb(res, e); }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, tipo, moneda, saldo, titular, notas } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO cuentas (usuario_id, nombre, tipo, moneda, saldo, titular, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *;`,
      [req.usuario.id, nombre, tipo, moneda, saldo || 0, titular || null, notas || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { errorDb(res, e); }
});

// El saldo solo cambia si el usuario lo editó (saldoEditado); la diferencia queda como transacción de ajuste.
router.put('/:id', async (req, res) => {
  const { nombre, tipo, moneda, saldo, saldoEditado, titular, notas } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const actual = await client.query(
      `SELECT saldo FROM cuentas WHERE id=$1 AND usuario_id=$2 FOR UPDATE;`,
      [req.params.id, req.usuario.id]
    );
    if (!actual.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    const saldoDb = Number(actual.rows[0].saldo);
    let nuevoSaldo = saldoDb;
    if (saldoEditado && saldo !== undefined && saldo !== null) {
      const s = Number(saldo);
      if (!Number.isFinite(s)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Saldo inválido' });
      }
      const diff = Math.round((s - saldoDb) * 100) / 100;
      if (diff !== 0) {
        nuevoSaldo = s;
        await client.query(
          `INSERT INTO transacciones (usuario_id, cuenta_id, tipo, monto, categoria, descripcion, fecha)
           VALUES ($1,$2,$3,$4,'ajuste','Ajuste manual de saldo', CURRENT_DATE);`,
          [req.usuario.id, req.params.id, diff > 0 ? 'ingreso' : 'gasto', Math.abs(diff)]
        );
      }
    }
    const { rows } = await client.query(
      `UPDATE cuentas SET nombre=$1, tipo=$2, moneda=$3, saldo=$4, titular=$5, notas=$6
       WHERE id=$7 AND usuario_id=$8 RETURNING *;`,
      [nombre, tipo, moneda, nuevoSaldo, titular || null, notas || null, req.params.id, req.usuario.id]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    errorDb(res, e);
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Verificar propiedad antes de tocar filas hijas: los UPDATE de abajo no filtran por usuario.
    const propia = await client.query(
      `SELECT id FROM cuentas WHERE id=$1 AND usuario_id=$2 FOR UPDATE;`,
      [req.params.id, req.usuario.id]
    );
    if (!propia.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    // Desasociar transacciones para conservar el historial sin referencia a la cuenta
    await client.query(`UPDATE transacciones SET cuenta_id = NULL WHERE cuenta_id=$1;`, [req.params.id]);
    await client.query(`UPDATE transacciones SET cuenta_destino_id = NULL WHERE cuenta_destino_id=$1;`, [req.params.id]);
    await client.query(`UPDATE deuda_pagos SET cuenta_id = NULL WHERE cuenta_id=$1;`, [req.params.id]);
    await client.query(`UPDATE prestamo_pagos SET cuenta_id = NULL WHERE cuenta_id=$1;`, [req.params.id]);
    await client.query(`UPDATE pagos_miembro SET cuenta_id = NULL WHERE cuenta_id=$1;`, [req.params.id]);
    await client.query(`UPDATE pagos_tarjeta SET cuenta_id = NULL WHERE cuenta_id=$1;`, [req.params.id]);
    await client.query(`UPDATE metas_ahorro SET cuenta_id = NULL WHERE cuenta_id=$1;`, [req.params.id]);
    await client.query(`DELETE FROM cuentas WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
    await client.query('COMMIT');
    res.status(204).end();
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    errorDb(res, e);
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
