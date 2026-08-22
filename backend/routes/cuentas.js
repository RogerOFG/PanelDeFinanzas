const express = require('express');
const pool = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM cuentas WHERE usuario_id = $1 ORDER BY creada_en ASC;`,
    [req.usuario.id]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { nombre, tipo, moneda, saldo, titular, notas } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO cuentas (usuario_id, nombre, tipo, moneda, saldo, titular, notas)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *;`,
    [req.usuario.id, nombre, tipo, moneda, saldo || 0, titular || null, notas || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { nombre, tipo, moneda, saldo, titular, notas } = req.body;
  const { rows } = await pool.query(
    `UPDATE cuentas SET nombre=$1, tipo=$2, moneda=$3, saldo=$4, titular=$5, notas=$6
     WHERE id=$7 AND usuario_id=$8 RETURNING *;`,
    [nombre, tipo, moneda, saldo, titular || null, notas || null, req.params.id, req.usuario.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Cuenta no encontrada' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query(`DELETE FROM cuentas WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
  res.status(204).end();
});

module.exports = router;
