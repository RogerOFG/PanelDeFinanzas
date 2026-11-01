const express = require('express');
const pool = require('../db');
const router = express.Router();

// Cuenta del movimiento original del préstamo: enlazada o, para préstamos antiguos, búsqueda por descripción.
async function cuentaOriginal(client, p, usuarioId) {
  if (p.cuenta_id) return p.cuenta_id;
  const esc = String(p.contraparte).replace(/[\\%_]/g, (c) => '\\' + c);
  const desc = p.tipo === 'dado' ? `Préstamo a ${esc}` : `Préstamo de ${esc}`;
  const r = await client.query(
    `SELECT t.cuenta_id FROM transacciones t JOIN cuentas c ON c.id = t.cuenta_id AND c.usuario_id = $1
     WHERE t.usuario_id=$1 AND t.categoria='prestamos' AND t.descripcion LIKE $2 ORDER BY t.id ASC LIMIT 1;`,
    [usuarioId, desc]
  );
  return r.rows[0]?.cuenta_id || null;
}

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
      const tx = await client.query(
        `INSERT INTO transacciones (usuario_id, cuenta_id, tipo, monto, categoria, descripcion, fecha)
         VALUES ($1,$2,$3,$4,'prestamos',$5, COALESCE($6, CURRENT_DATE)) RETURNING id;`,
        [req.usuario.id, cuentaId, tipoTx, monto, desc, fecha || null]
      );
      await client.query(`UPDATE prestamos SET cuenta_id=$1, transaccion_id=$2 WHERE id=$3;`, [cuentaId, tx.rows[0].id, rows[0].id]);
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
  const { tipo, contraparte, moneda, monto, fecha, fechaLimite, notas } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const prev = await client.query(`SELECT * FROM prestamos WHERE id=$1 AND usuario_id=$2;`, [req.params.id, req.usuario.id]);
    if (!prev.rows[0]) { await client.query('ROLLBACK'); client.release(); return res.status(404).json({ error: 'Préstamo no encontrado' }); }

    const p = prev.rows[0];
    if (tipo && tipo !== p.tipo) {
      const np = await client.query(`SELECT 1 FROM prestamo_pagos WHERE prestamo_id=$1 LIMIT 1;`, [p.id]);
      if (np.rows[0] || p.transaccion_id || p.cuenta_id) throw new Error('No se puede cambiar el tipo de un préstamo con pagos o movimiento asociado');
    }

    const montoAnterior = parseFloat(p.monto);
    const montoNuevo = parseFloat(monto);
    const diff = montoNuevo - montoAnterior;

    if (diff !== 0) {
      const cuentaId = await cuentaOriginal(client, p, req.usuario.id);
      if (cuentaId) {
        const tipoP = p.tipo;
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
      `UPDATE prestamos SET tipo=$1, contraparte=$2, moneda=$3, monto=$4,
         fecha=COALESCE($5, fecha), fecha_limite=$6, notas=$7, completado = monto_pagado >= $4
       WHERE id=$8 AND usuario_id=$9 RETURNING ${SELECT_FIELDS};`,
      [tipo || p.tipo, contraparte, moneda, monto, fecha || null, fechaLimite || null, notas || null, req.params.id, req.usuario.id]
    );

    const pagos = await client.query(`SELECT monto, fecha FROM prestamo_pagos WHERE prestamo_id=$1 ORDER BY fecha ASC;`, [p.id]);
    await client.query('COMMIT');
    res.json({ ...rows[0], pagos: pagos.rows });
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
    const montoNeto = Math.max(0, parseFloat(p.monto) - parseFloat(p.monto_pagado));

    if (montoNeto > 0) {
      const cuentaId = await cuentaOriginal(client, p, req.usuario.id);
      if (cuentaId) {
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
