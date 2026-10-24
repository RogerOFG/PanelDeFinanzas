const express = require('express');
const pool = require('../db');
const router = express.Router();

const SELECT_FIELDS = `id, tipo, contraparte, moneda, monto, monto_pagado AS "montoPagado",
  fecha, fecha_limite AS "fechaLimite", notas, completado`;

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM prestamos WHERE usuario_id = $1 ORDER BY completado ASC, fecha DESC;`,
    [req.usuario.id]
  );
  const withPagos = await Promise.all(rows.map(async (p) => {
    const pagos = await pool.query(`SELECT monto, fecha FROM prestamo_pagos WHERE prestamo_id=$1 ORDER BY fecha ASC;`, [p.id]);
    return { ...p, pagos: pagos.rows };
  }));
  res.json(withPagos);
});

router.post('/', async (req, res) => {
  const { tipo, contraparte, moneda, monto, montoPagado, fecha, fechaLimite, notas, cuentaId, soloRegistro } = req.body;
  const completado = (montoPagado || 0) >= monto;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO prestamos (usuario_id, tipo, contraparte, moneda, monto, monto_pagado, fecha, fecha_limite, notas, completado)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,CURRENT_DATE),$8,$9,$10)
       RETURNING ${SELECT_FIELDS};`,
      [req.usuario.id, tipo, contraparte, moneda, monto, montoPagado || 0, fecha || null, fechaLimite || null, notas || null, completado]
    );

    if (!soloRegistro && cuentaId && monto > 0) {
      const cuenta = await client.query(`SELECT * FROM cuentas WHERE id=$1 AND usuario_id=$2;`, [cuentaId, req.usuario.id]);
      if (!cuenta.rows[0]) throw new Error('Cuenta no encontrada');

      // dado → yo presté → gasto (sale de mi cuenta); recibido → me prestaron → ingreso (entra a mi cuenta)
      const tipoTx = tipo === 'dado' ? 'gasto' : 'ingreso';
      const desc = tipo === 'dado' ? `Préstamo a ${contraparte}` : `Préstamo de ${contraparte}`;
      await client.query(
        `INSERT INTO transacciones (usuario_id, cuenta_id, tipo, monto, categoria, descripcion, fecha)
         VALUES ($1,$2,$3,$4,'prestamos',$5, COALESCE($6, CURRENT_DATE));`,
        [req.usuario.id, cuentaId, tipoTx, monto, desc, fecha || null]
      );
      const saldoOp = tipo === 'dado' ? '-' : '+';
      await client.query(`UPDATE cuentas SET saldo = saldo ${saldoOp} $1 WHERE id=$2;`, [monto, cuentaId]);
    }

    await client.query('COMMIT');
    res.status(201).json({ ...rows[0], pagos: [] });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res) => {
  const { tipo, contraparte, moneda, monto, montoPagado, fecha, fechaLimite, notas } = req.body;
  const completado = (montoPagado || 0) >= monto;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const prev = await client.query(`SELECT * FROM prestamos WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
    if (!prev.rows[0]) { await client.query('ROLLBACK'); client.release(); return res.status(404).json({ error: 'Préstamo no encontrado' }); }

    const montoAnterior = parseFloat(prev.rows[0].monto);
    const montoNuevo = parseFloat(monto);
    const diff = montoNuevo - montoAnterior;

    if (diff !== 0) {
      const txOrig = await client.query(
        `SELECT cuenta_id FROM transacciones WHERE usuario_id=$1 AND categoria='prestamos' AND descripcion LIKE $2 ORDER BY id ASC LIMIT 1;`,
        [req.usuario.id, `Préstamo%${prev.rows[0].contraparte}%`]
      );
      if (txOrig.rows[0]?.cuenta_id) {
        const cuentaId = txOrig.rows[0].cuenta_id;
        const tipoP = prev.rows[0].tipo;
        const saldoOp = tipoP === 'dado' ? '-' : '+';
        await client.query(`UPDATE cuentas SET saldo = saldo ${saldoOp} $1 WHERE id=$2;`, [diff, cuentaId]);
        const tipoTx = tipoP === 'dado' ? 'gasto' : 'ingreso';
        const desc = `Ajuste préstamo — ${contraparte} (${diff > 0 ? '+' : ''}${diff})`;
        await client.query(
          `INSERT INTO transacciones (usuario_id, cuenta_id, tipo, monto, categoria, descripcion, fecha)
           VALUES ($1,$2,$3,$4,'prestamos',$5, CURRENT_DATE);`,
          [req.usuario.id, cuentaId, tipoTx, Math.abs(diff), desc]
        );
      }
    }

    const { rows } = await client.query(
      `UPDATE prestamos SET tipo=$1, contraparte=$2, moneda=$3, monto=$4, monto_pagado=$5,
         fecha=$6, fecha_limite=$7, notas=$8, completado=$9
       WHERE id=$10 AND usuario_id=$11 RETURNING ${SELECT_FIELDS};`,
      [tipo, contraparte, moneda, monto, montoPagado, fecha, fechaLimite || null, notas || null, completado, req.params.id, req.usuario.id]
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

router.post('/:id/pago', async (req, res) => {
  const { monto, cuentaId, fecha, soloRegistro } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const prestamo = await client.query(`SELECT * FROM prestamos WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
    if (!prestamo.rows[0]) throw new Error('Préstamo no encontrado');
    const esDado = prestamo.rows[0].tipo === 'dado';

    let transaccionId = null;
    if (!soloRegistro) {
      const cuenta = await client.query(`SELECT * FROM cuentas WHERE id=$1 AND usuario_id=$2;`, [cuentaId, req.usuario.id]);
      if (!cuenta.rows[0]) throw new Error('Cuenta no encontrada');

      // dado → me devuelven → ingreso; recibido → yo pago → gasto
      const tipoTx = esDado ? 'ingreso' : 'gasto';
      const desc = `Abono de préstamo — ${prestamo.rows[0].contraparte}`;
      const tx = await client.query(
        `INSERT INTO transacciones (usuario_id, cuenta_id, tipo, monto, categoria, descripcion, fecha)
         VALUES ($1,$2,$3,$4,'prestamos',$5, COALESCE($6, CURRENT_DATE))
         RETURNING id;`,
        [req.usuario.id, cuentaId, tipoTx, monto, desc, fecha || null]
      );
      transaccionId = tx.rows[0].id;
      const saldoOp = esDado ? '+' : '-';
      await client.query(`UPDATE cuentas SET saldo = saldo ${saldoOp} $1 WHERE id=$2;`, [monto, cuentaId]);
    }

    await client.query(
      `INSERT INTO prestamo_pagos (prestamo_id, monto, cuenta_id, transaccion_id, fecha)
       VALUES ($1,$2,$3,$4, COALESCE($5, CURRENT_DATE));`,
      [req.params.id, monto, soloRegistro ? null : cuentaId, transaccionId, fecha || null]
    );

    const { rows } = await client.query(
      `UPDATE prestamos SET monto_pagado = monto_pagado + $1,
         completado = (monto_pagado + $1) >= monto
       WHERE id=$2 AND usuario_id=$3 RETURNING ${SELECT_FIELDS};`,
      [monto, req.params.id, req.usuario.id]
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

    const prestamo = await client.query(`SELECT * FROM prestamos WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
    if (!prestamo.rows[0]) { await client.query('ROLLBACK'); client.release(); return res.status(404).json({ error: 'Préstamo no encontrado' }); }

    const p = prestamo.rows[0];
    const montoNeto = parseFloat(p.monto) - parseFloat(p.monto_pagado);

    if (montoNeto > 0) {
      const txOrig = await client.query(
        `SELECT cuenta_id FROM transacciones WHERE usuario_id=$1 AND categoria='prestamos' AND descripcion LIKE $2 ORDER BY id ASC LIMIT 1;`,
        [req.usuario.id, `Préstamo%${p.contraparte}%`]
      );
      if (txOrig.rows[0]?.cuenta_id) {
        const cuentaId = txOrig.rows[0].cuenta_id;
        const saldoOp = p.tipo === 'dado' ? '+' : '-';
        await client.query(`UPDATE cuentas SET saldo = saldo ${saldoOp} $1 WHERE id=$2;`, [montoNeto, cuentaId]);
        const tipoTx = p.tipo === 'dado' ? 'ingreso' : 'gasto';
        await client.query(
          `INSERT INTO transacciones (usuario_id, cuenta_id, tipo, monto, categoria, descripcion, fecha)
           VALUES ($1,$2,$3,$4,'prestamos',$5, CURRENT_DATE);`,
          [req.usuario.id, cuentaId, tipoTx, montoNeto, `Cancelación préstamo — ${p.contraparte}`]
        );
      }
    }

    await client.query(`DELETE FROM prestamo_pagos WHERE prestamo_id=$1;`, [req.params.id]);
    await client.query(`DELETE FROM prestamos WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
    await client.query('COMMIT');
    res.status(204).end();
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
