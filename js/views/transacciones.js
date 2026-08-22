const CATEGORIAS_GASTO = ['comida', 'transporte', 'renta', 'servicios', 'entretenimiento', 'salud', 'educacion', 'ropa', 'tecnologia', 'hogar', 'otros'];
const CATEGORIAS_INGRESO = ['salario', 'freelance', 'inversiones', 'regalos', 'ventas', 'otros'];

const TransaccionesView = {
  filtro: { cuentaId: '', tipo: '' },

  render() {
    const container = document.getElementById('view-transacciones');
    const cuentas = Storage.get('cuentas');

    if (cuentas.length === 0) {
      container.innerHTML = `<div class="empty-state card"><p>Crea al menos una cuenta antes de registrar transacciones.</p></div>`;
      return;
    }

    let transacciones = Storage.get('transacciones').slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (this.filtro.cuentaId) transacciones = transacciones.filter(t => String(t.cuentaId) === String(this.filtro.cuentaId) || String(t.cuentaDestinoId) === String(this.filtro.cuentaId));
    if (this.filtro.tipo) transacciones = transacciones.filter(t => t.tipo === this.filtro.tipo);

    const icons = {
      ingreso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
      gasto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2l1.5 12h9L18 2M3 7h18M9 22h6"/></svg>',
      transferencia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 2l4 4-4 4M7 8l-4 4 4 4"/><path d="M3 12h18"/></svg>'
    };

    const rows = transacciones.map(t => {
      const cuenta = Storage.find('cuentas', t.cuentaId);
      const destino = t.cuentaDestinoId ? Storage.find('cuentas', t.cuentaDestinoId) : null;
      const signo = t.tipo === 'gasto' ? '-' : t.tipo === 'ingreso' ? '+' : '';
      const titulo = t.descripcion || (t.categoria ? t.categoria[0].toUpperCase() + t.categoria.slice(1) : TIPO_MOVIMIENTO_LABELS[t.tipo]);
      const sub = `${escapeHtml(cuenta ? cuenta.nombre : '—')}${destino ? ` → ${escapeHtml(destino.nombre)}` : ''} · ${formatDate(t.fecha)}`;
      return `
        <div class="tx-item">
          <div class="tx-icon ${t.tipo}">${icons[t.tipo]}</div>
          <div class="tx-body">
            <div class="tx-title">${escapeHtml(titulo)}</div>
            <div class="tx-sub">${sub}</div>
          </div>
          <div class="tx-amount ${t.tipo}">${signo}${formatMoney(t.monto, cuenta?.moneda)}</div>
          <button class="btn icon small danger tx-del" data-del="${t.id}" aria-label="Eliminar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>
          </button>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="section-header">
        <div class="text-dim">${transacciones.length} movimiento(s)</div>
        <button class="btn" id="add-tx">+ Nueva transacción</button>
      </div>
      <div class="filters">
        ${UI.selectHTML('filter-cuenta', [{ value: '', label: 'Todas las cuentas' }, ...cuentas.map(c => ({ value: c.id, label: c.nombre }))], this.filtro.cuentaId, { id: 'filter-cuenta' })}
        ${UI.selectHTML('filter-tipo', [
          { value: '', label: 'Todos los tipos' },
          { value: 'ingreso', label: 'Ingresos' },
          { value: 'gasto', label: 'Gastos' },
          { value: 'transferencia', label: 'Transferencias' }
        ], this.filtro.tipo, { id: 'filter-tipo' })}
      </div>
      ${transacciones.length === 0 ? '<div class="empty-state card">No hay transacciones con este filtro.</div>' : `<div class="tx-list">${rows}</div>`}
    `;

    UI.initSelects(container);
    container.querySelector('#filter-cuenta').onchange = (e) => { this.filtro.cuentaId = e.target.value; this.render(); };
    container.querySelector('#filter-tipo').onchange = (e) => { this.filtro.tipo = e.target.value; this.render(); };
    container.querySelector('#add-tx').onclick = () => this.openForm();
    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => {
        UI.confirmAction('¿Eliminar esta transacción? El saldo de la cuenta se revertirá.', () => {
          this.deleteTx(btn.dataset.del);
        });
      };
    });
  },

  deleteTx(id) {
    const tx = Storage.find('transacciones', id);
    if (!tx) return;
    const cuenta = Storage.find('cuentas', tx.cuentaId);
    if (cuenta) {
      if (tx.tipo === 'ingreso') cuenta.saldo -= tx.monto;
      if (tx.tipo === 'gasto') cuenta.saldo += tx.monto;
      if (tx.tipo === 'transferencia') {
        cuenta.saldo += tx.monto;
        const destino = Storage.find('cuentas', tx.cuentaDestinoId);
        if (destino) destino.saldo -= tx.monto;
      }
      Storage.save();
    }
    Storage.remove('transacciones', id);
    this.render();
    if (typeof DashboardView !== 'undefined') DashboardView.render();
    UI.toast('Transacción eliminada');
  },

  openForm() {
    const cuentas = Storage.get('cuentas');
    const cuentaOpts = cuentas.map(c => ({ value: c.id, label: accountLabel(c) }));

    UI.openModal('Nueva transacción', `
      <form id="tx-form">
        <div class="form-row">
          <label>Tipo</label>
          ${UI.selectHTML('tipo', [
            { value: 'gasto', label: 'Gasto' },
            { value: 'ingreso', label: 'Ingreso' },
            { value: 'transferencia', label: 'Transferencia entre cuentas' }
          ], 'gasto', { id: 'tx-tipo' })}
        </div>
        <div class="form-row">
          <label id="cuenta-label">Cuenta</label>
          ${UI.selectHTML('cuentaId', cuentaOpts, cuentaOpts[0]?.value, { id: 'tx-cuenta' })}
        </div>
        <div class="form-row" id="cuenta-destino-row" style="display:none;">
          <label>Cuenta destino</label>
          ${UI.selectHTML('cuentaDestinoId', cuentaOpts, cuentaOpts[0]?.value, { id: 'tx-cuenta-destino' })}
        </div>
        <div class="form-row inline">
          <div>
            <label>Monto</label>
            <input type="number" step="0.01" name="monto" required min="0.01">
          </div>
          <div id="categoria-wrap">
            <label>Categoría</label>
            ${UI.selectHTML('categoria', CATEGORIAS_GASTO, CATEGORIAS_GASTO[0], { id: 'tx-categoria' })}
          </div>
        </div>
        <div class="form-row">
          <label>Descripción</label>
          <input type="text" name="descripcion" placeholder="Opcional">
        </div>
        <div class="form-row">
          <label>Fecha</label>
          <input type="date" name="fecha" value="${todayISO()}">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">Guardar</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        UI.initSelects(root);
        const tipoSelect = root.querySelector('#tx-tipo');
        const destinoRow = root.querySelector('#cuenta-destino-row');
        const categoriaWrap = root.querySelector('#categoria-wrap');
        const categoriaSelectWrap = categoriaWrap.querySelector('.custom-select');

        function updateCategorias() {
          const tipo = tipoSelect.value;
          if (tipo === 'transferencia') { categoriaWrap.style.display = 'none'; return; }
          categoriaWrap.style.display = '';
          const opciones = tipo === 'gasto' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO;
          UI.setSelectOptions(categoriaSelectWrap, opciones, opciones[0]);
        }
        function updateDestino() {
          destinoRow.style.display = tipoSelect.value === 'transferencia' ? '' : 'none';
        }
        tipoSelect.addEventListener('change', () => { updateCategorias(); updateDestino(); });
        updateCategorias(); updateDestino();

        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#tx-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const tipo = fd.get('tipo');
          const cuentaId = fd.get('cuentaId');
          const monto = parseFloat(fd.get('monto'));
          const cuenta = Storage.find('cuentas', cuentaId);

          if (tipo === 'transferencia') {
            const destinoId = fd.get('cuentaDestinoId');
            if (destinoId === cuentaId) { UI.toast('La cuenta destino debe ser distinta', 'danger'); return; }
            const destino = Storage.find('cuentas', destinoId);
            cuenta.saldo -= monto;
            destino.saldo += monto;
            Storage.save();
            Storage.insert('transacciones', { cuentaId, cuentaDestinoId: destinoId, tipo, monto, descripcion: fd.get('descripcion').trim(), fecha: fd.get('fecha') || todayISO() });
          } else {
            if (tipo === 'ingreso') cuenta.saldo += monto; else cuenta.saldo -= monto;
            Storage.save();
            Storage.insert('transacciones', { cuentaId, tipo, monto, categoria: fd.get('categoria'), descripcion: fd.get('descripcion').trim(), fecha: fd.get('fecha') || todayISO() });
          }

          UI.closeModal();
          TransaccionesView.render();
          CuentasView.render();
          if (typeof DashboardView !== 'undefined') DashboardView.render();
          UI.toast('Transacción registrada');
        };
      }
    });
  }
};
