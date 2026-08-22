const express = require('express');
const pool = require('../db');
const router = express.Router();

const SELECT_FIELDS = 'id, cuenta_id AS "cuentaId", cuenta_destino_id AS "cuentaDestinoId", tipo, monto, categoria, descripcion, fecha::date::text AS fecha';

async function aplicarEfecto(client, { cuentaId, cuentaDestinoId, tipo, monto }) {
  if (tipo === 'transferencia') {
    await client.query(`UPDATE cuentas SET saldo = saldo - $1 WHERE id=$2;`, [monto, cuentaId]);
    await client.query(`UPDATE cuentas SET saldo = saldo + $1 WHERE id=$2;`, [monto, cuentaDestinoId]);
  } else if (tipo === 'ingreso') {
    await client.query(`UPDATE cuentas SET saldo = saldo + $1 WHERE id=$2;`, [monto, cuentaId]);
  } else {
    await client.query(`UPDATE cuentas SET saldo = saldo - $1 WHERE id=$2;`, [monto, cuentaId]);
  }
}

async function revertirEfecto(client, { cuenta_id, cuenta_destino_id, tipo, monto }) {
  if (tipo === 'transferencia') {
    await client.query(`UPDATE cuentas SET saldo = saldo + $1 WHERE id=$2;`, [monto, cuenta_id]);
    await client.query(`UPDATE cuentas SET saldo = saldo - $1 WHERE id=$2;`, [monto, cuenta_destino_id]);
  } else if (tipo === 'ingreso') {
    await client.query(`UPDATE cuentas SET saldo = saldo - $1 WHERE id=$2;`, [monto, cuenta_id]);
  } else {
    await client.query(`UPDATE cuentas SET saldo = saldo + $1 WHERE id=$2;`, [monto, cuenta_id]);
  }
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM transacciones WHERE usuario_id = $1 ORDER BY fecha DESC, id DESC;`,
    [req.usuario.id]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { cuentaId, cuentaDestinoId, tipo, monto, categoria, descripcion, fecha } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cuenta = await client.query(`SELECT * FROM cuentas WHERE id=$1 AND usuario_id=$2;`, [cuentaId, req.usuario.id]);
    if (!cuenta.rows[0]) throw new Error('Cuenta no encontrada');
    if (tipo === 'transferencia') {
      const destino = await client.query(`SELECT * FROM cuentas WHERE id=$1 AND usuario_id=$2;`, [cuentaDestinoId, req.usuario.id]);
      if (!destino.rows[0]) throw new Error('Cuenta destino no encontrada');
    }

    await aplicarEfecto(client, { cuentaId, cuentaDestinoId, tipo, monto });

    const { rows } = await client.query(
      `INSERT INTO transacciones (usuario_id, cuenta_id, cuenta_destino_id, tipo, monto, categoria, descripcion, fecha)
       VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8, CURRENT_DATE))
       RETURNING ${SELECT_FIELDS};`,
      [req.usuario.id, cuentaId, cuentaDestinoId || null, tipo, monto, categoria || null, descripcion || null, fecha || null]
    );

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res) => {
  const { cuentaId, cuentaDestinoId, tipo, monto, categoria, descripcion, fecha } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(`SELECT * FROM transacciones WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
    if (!existing.rows[0]) throw new Error('Transacción no encontrada');

    const cuenta = await client.query(`SELECT * FROM cuentas WHERE id=$1 AND usuario_id=$2;`, [cuentaId, req.usuario.id]);
    if (!cuenta.rows[0]) throw new Error('Cuenta no encontrada');
    if (tipo === 'transferencia') {
      const destino = await client.query(`SELECT * FROM cuentas WHERE id=$1 AND usuario_id=$2;`, [cuentaDestinoId, req.usuario.id]);
      if (!destino.rows[0]) throw new Error('Cuenta destino no encontrada');
    }

    await revertirEfecto(client, existing.rows[0]);
    await aplicarEfecto(client, { cuentaId, cuentaDestinoId, tipo, monto });

    const { rows } = await client.query(
      `UPDATE transacciones SET cuenta_id=$1, cuenta_destino_id=$2, tipo=$3, monto=$4, categoria=$5, descripcion=$6, fecha=COALESCE($7, fecha)
       WHERE id=$8 AND usuario_id=$9 RETURNING ${SELECT_FIELDS};`,
      [cuentaId, cuentaDestinoId || null, tipo, monto, categoria || null, descripcion || null, fecha || null, req.params.id, req.usuario.id]
    );

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = await client.query(`SELECT * FROM transacciones WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
    if (!tx.rows[0]) throw new Error('Transacción no encontrada');

    await revertirEfecto(client, tx.rows[0]);

    await client.query(`DELETE FROM transacciones WHERE id=$1;`, [req.params.id]);
    await client.query('COMMIT');
    res.status(204).end();
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
