const DashboardView = {
  render() {
    const container = document.getElementById('view-dashboard');
    const cuentas = Storage.get('cuentas');
    const transacciones = Storage.get('transacciones');
    const metas = Storage.get('metas').filter(m => !m.completada);
    const prestamos = Storage.get('prestamos').filter(p => !p.completado);
    const deudas = Storage.get('deudas').filter(d => d.activa);

    const totalBase = cuentas.reduce((s, c) => s + toBaseCurrency(c.saldo, c.moneda), 0);

    const now = new Date();
    const mesActual = now.toISOString().slice(0, 7);
    const txMes = transacciones.filter(t => t.fecha.startsWith(mesActual));
    const ingresosMes = txMes.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + toBaseCurrency(t.monto, Storage.find('cuentas', t.cuentaId)?.moneda), 0);
    const gastosMes = txMes.filter(t => t.tipo === 'gasto').reduce((s, t) => s + toBaseCurrency(t.monto, Storage.find('cuentas', t.cuentaId)?.moneda), 0);
    const balanceMes = ingresosMes - gastosMes;

    const prestado = prestamos.filter(p => p.tipo === 'dado').reduce((s, p) => s + toBaseCurrency(p.monto - p.montoPagado, p.moneda), 0);
    const debido = prestamos.filter(p => p.tipo === 'recibido').reduce((s, p) => s + toBaseCurrency(p.monto - p.montoPagado, p.moneda), 0);

    const proximosPagos = deudas
      .map(d => ({ ...d, prox: DeudasView.proximoPago(d.diaPago) }))
      .sort((a, b) => a.prox.localeCompare(b.prox))
      .slice(0, 4);

    const recientes = transacciones.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5);

    const icons = {
      ingreso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
      gasto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2l1.5 12h9L18 2M3 7h18M9 22h6"/></svg>',
      transferencia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 2l4 4-4 4M7 8l-4 4 4 4"/><path d="M3 12h18"/></svg>'
    };

    const accountsHtml = cuentas.slice(0, 8).map(c => `
      <div class="account-mini">
        <div class="account-mini-icon" style="background:color-mix(in srgb, ${ACCOUNT_TIPO_COLOR[c.tipo]} 15%, transparent);color:${ACCOUNT_TIPO_COLOR[c.tipo]};">${ICON_ACCOUNT_TIPO[c.tipo] || ICON_ACCOUNT_TIPO.banco}</div>
        <div class="account-mini-name">${escapeHtml(c.nombre)}</div>
        <div class="account-mini-currency">${c.moneda}</div>
        <div class="account-mini-balance">${formatMoney(c.saldo, c.moneda)}</div>
      </div>
    `).join('') || '<div class="empty-state card" style="width:100%;">Aún no tienes cuentas registradas.</div>';

    const txHtml = recientes.map(t => {
      const cuenta = Storage.find('cuentas', t.cuentaId);
      const signo = t.tipo === 'gasto' ? '-' : t.tipo === 'ingreso' ? '+' : '';
      const titulo = t.descripcion || (t.categoria ? t.categoria[0].toUpperCase() + t.categoria.slice(1) : TIPO_MOVIMIENTO_LABELS[t.tipo]);
      return `
        <div class="tx-item">
          <div class="tx-icon ${t.tipo}">${icons[t.tipo]}</div>
          <div class="tx-body">
            <div class="tx-title">${escapeHtml(titulo)}</div>
            <div class="tx-sub">${escapeHtml(cuenta ? cuenta.nombre : '—')} · ${formatDate(t.fecha)}</div>
          </div>
          <div class="tx-amount ${t.tipo}">${signo}${formatMoney(t.monto, cuenta?.moneda)}</div>
        </div>`;
    }).join('') || '<div class="empty-state">Sin movimientos aún.</div>';

    const metasHtml = metas.slice(0, 2).map(m => {
      const pct = m.montoObjetivo > 0 ? Math.min(100, Math.round((m.montoActual / m.montoObjetivo) * 100)) : 0;
      return `
        <div class="card" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:7px;">
            <span style="font-weight:600;">${escapeHtml(m.nombre)}</span>
            <span class="text-dim">${pct}%</span>
          </div>
          <div class="progress-bar"><div style="width:${pct}%;"></div></div>
          <div class="stat-sub">${formatMoney(m.montoActual, m.moneda)} de ${formatMoney(m.montoObjetivo, m.moneda)}</div>
        </div>`;
    }).join('') || '<div class="empty-state card">Sin metas activas.</div>';

    const pagosHtml = proximosPagos.length ? proximosPagos.map(d => {
      const dias = daysUntil(d.prox);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:13px;font-weight:600;">${escapeHtml(d.nombre)}</span>
        <span class="text-dim" style="font-size:12px;">${formatDate(d.prox)} · ${formatMoney(d.monto, d.moneda)}</span>
      </div>`;
    }).join('') : '<div class="empty-state">Sin pagos programados.</div>';

    container.innerHTML = `
      <div class="hero-card">
        <div class="hero-glow"></div>
        <div class="hero-label">Patrimonio total</div>
        <div class="hero-value">${formatMoney(totalBase, 'COP')}</div>
        <div class="hero-trend ${balanceMes >= 0 ? 'pos' : 'neg'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="${balanceMes >= 0 ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}"/></svg>
          ${balanceMes >= 0 ? '+' : '-'}${formatMoney(Math.abs(balanceMes), 'COP')} este mes
        </div>
        <div class="quick-actions">
          <button class="quick-action send" id="qa-send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            Enviar
          </button>
          <button class="quick-action add" id="qa-add">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Agregar
          </button>
          <button class="quick-action history" id="qa-history">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V6a2 2 0 012-2h8l6 6v9a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><path d="M14 4v6h6"/></svg>
            Historial
          </button>
        </div>
      </div>

      <div class="mini-stats">
        <div class="mini-stat">
          <div class="mini-stat-label">Ingresos del mes</div>
          <div class="mini-stat-value pos">${formatMoney(ingresosMes, 'COP')}</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-label">Gastos del mes</div>
          <div class="mini-stat-value neg">${formatMoney(gastosMes, 'COP')}</div>
        </div>
      </div>

      <div class="section-header">
        <span class="section-title">Cuentas</span>
        <button class="link-btn" data-nav="cuentas">Ver todas</button>
      </div>
      <div class="accounts-scroll">${accountsHtml}</div>

      <div class="section-header">
        <span class="section-title">Movimientos recientes</span>
        <button class="link-btn" data-nav="transacciones">Ver todos</button>
      </div>
      <div class="tx-list" style="margin-bottom:24px;">${txHtml}</div>

      <div class="section-header">
        <span class="section-title">Metas de ahorro</span>
        <button class="link-btn" data-nav="metas">Ver todas</button>
      </div>
      ${metasHtml}

      <div class="section-header" style="margin-top:8px;">
        <span class="section-title">Próximos pagos</span>
        <button class="link-btn" data-nav="deudas">Ver todas</button>
      </div>
      <div class="card" style="margin-bottom:18px;">${pagosHtml}</div>

      <div class="mini-stats" style="margin-bottom:0;">
        <div class="mini-stat">
          <div class="mini-stat-label">Me deben</div>
          <div class="mini-stat-value" style="color:var(--accent-2);">${formatMoney(prestado, 'COP')}</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-label">Debo</div>
          <div class="mini-stat-value neg">${formatMoney(debido, 'COP')}</div>
        </div>
      </div>
    `;

    container.querySelectorAll('[data-nav]').forEach(btn => {
      btn.onclick = () => App.navigate(btn.dataset.nav);
    });
    container.querySelector('#qa-send').onclick = () => TransaccionesView.openForm();
    container.querySelector('#qa-add').onclick = () => CuentasView.openForm();
    container.querySelector('#qa-history').onclick = () => App.navigate('transacciones');
  }
};
