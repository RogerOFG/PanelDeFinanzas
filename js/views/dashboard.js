const DashboardView = {
  render() {
    const container = document.getElementById('view-dashboard');
    const cuentas = Storage.get('cuentas');
    const transacciones = Storage.get('transacciones');
    const metas = Storage.get('metas').filter(m => !m.completada);
    const prestamos = Storage.get('prestamos').filter(p => !p.completado);
    const deudas = Storage.get('deudas').filter(d => d.activa);

    const totalCOP = cuentas.filter(c => c.moneda === 'COP').reduce((s, c) => s + c.saldo, 0);
    const totalUSD = cuentas.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.saldo, 0);
    const totalBase = cuentas.reduce((s, c) => s + toBaseCurrency(c.saldo, c.moneda), 0);

    const porTipo = {};
    cuentas.forEach(c => {
      porTipo[c.tipo] = (porTipo[c.tipo] || 0) + toBaseCurrency(c.saldo, c.moneda);
    });

    const now = new Date();
    const mesActual = now.toISOString().slice(0, 7);
    const txMes = transacciones.filter(t => t.fecha.startsWith(mesActual));
    const ingresosMes = txMes.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + toBaseCurrency(t.monto, Storage.find('cuentas', t.cuentaId)?.moneda), 0);
    const gastosMes = txMes.filter(t => t.tipo === 'gasto').reduce((s, t) => s + toBaseCurrency(t.monto, Storage.find('cuentas', t.cuentaId)?.moneda), 0);
    const balanceMes = ingresosMes - gastosMes;

    const prestado = prestamos.filter(p => p.tipo === 'dado').reduce((s, p) => s + toBaseCurrency(p.monto - p.montoPagado, p.moneda), 0);
    const debido = prestamos.filter(p => p.tipo === 'recibido').reduce((s, p) => s + toBaseCurrency(p.monto - p.montoPagado, p.moneda), 0);
    const gastoFijoMensual = deudas.reduce((s, d) => s + toBaseCurrency(d.monto, d.moneda), 0);

    const proximosPagos = deudas
      .map(d => ({ ...d, prox: DeudasView.proximoPago(d.diaPago) }))
      .sort((a, b) => a.prox.localeCompare(b.prox))
      .slice(0, 5);

    const recientes = transacciones.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);

    container.innerHTML = `
      <div class="grid cols-4" style="margin-bottom:20px;">
        <div class="card">
          <p class="card-title">Patrimonio total (base)</p>
          <div class="stat-value">${formatMoney(totalBase, 'COP')}</div>
          <div class="stat-sub">${cuentas.length} cuenta(s)</div>
        </div>
        <div class="card">
          <p class="card-title">Saldo en COP</p>
          <div class="stat-value">${formatMoney(totalCOP, 'COP')}</div>
        </div>
        <div class="card">
          <p class="card-title">Saldo en USD</p>
          <div class="stat-value">${formatMoney(totalUSD, 'USD')}</div>
        </div>
        <div class="card">
          <p class="card-title">Balance del mes</p>
          <div class="stat-value" style="color:${balanceMes >= 0 ? 'var(--accent-2)' : 'var(--danger)'};">${formatMoney(Math.abs(balanceMes), 'COP')}</div>
          <div class="stat-sub">${balanceMes >= 0 ? 'A favor' : 'En negativo'}</div>
        </div>
      </div>

      <div class="grid cols-3" style="margin-bottom:20px;">
        <div class="card">
          <p class="card-title">Por tipo de cuenta</p>
          ${Object.entries(porTipo).map(([tipo, val]) => `
            <div style="display:flex;justify-content:space-between;margin:6px 0;font-size:13px;">
              <span>${TIPO_CUENTA_LABELS[tipo] || tipo}</span><strong>${formatMoney(val, 'COP')}</strong>
            </div>`).join('') || '<div class="text-dim">Sin cuentas</div>'}
        </div>
        <div class="card">
          <p class="card-title">Préstamos</p>
          <div style="display:flex;justify-content:space-between;margin:6px 0;font-size:13px;"><span>Me deben</span><strong style="color:var(--accent-2);">${formatMoney(prestado, 'COP')}</strong></div>
          <div style="display:flex;justify-content:space-between;margin:6px 0;font-size:13px;"><span>Debo</span><strong style="color:var(--danger);">${formatMoney(debido, 'COP')}</strong></div>
        </div>
        <div class="card">
          <p class="card-title">Gasto fijo mensual</p>
          <div class="stat-value">${formatMoney(gastoFijoMensual, 'COP')}</div>
          <div class="stat-sub">${deudas.length} suscripción(es)/deuda(s) activas</div>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <p class="card-title">Próximos pagos</p>
          ${proximosPagos.length ? proximosPagos.map(d => {
            const dias = daysUntil(d.prox);
            return `<div style="display:flex;justify-content:space-between;margin:8px 0;font-size:13px;">
              <span>${escapeHtml(d.nombre)}</span>
              <span class="text-dim">${formatDate(d.prox)} · ${formatMoney(d.monto, d.moneda)}</span>
            </div>`;
          }).join('') : '<div class="text-dim">Sin pagos programados</div>'}
        </div>
        <div class="card">
          <p class="card-title">Últimos movimientos</p>
          ${recientes.length ? recientes.map(t => {
            const cuenta = Storage.find('cuentas', t.cuentaId);
            const signo = t.tipo === 'gasto' ? '-' : t.tipo === 'ingreso' ? '+' : '';
            return `<div style="display:flex;justify-content:space-between;margin:8px 0;font-size:13px;">
              <span>${escapeHtml(t.descripcion || t.categoria || TIPO_MOVIMIENTO_LABELS[t.tipo])}</span>
              <span>${signo}${formatMoney(t.monto, cuenta?.moneda)}</span>
            </div>`;
          }).join('') : '<div class="text-dim">Sin movimientos aún</div>'}
        </div>
      </div>

      ${metas.length ? `
      <div class="card" style="margin-top:20px;">
        <p class="card-title">Metas activas</p>
        <div class="grid cols-3">
          ${metas.slice(0, 3).map(m => {
            const pct = Math.min(100, Math.round((m.montoActual / m.montoObjetivo) * 100));
            return `<div>
              <div style="font-size:13px;font-weight:600;">${escapeHtml(m.nombre)}</div>
              <div class="progress-bar"><div style="width:${pct}%;"></div></div>
              <div class="stat-sub">${pct}%</div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}
    `;
  }
};
