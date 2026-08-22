const express = require('express');
const pool = require('../db');
const router = express.Router();

const SELECT_FIELDS = `m.id, m.deuda_id AS "deudaId", m.nombre, m.monto_mensual AS "montoMensual", m.activo, m.notas`;

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM miembros_suscripcion m
     JOIN deudas d ON d.id = m.deuda_id
     WHERE d.usuario_id = $1 ORDER BY m.nombre ASC;`,
    [req.usuario.id]
  );
  const withPagos = await Promise.all(rows.map(async (m) => {
    const pagos = await pool.query(
      `SELECT id, monto, cuenta_id AS "cuentaId", fecha::date::text AS fecha FROM pagos_miembro WHERE miembro_id=$1 ORDER BY fecha ASC;`,
      [m.id]
    );
    return { ...m, pagos: pagos.rows };
  }));
  res.json(withPagos);
});

router.post('/', async (req, res) => {
  const { deudaId, nombre, montoMensual, notas } = req.body;
  const deuda = await pool.query(`SELECT id FROM deudas WHERE id=$1 AND usuario_id=$2;`, [deudaId, req.usuario.id]);
  if (!deuda.rows[0]) return res.status(400).json({ error: 'Suscripción no encontrada' });

  const { rows } = await pool.query(
    `INSERT INTO miembros_suscripcion (deuda_id, nombre, monto_mensual, notas)
     VALUES ($1,$2,$3,$4) RETURNING ${SELECT_FIELDS.replace(/m\./g, '')};`,
    [deudaId, nombre, montoMensual, notas || null]
  );
  res.status(201).json({ ...rows[0], pagos: [] });
});

router.put('/:id', async (req, res) => {
  const { nombre, montoMensual, activo, notas } = req.body;
  const { rows } = await pool.query(
    `UPDATE miembros_suscripcion m SET nombre=$1, monto_mensual=$2, activo=$3, notas=$4
     WHERE m.id=$5 AND EXISTS (SELECT 1 FROM deudas d WHERE d.id = m.deuda_id AND d.usuario_id = $6)
     RETURNING ${SELECT_FIELDS.replace(/m\./g, '')};`,
    [nombre, montoMensual, activo !== false, notas || null, req.params.id, req.usuario.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Miembro no encontrado' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query(
    `DELETE FROM miembros_suscripcion m
     WHERE m.id=$1 AND EXISTS (SELECT 1 FROM deudas d WHERE d.id = m.deuda_id AND d.usuario_id = $2);`,
    [req.params.id, req.usuario.id]
  );
  res.status(204).end();
});

// Marca el pago de un miembro: registra el pago Y crea automáticamente el
// ingreso correspondiente en Transacciones, actualizando el saldo de la cuenta.
router.post('/:id/pago', async (req, res) => {
  const { monto, cuentaId, fecha } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const miembro = await client.query(
      `SELECT m.*, d.nombre AS deuda_nombre FROM miembros_suscripcion m
       JOIN deudas d ON d.id = m.deuda_id
       WHERE m.id=$1 AND d.usuario_id=$2;`,
      [req.params.id, req.usuario.id]
    );
    if (!miembro.rows[0]) throw new Error('Miembro no encontrado');

    const cuenta = await client.query(`SELECT * FROM cuentas WHERE id=$1 AND usuario_id=$2;`, [cuentaId, req.usuario.id]);
    if (!cuenta.rows[0]) throw new Error('Cuenta no encontrada');

    const tx = await client.query(
      `INSERT INTO transacciones (usuario_id, cuenta_id, tipo, monto, categoria, descripcion, fecha)
       VALUES ($1,$2,'ingreso',$3,'suscripcion_familiar',$4, COALESCE($5, CURRENT_DATE))
       RETURNING id;`,
      [req.usuario.id, cuentaId, monto, `Pago de ${miembro.rows[0].nombre} — ${miembro.rows[0].deuda_nombre}`, fecha || null]
    );

    await client.query(`UPDATE cuentas SET saldo = saldo + $1 WHERE id=$2;`, [monto, cuentaId]);

    const pago = await client.query(
      `INSERT INTO pagos_miembro (miembro_id, monto, cuenta_id, transaccion_id, fecha)
       VALUES ($1,$2,$3,$4, COALESCE($5, CURRENT_DATE))
       RETURNING id, monto, cuenta_id AS "cuentaId", fecha::date::text AS fecha;`,
      [req.params.id, monto, cuentaId, tx.rows[0].id, fecha || null]
    );

    await client.query('COMMIT');
    res.status(201).json(pago.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
