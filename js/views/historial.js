const ICON_FILTER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16M7 12h10M10 19h4"/></svg>';

const HistorialView = {
  filtro: 'todos',
  filtroCuenta: '',

  renderSkeleton() {
    const container = document.getElementById('view-historial');
    container.innerHTML = `
      <div class="debt-list">
        <div class="skeleton" style="width:100%;height:170px;border-radius:16px;"></div>
        <div class="skeleton" style="width:100%;height:170px;border-radius:16px;"></div>
        <div class="skeleton" style="width:100%;height:170px;border-radius:16px;"></div>
      </div>
    `;
  },

  nombreMes(ym) {
    const [year, month] = ym.split('-').map(Number);
    const texto = new Date(year, month - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    return texto[0].toUpperCase() + texto.slice(1);
  },

  // Agrupa las transacciones (ya filtradas por cuenta si aplica) por mes (YYYY-MM),
  // calculando totales y el ranking de categorías con más monto dentro de cada mes.
  agruparPorMes() {
    let transacciones = Storage.get('transacciones');
    if (this.filtroCuenta) transacciones = transacciones.filter(t => String(t.cuentaId) === String(this.filtroCuenta));

    const meses = {};
    transacciones.forEach(t => {
      const ym = t.fecha.slice(0, 7);
      if (!meses[ym]) meses[ym] = { ym, ingresos: 0, gastos: 0, cantidadMovimientos: 0, categorias: {} };
      const cuenta = Storage.find('cuentas', t.cuentaId);
      const monto = toBaseCurrency(t.monto, cuenta?.moneda);
      const m = meses[ym];
      m.cantidadMovimientos++;

      if (t.tipo === 'ingreso') m.ingresos += monto;
      else if (t.tipo === 'gasto') m.gastos += monto;

      if (t.categoria && t.tipo !== 'transferencia') {
        if (!m.categorias[t.categoria]) m.categorias[t.categoria] = { categoria: t.categoria, tipo: t.tipo, cantidad: 0, total: 0 };
        m.categorias[t.categoria].cantidad++;
        m.categorias[t.categoria].total += monto;
      }
    });

    return Object.values(meses).sort((a, b) => b.ym.localeCompare(a.ym));
  },

  topCategorias(m) {
    let cats = Object.values(m.categorias);
    if (this.filtro !== 'todos') cats = cats.filter(c => c.tipo === this.filtro);
    const total = cats.reduce((s, c) => s + c.total, 0);
    return cats
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
      .map(c => ({ ...c, pct: total ? Math.round((c.total / total) * 100) : 0 }));
  },

  render() {
    const container = document.getElementById('view-historial');
    const meses = this.agruparPorMes();
    const mesActual = todayISO().slice(0, 7);

    const filtrosHtml = `
      <div class="chip-tabs">
        <button class="chip-tab ${this.filtro === 'todos' ? 'active' : ''}" data-filtro="todos">Todos</button>
        <button class="chip-tab ${this.filtro === 'ingreso' ? 'active' : ''}" data-filtro="ingreso">Ingresos</button>
        <button class="chip-tab ${this.filtro === 'gasto' ? 'active' : ''}" data-filtro="gasto">Gastos</button>
        <button class="chip-tab" id="btn-filtrar-historial" style="margin-left:auto;">${ICON_FILTER} Filtrar</button>
      </div>
    `;

    if (meses.length === 0) {
      container.innerHTML = `${filtrosHtml}<div class="empty-state card">Sin movimientos con este filtro.</div>`;
      this.wireFiltros(container);
      return;
    }

    const fila = (m) => {
      const balance = m.ingresos - m.gastos;
      const top = this.topCategorias(m);
      return `
        <div class="debt-item month-card ${m.ym === mesActual ? 'current' : ''}">
          <div class="debt-item-top" data-abrir="${m.ym}">
            <div class="debt-icon" style="background:color-mix(in srgb, var(--accent-3) 16%, transparent);color:var(--accent-3);">${ICON_CALENDAR}</div>
            <div class="debt-item-body">
              <div class="debt-item-name">${this.nombreMes(m.ym)}</div>
              <div class="debt-item-sub">${m.cantidadMovimientos} movimiento(s)</div>
            </div>
            <span class="debt-item-chevron">${ICON_CHEVRON}</span>
          </div>
          <div class="mini-stats-3">
            <div class="mini-stat">
              <div class="mini-stat-label">Ingresos</div>
              <div class="mini-stat-value sm pos">+${formatMoney(m.ingresos, 'COP')}</div>
            </div>
            <div class="mini-stat">
              <div class="mini-stat-label">Gastos</div>
              <div class="mini-stat-value sm neg">-${formatMoney(m.gastos, 'COP')}</div>
            </div>
            <div class="mini-stat">
              <div class="mini-stat-label">Balance neto</div>
              <div class="mini-stat-value sm ${balance >= 0 ? 'pos' : 'neg'}">${balance >= 0 ? '+' : '-'}${formatMoney(Math.abs(balance), 'COP')}</div>
            </div>
          </div>
          ${top.length ? `
            <div class="month-card-cats">
              <span class="text-dim" style="font-size:11.5px;flex-shrink:0;">Top categorías</span>
              <div class="cat-chip-row">
                ${top.map(c => `<span class="cat-chip">${ICON_CATEGORIA[c.categoria] || ICON_DOTS} ${capitalizar(c.categoria)} <strong>${c.pct}%</strong></span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>`;
    };

    container.innerHTML = `${filtrosHtml}<div class="debt-list">${meses.map(fila).join('')}</div>`;

    container.querySelectorAll('[data-abrir]').forEach(el => {
      el.onclick = () => this.abrirDetalle(el.dataset.abrir, meses);
    });
    this.wireFiltros(container);
  },

  wireFiltros(container) {
    container.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => { this.filtro = b.dataset.filtro; this.render(); });
    container.querySelector('#btn-filtrar-historial').onclick = () => this.openFiltroCuenta();
  },

  openFiltroCuenta() {
    const cuentas = Storage.get('cuentas');
    UI.openModal('Filtrar historial', `
      <div class="form-row">
        <label>Cuenta</label>
        ${UI.selectHTML('cuenta', [{ value: '', label: 'Todas las cuentas' }, ...cuentas.map(c => ({ value: c.id, label: c.nombre }))], this.filtroCuenta, { id: 'hist-cuenta' })}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
        <button type="button" class="btn" id="aplicar-btn">Aplicar</button>
      </div>
    `, {
      onMount: (root) => {
        UI.initSelects(root);
        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#aplicar-btn').onclick = () => {
          this.filtroCuenta = root.querySelector('input[name="cuenta"]').value;
          UI.closeModal();
          this.render();
        };
      }
    });
  },

  abrirDetalle(ym, meses) {
    const m = meses.find(x => x.ym === ym);
    const balance = m.ingresos - m.gastos;
    const categoriasOrdenadas = Object.values(m.categorias).sort((a, b) => b.total - a.total);

    const filaCategoria = (c) => `
      <div class="detail-row">
        <div class="detail-row-label">${ICON_CATEGORIA[c.categoria] || ICON_DOTS} ${capitalizar(c.categoria)}</div>
        <div style="text-align:right;">
          <div class="detail-row-value">${formatMoney(c.total, 'COP')}</div>
          <span class="pill ${c.tipo === 'ingreso' ? 'pos' : 'tipo'}" style="margin-top:2px;">${c.cantidad} registro(s)</span>
        </div>
      </div>`;

    UI.openModal(this.nombreMes(ym), `
      <div class="mini-stats" style="margin-bottom:18px;">
        <div class="mini-stat">
          <div class="mini-stat-label">Ingresos</div>
          <div class="mini-stat-value pos">${formatMoney(m.ingresos, 'COP')}</div>
        </div>
        <div class="mini-stat">
          <div class="mini-stat-label">Gastos</div>
          <div class="mini-stat-value neg">${formatMoney(m.gastos, 'COP')}</div>
        </div>
      </div>
      <p class="text-dim mt-0">Balance del mes: <strong style="color:${balance >= 0 ? 'var(--accent)' : 'var(--danger)'};">${balance >= 0 ? '+' : ''}${formatMoney(balance, 'COP')}</strong> · ${m.cantidadMovimientos} movimiento(s)</p>
      <div class="section-header"><span class="section-title">Categorías con más monto</span></div>
      ${categoriasOrdenadas.length ? `<div class="card">${categoriasOrdenadas.map(filaCategoria).join('')}</div>` : '<div class="empty-state">Sin categorías registradas este mes.</div>'}
      <div class="modal-actions" style="margin-top:18px;">
        <button type="button" class="btn secondary" id="cerrar-btn">Cerrar</button>
      </div>
    `, {
      onMount: (root) => {
        root.querySelector('#cerrar-btn').onclick = () => UI.closeModal();
      }
    });
  }
};
