const CATEGORIAS_GASTO = ['comida', 'transporte', 'renta', 'servicios', 'entretenimiento', 'salud', 'educacion', 'ropa', 'tecnologia', 'hogar', 'juegos', 'prestamo_otorgado', 'otros'];
const CATEGORIAS_INGRESO = ['salario', 'freelance', 'inversiones', 'regalos', 'ventas', 'prestamo_recibido', 'devolucion_prestamo', 'otros'];

function capitalizar(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}

function mesLabel(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00');
  return capitalizar(d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }));
}

// Lunes de la semana actual, en fecha local.
function inicioSemanaISO() {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0 = domingo
  const diff = dia === 0 ? 6 : dia - 1;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - diff);
  return dateToISOLocal(lunes);
}

function grupoLabel(fechaISO, hoy, ayer, inicioSemana) {
  if (fechaISO === hoy) return 'Hoy';
  if (fechaISO === ayer) return 'Ayer';
  if (fechaISO >= inicioSemana) return 'Esta semana';
  return mesLabel(fechaISO);
}

const TransaccionesView = {
  filtro: { cuentaId: '', tipo: '', categoria: '' },

  render() {
    const container = document.getElementById('view-transacciones');
    const cuentas = Storage.get('cuentas');

    if (cuentas.length === 0) {
      container.innerHTML = `<div class="empty-state card"><p>Crea al menos una cuenta antes de registrar transacciones.</p></div>`;
      return;
    }

    const todas = Storage.get('transacciones');
    const categoriasDisponibles = [...new Set(todas.map(t => t.categoria).filter(Boolean))].sort();

    let transacciones = todas.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (this.filtro.cuentaId) transacciones = transacciones.filter(t => String(t.cuentaId) === String(this.filtro.cuentaId) || String(t.cuentaDestinoId) === String(this.filtro.cuentaId));
    if (this.filtro.tipo) transacciones = transacciones.filter(t => t.tipo === this.filtro.tipo);
    if (this.filtro.categoria) transacciones = transacciones.filter(t => t.categoria === this.filtro.categoria);

    const icons = {
      ingreso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
      gasto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2l1.5 12h9L18 2M3 7h18M9 22h6"/></svg>',
      transferencia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 2l4 4-4 4M7 8l-4 4 4 4"/><path d="M3 12h18"/></svg>'
    };

    const hoy = todayISO();
    const ayerDate = new Date();
    ayerDate.setDate(ayerDate.getDate() - 1);
    const ayer = dateToISOLocal(ayerDate);
    const inicioSemana = inicioSemanaISO();

    let rows = '';
    let grupoActual = null;
    transacciones.forEach(t => {
      const grupo = grupoLabel(t.fecha, hoy, ayer, inicioSemana);
      if (grupo !== grupoActual) {
        grupoActual = grupo;
        rows += `<div class="tx-month-divider">${grupo}</div>`;
      }
      const cuenta = Storage.find('cuentas', t.cuentaId);
      const destino = t.cuentaDestinoId ? Storage.find('cuentas', t.cuentaDestinoId) : null;
      const signo = t.tipo === 'gasto' ? '-' : t.tipo === 'ingreso' ? '+' : '';
      const titulo = t.descripcion || (t.categoria ? capitalizar(t.categoria) : TIPO_MOVIMIENTO_LABELS[t.tipo]);
      const categoriaTag = t.categoria ? ` · <span class="tx-categoria">${escapeHtml(capitalizar(t.categoria))}</span>` : '';
      const sub = `${escapeHtml(cuenta ? cuenta.nombre : '—')}${destino ? ` → ${escapeHtml(destino.nombre)}` : ''} · ${formatDate(t.fecha)}${categoriaTag}`;
      rows += `
        <div class="tx-item">
          <div class="tx-icon ${t.tipo}">${icons[t.tipo]}</div>
          <div class="tx-body">
            <div class="tx-title">${escapeHtml(titulo)}</div>
            <div class="tx-sub">${sub}</div>
          </div>
          <div class="tx-amount ${t.tipo}">${signo}${formatMoney(t.monto, cuenta?.moneda)}</div>
          <button class="btn icon small secondary tx-del" data-edit="${t.id}" aria-label="Editar">${ICON_EDIT}</button>
          <button class="btn icon small danger tx-del" data-del="${t.id}" aria-label="Eliminar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>
          </button>
        </div>`;
    });

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
        ${UI.selectHTML('filter-categoria', [{ value: '', label: 'Todas las categorías' }, ...categoriasDisponibles.map(c => ({ value: c, label: capitalizar(c) }))], this.filtro.categoria, { id: 'filter-categoria' })}
      </div>
      ${transacciones.length === 0 ? '<div class="empty-state card">No hay transacciones con este filtro.</div>' : `<div class="tx-list">${rows}</div>`}
    `;

    UI.initSelects(container);
    container.querySelector('#filter-cuenta').onchange = (e) => { this.filtro.cuentaId = e.target.value; this.render(); };
    container.querySelector('#filter-tipo').onchange = (e) => { this.filtro.tipo = e.target.value; this.render(); };
    container.querySelector('#filter-categoria').onchange = (e) => { this.filtro.categoria = e.target.value; this.render(); };
    container.querySelector('#add-tx').onclick = () => this.openForm();
    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = () => this.openForm(btn.dataset.edit);
    });
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

  openForm(id, tipoDefault) {
    const tx = id ? Storage.find('transacciones', id) : null;
    const cuentas = Storage.get('cuentas');
    const cuentaOpts = cuentas.map(c => ({ value: c.id, label: accountLabel(c) }));
    const tipoInicial = tx?.tipo || tipoDefault || 'gasto';
    const categoriasIniciales = tipoInicial === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO;

    UI.openModal(tx ? 'Editar transacción' : 'Nueva transacción', `
      <form id="tx-form">
        <div class="form-row">
          <label>Tipo</label>
          ${UI.selectHTML('tipo', [
            { value: 'gasto', label: 'Gasto' },
            { value: 'ingreso', label: 'Ingreso' },
            { value: 'transferencia', label: 'Transferencia entre cuentas' }
          ], tipoInicial, { id: 'tx-tipo' })}
        </div>
        <div class="form-row">
          <label id="cuenta-label">Cuenta</label>
          ${UI.selectHTML('cuentaId', cuentaOpts, tx?.cuentaId ?? cuentaOpts[0]?.value, { id: 'tx-cuenta' })}
        </div>
        <div class="form-row" id="cuenta-destino-row" style="display:${tipoInicial === 'transferencia' ? '' : 'none'};">
          <label>Cuenta destino</label>
          ${UI.selectHTML('cuentaDestinoId', cuentaOpts, tx?.cuentaDestinoId ?? cuentaOpts[0]?.value, { id: 'tx-cuenta-destino' })}
        </div>
        <div class="form-row inline">
          <div>
            <label>Monto</label>
            <input type="number" step="0.01" name="monto" required min="0.01" value="${tx?.monto ?? ''}">
          </div>
          <div id="categoria-wrap" style="display:${tipoInicial === 'transferencia' ? 'none' : ''};">
            <label>Categoría</label>
            ${UI.selectHTML('categoria', categoriasIniciales, tx?.categoria || categoriasIniciales[0], { id: 'tx-categoria' })}
          </div>
        </div>
        <div class="form-row">
          <label>Descripción</label>
          <input type="text" name="descripcion" placeholder="Opcional" value="${escapeHtml(tx?.descripcion || '')}">
        </div>
        <div class="form-row">
          <label>Fecha</label>
          <input type="date" name="fecha" value="${tx?.fecha || todayISO()}">
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

        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#tx-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const tipo = fd.get('tipo');
          const cuentaId = fd.get('cuentaId');
          const monto = parseFloat(fd.get('monto'));
          const cuenta = Storage.find('cuentas', cuentaId);
          const destinoId = fd.get('cuentaDestinoId');

          if (tipo === 'transferencia' && destinoId === cuentaId) {
            UI.toast('La cuenta destino debe ser distinta', 'danger');
            return;
          }

          if (tx) {
            // Revertir el efecto anterior sobre los saldos en caché (optimista)
            const oldCuenta = Storage.find('cuentas', tx.cuentaId);
            if (oldCuenta) {
              if (tx.tipo === 'ingreso') oldCuenta.saldo -= tx.monto;
              else if (tx.tipo === 'gasto') oldCuenta.saldo += tx.monto;
              else if (tx.tipo === 'transferencia') {
                oldCuenta.saldo += tx.monto;
                const oldDestino = Storage.find('cuentas', tx.cuentaDestinoId);
                if (oldDestino) oldDestino.saldo -= tx.monto;
              }
            }
          }

          const destino = tipo === 'transferencia' ? Storage.find('cuentas', destinoId) : null;
          if (tipo === 'transferencia') {
            cuenta.saldo -= monto;
            destino.saldo += monto;
          } else if (tipo === 'ingreso') {
            cuenta.saldo += monto;
          } else {
            cuenta.saldo -= monto;
          }

          // Si el servidor rechaza el guardado, revierte el efecto optimista sobre
          // los saldos para que la UI no quede mostrando un cambio que no se guardó.
          const revertirSaldos = () => {
            if (tipo === 'transferencia') {
              cuenta.saldo += monto;
              destino.saldo -= monto;
            } else if (tipo === 'ingreso') {
              cuenta.saldo -= monto;
            } else {
              cuenta.saldo += monto;
            }
            if (tx) {
              const oldCuenta = Storage.find('cuentas', tx.cuentaId);
              if (oldCuenta) {
                if (tx.tipo === 'ingreso') oldCuenta.saldo += tx.monto;
                else if (tx.tipo === 'gasto') oldCuenta.saldo -= tx.monto;
                else if (tx.tipo === 'transferencia') {
                  oldCuenta.saldo -= tx.monto;
                  const oldDestino = Storage.find('cuentas', tx.cuentaDestinoId);
                  if (oldDestino) oldDestino.saldo += tx.monto;
                }
              }
            }
            TransaccionesView.render();
            CuentasView.render();
            if (typeof DashboardView !== 'undefined') DashboardView.render();
          };

          const data = {
            cuentaId,
            cuentaDestinoId: tipo === 'transferencia' ? destinoId : null,
            tipo,
            monto,
            categoria: tipo === 'transferencia' ? null : fd.get('categoria'),
            descripcion: fd.get('descripcion').trim(),
            fecha: fd.get('fecha') || todayISO()
          };

          if (tx) Storage.update('transacciones', tx.id, data, revertirSaldos);
          else Storage.insert('transacciones', data, revertirSaldos);

          UI.closeModal();
          TransaccionesView.render();
          CuentasView.render();
          if (typeof DashboardView !== 'undefined') DashboardView.render();
          UI.toast(tx ? 'Transacción actualizada' : 'Transacción registrada');
        };
      }
    });
  }
};
