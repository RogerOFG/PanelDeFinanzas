const express = require('express');
const pool = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, nombre, moneda, monto_objetivo AS "montoObjetivo", monto_actual AS "montoActual",
            fecha_limite AS "fechaLimite", cuenta_id AS "cuentaId", completada
     FROM metas_ahorro WHERE usuario_id = $1 ORDER BY created_at DESC;`,
    [req.usuario.id]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { nombre, moneda, montoObjetivo, montoActual, fechaLimite, cuentaId } = req.body;
  const completada = (montoActual || 0) >= montoObjetivo;
  const { rows } = await pool.query(
    `INSERT INTO metas_ahorro (usuario_id, nombre, moneda, monto_objetivo, monto_actual, fecha_limite, cuenta_id, completada, prioridad)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1)
     RETURNING id, nombre, moneda, monto_objetivo AS "montoObjetivo", monto_actual AS "montoActual",
               fecha_limite AS "fechaLimite", cuenta_id AS "cuentaId", completada;`,
    [req.usuario.id, nombre, moneda, montoObjetivo, montoActual || 0, fechaLimite || null, cuentaId || null, completada]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { nombre, moneda, montoObjetivo, montoActual, fechaLimite, cuentaId, completada } = req.body;
  const { rows } = await pool.query(
    `UPDATE metas_ahorro SET nombre=$1, moneda=$2, monto_objetivo=$3, monto_actual=$4,
       fecha_limite=$5, cuenta_id=$6, completada=$7
     WHERE id=$8 AND usuario_id=$9
     RETURNING id, nombre, moneda, monto_objetivo AS "montoObjetivo", monto_actual AS "montoActual",
               fecha_limite AS "fechaLimite", cuenta_id AS "cuentaId", completada;`,
    [nombre, moneda, montoObjetivo, montoActual, fechaLimite || null, cuentaId || null, completada, req.params.id, req.usuario.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Meta no encontrada' });
  res.json(rows[0]);
});

router.post('/:id/aporte', async (req, res) => {
  const { monto } = req.body;
  const { rows } = await pool.query(
    `UPDATE metas_ahorro SET monto_actual = monto_actual + $1,
       completada = (monto_actual + $1) >= monto_objetivo
     WHERE id=$2 AND usuario_id=$3
     RETURNING id, nombre, moneda, monto_objetivo AS "montoObjetivo", monto_actual AS "montoActual",
               fecha_limite AS "fechaLimite", cuenta_id AS "cuentaId", completada;`,
    [monto, req.params.id, req.usuario.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Meta no encontrada' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query(`DELETE FROM metas_ahorro WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
  res.status(204).end();
});

module.exports = router;
