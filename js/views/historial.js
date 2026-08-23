const HistorialView = {
  filtro: 'todos',
  detalleYm: null,
  modo: 'monto', // 'monto' | 'porcentaje' — cómo se muestran los datos de categorías

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

  nombreMesCorto(ym) {
    const [year, month] = ym.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('es-CO', { month: 'long' });
  },

  mesAnterior(ym) {
    const [year, month] = ym.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  diasDelMes(ym) {
    const [year, month] = ym.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  },

  // Agrupa todas las transacciones por mes (YYYY-MM). Cada categoría guarda por
  // separado cuánto fue ingreso y cuánto gasto, para poder mostrar la barra
  // ganancia/pérdida de cada una en el detalle.
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
        if (!m.categorias[t.categoria]) m.categorias[t.categoria] = { categoria: t.categoria, totalIngreso: 0, totalGasto: 0, cantidad: 0 };
        const c = m.categorias[t.categoria];
        c.cantidad++;
        if (t.tipo === 'ingreso') c.totalIngreso += monto;
        else if (t.tipo === 'gasto') c.totalGasto += monto;
      }
    });

    return Object.values(meses).sort((a, b) => b.ym.localeCompare(a.ym));
  },

  render() {
    if (this.detalleYm) {
      const todos = this.agruparPorMes();
      if (todos.some(m => m.ym === this.detalleYm)) {
        this.renderDetalle(this.detalleYm, todos);
        return;
      }
      this.detalleYm = null;
    }
    this.renderLista();
  },

  renderLista() {
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
      container.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => { this.filtro = b.dataset.filtro; this.render(); });
      return;
    }

    const topCategorias = (m) => {
      const cats = Object.values(m.categorias).map(c => ({ ...c, total: c.totalIngreso + c.totalGasto }));
      const total = cats.reduce((s, c) => s + c.total, 0);
      return cats.sort((a, b) => b.total - a.total).slice(0, 3).map(c => ({ ...c, pct: total ? Math.round((c.total / total) * 100) : 0 }));
    };

    const fila = (m) => {
      const balance = m.ingresos - m.gastos;
      const top = topCategorias(m);
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

    container.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => { this.filtro = b.dataset.filtro; this.render(); });
    container.querySelectorAll('[data-abrir]').forEach(el => {
      el.onclick = () => { this.detalleYm = el.dataset.abrir; this.render(); };
    });
  },

  renderDetalle(ym, todos) {
    const container = document.getElementById('view-historial');
    const m = todos.find(x => x.ym === ym);
    const anterior = todos.find(x => x.ym === this.mesAnterior(ym));
    const balance = m.ingresos - m.gastos;
    const dias = this.diasDelMes(ym);
    const promedioDiario = balance / dias;

    const variacion = (actual, previo) => {
      if (!anterior || !previo) return null;
      if (previo === 0) return actual > 0 ? 100 : 0;
      return Math.round(((actual - previo) / previo) * 100);
    };
    const varIngresos = variacion(m.ingresos, anterior?.ingresos);
    const varGastos = variacion(m.gastos, anterior?.gastos);
    const mesAnteriorCorto = anterior ? this.nombreMesCorto(anterior.ym) : null;

    // Base para los porcentajes de la sección de categorías: el total categorizado del mes.
    const categorias = Object.values(m.categorias).map(c => ({ ...c, total: c.totalIngreso + c.totalGasto }));
    const totalCategorizado = categorias.reduce((s, c) => s + c.total, 0);
    const categoriasOrdenadas = categorias.sort((a, b) => b.total - a.total);

    const filaCategoria = (c) => {
      const pctIngreso = totalCategorizado ? (c.totalIngreso / totalCategorizado) * 100 : 0;
      const pctGasto = totalCategorizado ? (c.totalGasto / totalCategorizado) * 100 : 0;
      const shareIngreso = c.total ? (c.totalIngreso / c.total) * 100 : 0;
      const shareGasto = c.total ? (c.totalGasto / c.total) * 100 : 0;
      const pctTotal = totalCategorizado ? (c.total / totalCategorizado) * 100 : 0;
      const color = CATEGORIA_COLOR[c.categoria] || 'var(--accent-2)';

      const etiqueta = (valor, monto) => this.modo === 'monto' ? formatMoney(monto, 'COP') : `${valor.toFixed(1)}%`;
      const rightPrimary = this.modo === 'monto' ? formatMoney(c.total, 'COP') : `${pctTotal.toFixed(1)}%`;

      return `
        <div class="cat-row">
          <div class="debt-icon" style="width:38px;height:38px;border-radius:12px;background:color-mix(in srgb, ${color} 16%, transparent);color:${color};">${ICON_CATEGORIA[c.categoria] || ICON_DOTS}</div>
          <div class="cat-row-body">
            <div class="cat-row-name">${capitalizar(c.categoria)}</div>
            <div class="cat-bar" style="width:${Math.max(pctTotal, 1)}%;">
              ${shareIngreso > 0 ? `<div class="cat-bar-seg green" style="width:${shareIngreso}%;"></div>` : ''}
              ${shareGasto > 0 ? `<div class="cat-bar-seg red" style="width:${shareGasto}%;"></div>` : ''}
            </div>
            <div class="cat-bar-labels" style="width:${Math.max(pctTotal, 1)}%;">
              ${pctIngreso > 0 ? `<span class="lbl green" style="flex-basis:${shareIngreso}%;">${etiqueta(pctIngreso, c.totalIngreso)}</span>` : ''}
              ${pctGasto > 0 ? `<span class="lbl red" style="flex-basis:${shareGasto}%;">${etiqueta(pctGasto, c.totalGasto)}</span>` : ''}
            </div>
          </div>
          <div class="cat-row-right">
            <div class="cat-row-amount">${rightPrimary}</div>
            <div class="cat-row-count">${c.cantidad} registro(s)</div>
          </div>
        </div>`;
    };

    container.innerHTML = `
      <div class="detail-topbar" style="margin-bottom:14px;">
        <button class="icon-btn" id="hist-back" aria-label="Volver">${ICON_BACK}</button>
        <div style="text-align:center;flex:1;">
          <div class="detail-topbar-title">${this.nombreMes(ym)}</div>
          <div class="debt-item-sub" style="justify-content:center;">${ICON_CALENDAR}${m.cantidadMovimientos} movimiento(s)</div>
        </div>
        <span style="width:40px;"></span>
      </div>

      <div class="month-stats-grid">
        <div class="month-stat-card ingresos">
          <div class="month-stat-label">Ingresos</div>
          <div class="month-stat-value">${formatMoney(m.ingresos, 'COP')}</div>
          ${varIngresos !== null ? `<span class="month-stat-compare ${varIngresos >= 0 ? 'pos' : 'neg'}">${varIngresos >= 0 ? '↑' : '↓'} ${Math.abs(varIngresos)}% vs ${mesAnteriorCorto}</span>` : ''}
          <div class="month-stat-badge">${ICON_ARROW_UP_RIGHT}</div>
        </div>
        <div class="month-stat-card gastos">
          <div class="month-stat-label">Gastos</div>
          <div class="month-stat-value">${formatMoney(m.gastos, 'COP')}</div>
          ${varGastos !== null ? `<span class="month-stat-compare ${varGastos <= 0 ? 'pos' : 'neg'}">${varGastos >= 0 ? '↑' : '↓'} ${Math.abs(varGastos)}% vs ${mesAnteriorCorto}</span>` : ''}
          <div class="month-stat-badge">${ICON_ARROW_DOWN}</div>
        </div>
      </div>

      <div class="card month-balance-row">
        <div class="month-balance-item">
          <div class="debt-icon" style="width:36px;height:36px;border-radius:11px;background:color-mix(in srgb, var(--accent) 16%, transparent);color:var(--accent);">${ICON_WALLET}</div>
          <div>
            <div class="mini-stat-label" style="margin-bottom:2px;">Balance del mes</div>
            <div class="mini-stat-value sm ${balance >= 0 ? 'pos' : 'neg'}">${balance >= 0 ? '+' : '-'}${formatMoney(Math.abs(balance), 'COP')}</div>
          </div>
        </div>
        <div class="month-balance-divider"></div>
        <div class="month-balance-item">
          <div class="debt-icon" style="width:36px;height:36px;border-radius:11px;background:color-mix(in srgb, var(--accent-2) 16%, transparent);color:var(--accent-2);">${ICON_TREND_UP}</div>
          <div>
            <div class="mini-stat-label" style="margin-bottom:2px;">Promedio diario</div>
            <div class="mini-stat-value sm ${promedioDiario >= 0 ? 'pos' : 'neg'}">${promedioDiario >= 0 ? '+' : '-'}${formatMoney(Math.abs(promedioDiario), 'COP')}</div>
          </div>
        </div>
      </div>

      <div class="section-header" style="margin-top:22px;">
        <span class="section-title">Categorías del mes</span>
        <div class="cat-legend">
          <span class="legend-dot" style="background:var(--accent);"></span>Ingresos
          <span class="legend-dot" style="background:var(--danger);"></span>Gastos
        </div>
      </div>

      <div class="seg-toggle">
        <button class="seg-btn ${this.modo === 'monto' ? 'active' : ''}" data-modo="monto">Monto</button>
        <button class="seg-btn ${this.modo === 'porcentaje' ? 'active' : ''}" data-modo="porcentaje">Porcentaje</button>
      </div>

      ${categoriasOrdenadas.length ? `<div class="card cat-list">${categoriasOrdenadas.map(filaCategoria).join('')}</div>` : '<div class="empty-state card">Sin categorías registradas este mes.</div>'}
    `;

    container.querySelector('#hist-back').onclick = () => { this.detalleYm = null; this.render(); };
    container.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { this.modo = b.dataset.modo; this.render(); });
  }
};
