const express = require('express');
const pool = require('../db');
const router = express.Router();

const SELECT_FIELDS = `id, nombre, cupo, moneda, dia_corte AS "diaCorte",
  cuota_manejo AS "cuotaManejo", cuota_manejo_modo AS "cuotaManejoModo", activa, notas`;

const COMPRA_FIELDS = `id, tarjeta_id AS "tarjetaId", descripcion, monto_total AS "montoTotal",
  cuotas, cuotas_pagadas AS "cuotasPagadas", tiene_intereses AS "tieneIntereses",
  categoria, fecha::text`;

async function conDetalle(tarjeta) {
  const compras = await pool.query(
    `SELECT ${COMPRA_FIELDS} FROM compras_tarjeta WHERE tarjeta_id=$1 ORDER BY fecha DESC, id DESC;`,
    [tarjeta.id]
  );
  const pagos = await pool.query(
    `SELECT monto, fecha::text, cuenta_id AS "cuentaId" FROM pagos_tarjeta WHERE tarjeta_id=$1 ORDER BY fecha ASC;`,
    [tarjeta.id]
  );
  return { ...tarjeta, compras: compras.rows, historialPagos: pagos.rows };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM tarjetas_credito WHERE usuario_id = $1 ORDER BY dia_corte ASC;`,
    [req.usuario.id]
  );
  const conDetalles = await Promise.all(rows.map(conDetalle));
  res.json(conDetalles);
});

router.post('/', async (req, res) => {
  const { nombre, cupo, moneda, diaCorte, cuotaManejo, cuotaManejoModo, activa, notas } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO tarjetas_credito (usuario_id, nombre, cupo, moneda, dia_corte, cuota_manejo, cuota_manejo_modo, activa, notas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${SELECT_FIELDS};`,
    [req.usuario.id, nombre, cupo || null, moneda || 'COP', diaCorte, cuotaManejo || 0, cuotaManejoModo || 'siempre', activa !== false, notas || null]
  );
  res.status(201).json({ ...rows[0], compras: [], historialPagos: [] });
});

router.put('/:id', async (req, res) => {
  const { nombre, cupo, moneda, diaCorte, cuotaManejo, cuotaManejoModo, activa, notas } = req.body;
  const { rows } = await pool.query(
    `UPDATE tarjetas_credito SET nombre=$1, cupo=$2, moneda=$3, dia_corte=$4, cuota_manejo=$5, cuota_manejo_modo=$6, activa=$7, notas=$8
     WHERE id=$9 AND usuario_id=$10 RETURNING ${SELECT_FIELDS};`,
    [nombre, cupo || null, moneda || 'COP', diaCorte, cuotaManejo || 0, cuotaManejoModo || 'siempre', activa !== false, notas || null, req.params.id, req.usuario.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Tarjeta no encontrada' });
  res.json(await conDetalle(rows[0]));
});

router.delete('/:id', async (req, res) => {
  await pool.query(`DELETE FROM tarjetas_credito WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
  res.status(204).end();
});

// Registra una compra hecha con la tarjeta. No afecta cuentas ni transacciones:
// solo queda pendiente de cobro para la(s) próxima(s) fecha(s) de corte.
router.post('/:id/compras', async (req, res) => {
  const tarjeta = await pool.query(`SELECT id FROM tarjetas_credito WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
  if (!tarjeta.rows[0]) return res.status(404).json({ error: 'Tarjeta no encontrada' });

  const { descripcion, montoTotal, cuotas, tieneIntereses, categoria, fecha } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO compras_tarjeta (tarjeta_id, descripcion, monto_total, cuotas, tiene_intereses, categoria, fecha)
     VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, CURRENT_DATE)) RETURNING ${COMPRA_FIELDS};`,
    [req.params.id, descripcion, montoTotal, cuotas || 1, !!tieneIntereses, categoria || null, fecha || null]
  );
  res.status(201).json(rows[0]);
});

router.delete('/compras/:compraId', async (req, res) => {
  const compra = await pool.query(
    `SELECT ct.id FROM compras_tarjeta ct
     JOIN tarjetas_credito t ON t.id = ct.tarjeta_id
     WHERE ct.id=$1 AND t.usuario_id=$2 AND ct.cuotas_pagadas = 0;`,
    [req.params.compraId, req.usuario.id]
  );
  if (!compra.rows[0]) return res.status(400).json({ error: 'La compra no existe o ya tiene cuotas pagadas' });
  await pool.query(`DELETE FROM compras_tarjeta WHERE id=$1;`, [req.params.compraId]);
  res.status(204).end();
});

// Paga el extracto de la tarjeta: cuota de manejo + una cuota de cada compra
// con saldo pendiente. El monto se recalcula en el servidor (no se confía en
// lo que mande el front) para evitar inconsistencias.
router.post('/:id/pago', async (req, res) => {
  const { cuentaId, fecha } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tarjeta = await client.query(`SELECT * FROM tarjetas_credito WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
    if (!tarjeta.rows[0]) throw new Error('Tarjeta no encontrada');

    const cuenta = await client.query(`SELECT * FROM cuentas WHERE id=$1 AND usuario_id=$2;`, [cuentaId, req.usuario.id]);
    if (!cuenta.rows[0]) throw new Error('Cuenta no encontrada');

    const pendientes = await client.query(
      `SELECT id, monto_total, cuotas FROM compras_tarjeta WHERE tarjeta_id=$1 AND cuotas_pagadas < cuotas;`,
      [req.params.id]
    );

    const huboUso = pendientes.rows.length > 0;
    const modo = tarjeta.rows[0].cuota_manejo_modo || 'siempre';
    const cobraManejo = modo === 'siempre' || (modo === 'solo_si_usa' && huboUso);
    const cuotaManejo = cobraManejo ? (parseFloat(tarjeta.rows[0].cuota_manejo) || 0) : 0;
    let total = cuotaManejo;
    for (const c of pendientes.rows) {
      total += parseFloat(c.monto_total) / c.cuotas;
    }
    total = Math.round(total);

    if (total <= 0) throw new Error('No hay ningún cobro pendiente para esta tarjeta');

    const tx = await client.query(
      `INSERT INTO transacciones (usuario_id, cuenta_id, tipo, monto, categoria, descripcion, fecha)
       VALUES ($1,$2,'gasto',$3,'tarjeta_credito',$4, COALESCE($5, CURRENT_DATE))
       RETURNING id;`,
      [req.usuario.id, cuentaId, total, `Pago tarjeta — ${tarjeta.rows[0].nombre}`, fecha || null]
    );
    await client.query(`UPDATE cuentas SET saldo = saldo - $1 WHERE id=$2;`, [total, cuentaId]);

    for (const c of pendientes.rows) {
      await client.query(`UPDATE compras_tarjeta SET cuotas_pagadas = cuotas_pagadas + 1 WHERE id=$1;`, [c.id]);
    }

    await client.query(
      `INSERT INTO pagos_tarjeta (tarjeta_id, monto, cuenta_id, transaccion_id, fecha)
       VALUES ($1,$2,$3,$4, COALESCE($5, CURRENT_DATE));`,
      [req.params.id, total, cuentaId, tx.rows[0].id, fecha || null]
    );

    await client.query('COMMIT');
    const actualizada = await pool.query(`SELECT ${SELECT_FIELDS} FROM tarjetas_credito WHERE id=$1;`, [req.params.id]);
    res.status(201).json(await conDetalle(actualizada.rows[0]));
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
