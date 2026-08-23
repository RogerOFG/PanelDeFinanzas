const DashboardView = {
  renderSkeleton() {
    const container = document.getElementById('view-dashboard');
    const skeletonAccount = `
      <div class="account-mini">
        <div class="skeleton" style="width:30px;height:30px;border-radius:9px;margin-bottom:12px;"></div>
        <div class="skeleton skeleton-line" style="width:80%;margin-bottom:6px;"></div>
        <div class="skeleton skeleton-line" style="width:40%;margin-bottom:10px;"></div>
        <div class="skeleton skeleton-line lg" style="width:70%;"></div>
      </div>`;
    const skeletonTx = `
      <div class="tx-item">
        <div class="skeleton" style="width:38px;height:38px;border-radius:11px;flex-shrink:0;"></div>
        <div class="tx-body">
          <div class="skeleton skeleton-line" style="width:60%;margin-bottom:6px;"></div>
          <div class="skeleton skeleton-line" style="width:40%;"></div>
        </div>
        <div class="skeleton skeleton-line" style="width:60px;"></div>
      </div>`;

    container.innerHTML = `
      <div class="dashboard-greeting">
        <div class="skeleton skeleton-line" style="width:80px;margin-bottom:6px;"></div>
        <div class="skeleton skeleton-line lg" style="width:160px;"></div>
      </div>
      <div class="hero-card">
        <div class="hero-glow"></div>
        <div class="skeleton skeleton-line" style="width:110px;background-color:rgba(255,255,255,0.1);margin-bottom:12px;"></div>
        <div class="skeleton skeleton-line xl" style="width:70%;background-color:rgba(255,255,255,0.16);margin-bottom:12px;"></div>
        <div class="skeleton skeleton-line" style="width:130px;background-color:rgba(255,255,255,0.1);margin-bottom:20px;"></div>
        <div class="quick-actions">
          <div class="skeleton" style="height:44px;border-radius:12px;background-color:rgba(255,255,255,0.06);"></div>
          <div class="skeleton" style="height:44px;border-radius:12px;background-color:rgba(255,255,255,0.06);"></div>
          <div class="skeleton" style="height:44px;border-radius:12px;background-color:rgba(255,255,255,0.06);"></div>
        </div>
      </div>

      <div class="mini-stats">
        <div class="mini-stat">
          <div class="skeleton skeleton-line" style="width:70%;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-line lg" style="width:55%;"></div>
        </div>
        <div class="mini-stat">
          <div class="skeleton skeleton-line" style="width:70%;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-line lg" style="width:55%;"></div>
        </div>
      </div>

      <div class="skeleton skeleton-line" style="width:90px;margin-bottom:12px;"></div>
      <div class="accounts-scroll">${skeletonAccount}${skeletonAccount}${skeletonAccount}</div>

      <div class="skeleton skeleton-line" style="width:160px;margin-bottom:12px;"></div>
      <div class="tx-list" style="margin-bottom:24px;">${skeletonTx}${skeletonTx}${skeletonTx}</div>

      <div class="skeleton skeleton-line" style="width:130px;margin-bottom:12px;"></div>
      <div class="tx-list" style="margin-bottom:18px;">${skeletonTx}${skeletonTx}</div>

      <div class="mini-stats" style="margin-bottom:0;">
        <div class="mini-stat">
          <div class="skeleton skeleton-line" style="width:70%;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-line lg" style="width:55%;"></div>
        </div>
        <div class="mini-stat">
          <div class="skeleton skeleton-line" style="width:70%;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-line lg" style="width:55%;"></div>
        </div>
      </div>
    `;
  },

  render() {
    const container = document.getElementById('view-dashboard');
    const cuentas = Storage.get('cuentas');
    const transacciones = Storage.get('transacciones');
    const prestamos = Storage.get('prestamos').filter(p => !p.completado);
    const deudas = Storage.get('deudas').filter(d => d.activa);

    const totalBase = cuentas.reduce((s, c) => s + toBaseCurrency(c.saldo, c.moneda), 0);

    const now = new Date();
    const mesActual = dateToISOLocal(now).slice(0, 7);
    const txMes = transacciones.filter(t => t.fecha.startsWith(mesActual));
    const ingresosMes = txMes.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + toBaseCurrency(t.monto, Storage.find('cuentas', t.cuentaId)?.moneda), 0);
    const gastosMes = txMes.filter(t => t.tipo === 'gasto').reduce((s, t) => s + toBaseCurrency(t.monto, Storage.find('cuentas', t.cuentaId)?.moneda), 0);
    const balanceMes = ingresosMes - gastosMes;

    const prestado = prestamos.filter(p => p.tipo === 'dado').reduce((s, p) => s + toBaseCurrency(p.monto - p.montoPagado, p.moneda), 0);
    const debido = prestamos.filter(p => p.tipo === 'recibido').reduce((s, p) => s + toBaseCurrency(p.monto - p.montoPagado, p.moneda), 0);

    const tarjetasPendientes = Storage.get('tarjetas')
      .filter(t => t.activa && typeof TarjetasView !== 'undefined' && !TarjetasView.pagadoEsteCiclo(t) && TarjetasView.totalPorPagar(t) > 0)
      .map(t => ({ id: t.id, nombre: t.nombre, prox: TarjetasView.proximoCorte(t.diaCorte), monto: TarjetasView.totalPorPagar(t), moneda: t.moneda, esTarjeta: true }));

    const proximosPagos = deudas
      .map(d => ({ ...d, prox: DeudasView.proximoPago(d.diaPago) }))
      .concat(tarjetasPendientes)
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
        <div class="account-mini-balance" data-count="${c.saldo}" data-count-currency="${c.moneda}">${formatMoney(0, c.moneda)}</div>
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
          <div class="tx-amount ${t.tipo}" data-count="${t.monto}" data-count-currency="${cuenta?.moneda || 'COP'}" data-count-prefix="${signo}">${signo}${formatMoney(0, cuenta?.moneda)}</div>
        </div>`;
    }).join('') || '<div class="empty-state">Sin movimientos aún.</div>';

    const pagosHtml = proximosPagos.length ? proximosPagos.map(d => {
      const dias = daysUntil(d.prox);
      const { icon, color } = d.esTarjeta ? { icon: ICON_CARD, color: 'var(--accent-2)' }
        : (typeof DeudasView !== 'undefined' && DeudasView.iconoDeuda) ? DeudasView.iconoDeuda(d) : { icon: icons.transferencia, color: 'var(--accent)' };
      const vencido = dias !== null && dias < 0;
      const urgente = dias !== null && dias >= 0 && dias <= 3;
      const diasTexto = vencido ? 'Vencido' : dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `En ${dias} días`;
      return `
        <div class="tx-item" style="cursor:pointer;" ${d.esTarjeta ? `data-ir-tarjeta="${d.id}"` : `data-ir-deuda="${d.id}"`}>
          <div class="tx-icon" style="background:color-mix(in srgb, ${color} 16%, transparent);color:${color};">${icon}</div>
          <div class="tx-body">
            <div class="tx-title">${escapeHtml(d.nombre)}</div>
            <div class="tx-sub">${formatDate(d.prox)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div class="tx-amount">${formatMoney(d.monto, d.moneda)}</div>
            <span class="pill ${vencido ? 'neg' : urgente ? 'warn' : 'tipo'}" style="margin-top:4px;">${diasTexto}</span>
          </div>
        </div>`;
    }).join('') : '<div class="empty-state">Sin pagos programados.</div>';

    const nombre = (Auth.currentUser?.name || '').split(' ')[0] || null;
    const fechaTexto = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

    container.innerHTML = `
      <div class="dashboard-greeting">
        <div class="dashboard-greeting-hello">${nombre ? `Hola, ${escapeHtml(nombre)}` : 'Hola'}</div>
        <div class="dashboard-greeting-date">${fechaTexto[0].toUpperCase() + fechaTexto.slice(1)}</div>
      </div>
      <div class="hero-card">
        <div class="hero-glow"></div>
        <div class="hero-label">Patrimonio total</div>
        <div class="hero-value" data-count="${totalBase}" data-count-currency="COP">${formatMoney(0, 'COP')}</div>
        <div class="hero-trend ${balanceMes >= 0 ? 'pos' : 'neg'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="${balanceMes >= 0 ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}"/></svg>
          <span data-count="${Math.abs(balanceMes)}" data-count-currency="COP" data-count-prefix="${balanceMes >= 0 ? '+' : '-'}">${balanceMes >= 0 ? '+' : '-'}${formatMoney(0, 'COP')}</span> este mes
        </div>
        <div class="quick-actions">
          <button class="quick-action send" id="qa-send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2l1.5 12h9L18 2M3 7h18M9 22h6"/></svg>
            Gasto
          </button>
          <button class="quick-action add" id="qa-add">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            Ingreso
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
          <div class="mini-stat-value pos" data-count="${ingresosMes}" data-count-currency="COP">${formatMoney(0, 'COP')}</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-label">Gastos del mes</div>
          <div class="mini-stat-value neg" data-count="${gastosMes}" data-count-currency="COP">${formatMoney(0, 'COP')}</div>
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
        <span class="section-title">Próximos pagos</span>
        <button class="link-btn" data-nav="deudas">Ver todas</button>
      </div>
      <div class="tx-list" style="margin-bottom:24px;">${pagosHtml}</div>

      <div class="mini-stats" style="margin-bottom:0;">
        <div class="mini-stat">
          <div class="mini-stat-label">Me deben</div>
          <div class="mini-stat-value" style="color:var(--accent-2);" data-count="${prestado}" data-count-currency="COP">${formatMoney(0, 'COP')}</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-label">Debo</div>
          <div class="mini-stat-value neg" data-count="${debido}" data-count-currency="COP">${formatMoney(0, 'COP')}</div>
        </div>
      </div>
    `;

    container.querySelectorAll('[data-nav]').forEach(btn => {
      btn.onclick = () => App.navigate(btn.dataset.nav);
    });
    container.querySelector('#qa-send').onclick = () => TransaccionesView.openForm(null, 'gasto');
    container.querySelector('#qa-add').onclick = () => TransaccionesView.openForm(null, 'ingreso');
    container.querySelector('#qa-history').onclick = () => App.navigate('transacciones');

    const irAVista = (view, detalleId) => {
      App.currentView = view;
      localStorage.setItem('finbot_last_view', view);
      if (view === 'deudas') DeudasView.detalleId = detalleId;
      if (view === 'tarjetas') TarjetasView.detalleId = detalleId;
      App.activateView(view);
      App.renderCurrentView();
    };
    container.querySelectorAll('[data-ir-deuda]').forEach(el => {
      el.onclick = () => irAVista('deudas', el.dataset.irDeuda);
    });
    container.querySelectorAll('[data-ir-tarjeta]').forEach(el => {
      el.onclick = () => irAVista('tarjetas', el.dataset.irTarjeta);
    });

    animateCounters(container);
  }
};
