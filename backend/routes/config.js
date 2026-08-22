const express = require('express');
const pool = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `INSERT INTO config_usuario (usuario_id) VALUES ($1)
     ON CONFLICT (usuario_id) DO NOTHING;`,
    [req.usuario.id]
  );
  const result = await pool.query(
    `SELECT tasa_cambio AS "tasaCambio" FROM config_usuario WHERE usuario_id = $1;`,
    [req.usuario.id]
  );
  res.json(result.rows[0] || { tasaCambio: 4000 });
});

router.put('/', async (req, res) => {
  const { tasaCambio } = req.body;
  await pool.query(
    `INSERT INTO config_usuario (usuario_id, tasa_cambio) VALUES ($1,$2)
     ON CONFLICT (usuario_id) DO UPDATE SET tasa_cambio = $2;`,
    [req.usuario.id, tasaCambio]
  );
  res.json({ tasaCambio });
});

module.exports = router;
