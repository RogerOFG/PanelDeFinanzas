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
    if (this.filtro.cuentaId) transacciones = transacciones.filter(t => t.cuentaId === this.filtro.cuentaId || t.cuentaDestinoId === this.filtro.cuentaId);
    if (this.filtro.tipo) transacciones = transacciones.filter(t => t.tipo === this.filtro.tipo);

    const rows = transacciones.map(t => {
      const cuenta = Storage.find('cuentas', t.cuentaId);
      const destino = t.cuentaDestinoId ? Storage.find('cuentas', t.cuentaDestinoId) : null;
      const signo = t.tipo === 'gasto' ? '-' : t.tipo === 'ingreso' ? '+' : '';
      const pillClass = t.tipo === 'ingreso' ? 'pos' : t.tipo === 'gasto' ? 'neg' : 'tipo';
      return `
        <tr>
          <td>${formatDate(t.fecha)}</td>
          <td><span class="pill ${pillClass}">${TIPO_MOVIMIENTO_LABELS[t.tipo]}</span></td>
          <td>${escapeHtml(cuenta ? cuenta.nombre : '—')}${destino ? ` → ${escapeHtml(destino.nombre)}` : ''}</td>
          <td>${escapeHtml(t.categoria || '—')}</td>
          <td>${escapeHtml(t.descripcion || '—')}</td>
          <td style="text-align:right;font-weight:600;">${signo}${formatMoney(t.monto, cuenta?.moneda)}</td>
          <td><button class="btn icon small danger" data-del="${t.id}">🗑️</button></td>
        </tr>`;
    }).join('');

    const cuentaOptions = cuentas.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');

    container.innerHTML = `
      <div class="section-header">
        <div class="text-dim">${transacciones.length} movimiento(s)</div>
        <button class="btn" id="add-tx">+ Nueva transacción</button>
      </div>
      <div class="filters">
        <select id="filter-cuenta"><option value="">Todas las cuentas</option>${cuentaOptions}</select>
        <select id="filter-tipo">
          <option value="">Todos los tipos</option>
          <option value="ingreso">Ingresos</option>
          <option value="gasto">Gastos</option>
          <option value="transferencia">Transferencias</option>
        </select>
      </div>
      <div class="card table-wrap">
        ${transacciones.length === 0 ? '<div class="empty-state">No hay transacciones con este filtro.</div>' : `
        <table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Cuenta</th><th>Categoría</th><th>Descripción</th><th style="text-align:right;">Monto</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`}
      </div>
    `;

    container.querySelector('#filter-cuenta').value = this.filtro.cuentaId;
    container.querySelector('#filter-tipo').value = this.filtro.tipo;
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
    const cuentaOptions = cuentas.map(c => `<option value="${c.id}">${escapeHtml(accountLabel(c))}</option>`).join('');

    UI.openModal('Nueva transacción', `
      <form id="tx-form">
        <div class="form-row">
          <label>Tipo</label>
          <select name="tipo" id="tx-tipo">
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
            <option value="transferencia">Transferencia entre cuentas</option>
          </select>
        </div>
        <div class="form-row">
          <label id="cuenta-label">Cuenta</label>
          <select name="cuentaId" required>${cuentaOptions}</select>
        </div>
        <div class="form-row" id="cuenta-destino-row" style="display:none;">
          <label>Cuenta destino</label>
          <select name="cuentaDestinoId">${cuentaOptions}</select>
        </div>
        <div class="form-row inline">
          <div>
            <label>Monto</label>
            <input type="number" step="0.01" name="monto" required min="0.01">
          </div>
          <div id="categoria-wrap">
            <label>Categoría</label>
            <select name="categoria" id="tx-categoria"></select>
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
        const tipoSelect = root.querySelector('#tx-tipo');
        const destinoRow = root.querySelector('#cuenta-destino-row');
        const categoriaWrap = root.querySelector('#categoria-wrap');
        const categoriaSelect = root.querySelector('#tx-categoria');

        function updateCategorias() {
          const tipo = tipoSelect.value;
          if (tipo === 'transferencia') { categoriaWrap.style.display = 'none'; return; }
          categoriaWrap.style.display = '';
          const opciones = tipo === 'gasto' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO;
          categoriaSelect.innerHTML = opciones.map(c => `<option value="${c}">${c}</option>`).join('');
        }
        function updateDestino() {
          destinoRow.style.display = tipoSelect.value === 'transferencia' ? '' : 'none';
        }
        tipoSelect.onchange = () => { updateCategorias(); updateDestino(); };
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
