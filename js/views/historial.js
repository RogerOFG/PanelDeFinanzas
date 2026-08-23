const HistorialView = {
  filtro: 'todos',

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

  // Agrupa todas las transacciones por mes (YYYY-MM), calculando totales y
  // el ranking de categorías con más monto dentro de cada mes.
  agruparPorMes() {
    const transacciones = Storage.get('transacciones');
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
    const cats = Object.values(m.categorias);
    const total = cats.reduce((s, c) => s + c.total, 0);
    return cats
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
      .map(c => ({ ...c, pct: total ? Math.round((c.total / total) * 100) : 0 }));
  },

  render() {
    const container = document.getElementById('view-historial');
    const todos = this.agruparPorMes();
    const mesActual = todayISO().slice(0, 7);

    const meses = todos.filter(m => {
      const balance = m.ingresos - m.gastos;
      if (this.filtro === 'ganancia') return balance >= 0;
      if (this.filtro === 'perdida') return balance < 0;
      return true;
    });

    const filtrosHtml = `
      <div class="chip-tabs">
        <button class="chip-tab ${this.filtro === 'todos' ? 'active' : ''}" data-filtro="todos">Todos</button>
        <button class="chip-tab ${this.filtro === 'ganancia' ? 'active' : ''}" data-filtro="ganancia">Ganancias</button>
        <button class="chip-tab ${this.filtro === 'perdida' ? 'active' : ''}" data-filtro="perdida">Pérdidas</button>
      </div>
    `;

    if (meses.length === 0) {
      container.innerHTML = `${filtrosHtml}<div class="empty-state card">Sin meses con este filtro.</div>`;
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
