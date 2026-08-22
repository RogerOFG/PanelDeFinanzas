const express = require('express');
const pool = require('../db');
const router = express.Router();

const SELECT_FIELDS = `id, nombre, tipo, moneda, monto, monto_total AS "montoTotal",
  monto_pagado AS "montoPagado", tipo_pago AS "tipoPago", dia_pago AS "diaPago",
  recordatorio_dias AS "recordatorioDias", activa, notas`;

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM deudas WHERE usuario_id = $1 ORDER BY dia_pago ASC;`,
    [req.usuario.id]
  );
  const withPagos = await Promise.all(rows.map(async (d) => {
    const pagos = await pool.query(`SELECT monto, fecha FROM deuda_pagos WHERE deuda_id=$1 ORDER BY fecha ASC;`, [d.id]);
    return { ...d, historialPagos: pagos.rows };
  }));
  res.json(withPagos);
});

router.post('/', async (req, res) => {
  const { nombre, tipo, moneda, monto, montoTotal, tipoPago, diaPago, recordatorioDias, activa, notas } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO deudas (usuario_id, nombre, tipo, moneda, monto, monto_total, tipo_pago, dia_pago, recordatorio_dias, activa, notas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${SELECT_FIELDS};`,
    [req.usuario.id, nombre, tipo, moneda, monto, montoTotal || null, tipoPago || 'fijo', diaPago, recordatorioDias ?? 3, activa !== false, notas || null]
  );
  res.status(201).json({ ...rows[0], historialPagos: [] });
});

router.put('/:id', async (req, res) => {
  const { nombre, tipo, moneda, monto, montoTotal, montoPagado, tipoPago, diaPago, recordatorioDias, activa, notas } = req.body;
  const { rows } = await pool.query(
    `UPDATE deudas SET nombre=$1, tipo=$2, moneda=$3, monto=$4, monto_total=$5, monto_pagado=$6,
       tipo_pago=$7, dia_pago=$8, recordatorio_dias=$9, activa=$10, notas=$11
     WHERE id=$12 AND usuario_id=$13 RETURNING ${SELECT_FIELDS};`,
    [nombre, tipo, moneda, monto, montoTotal || null, montoPagado || 0, tipoPago || 'fijo', diaPago, recordatorioDias ?? 3, activa !== false, notas || null, req.params.id, req.usuario.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Deuda no encontrada' });
  res.json(rows[0]);
});

router.post('/:id/pago', async (req, res) => {
  const { monto } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO deuda_pagos (deuda_id, monto) VALUES ($1,$2);`, [req.params.id, monto]);
    const { rows } = await client.query(
      `UPDATE deudas SET monto_pagado = monto_pagado + $1 WHERE id=$2 AND usuario_id=$3 RETURNING ${SELECT_FIELDS};`,
      [monto, req.params.id, req.usuario.id]
    );
    if (!rows[0]) throw new Error('Deuda no encontrada');
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  await pool.query(`DELETE FROM deudas WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
  res.status(204).end();
});

module.exports = router;
