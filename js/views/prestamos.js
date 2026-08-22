const PrestamosView = {
  filtro: 'todos',

  render() {
    const container = document.getElementById('view-prestamos');
    let prestamos = Storage.get('prestamos').slice().sort((a, b) => (a.completado - b.completado) || b.fecha.localeCompare(a.fecha));
    if (this.filtro === 'dado') prestamos = prestamos.filter(p => p.tipo === 'dado');
    if (this.filtro === 'recibido') prestamos = prestamos.filter(p => p.tipo === 'recibido');
    if (this.filtro === 'pendientes') prestamos = prestamos.filter(p => !p.completado);

    const cardHtml = (p) => {
      const pendiente = Math.max(0, p.monto - p.montoPagado);
      const pct = p.monto > 0 ? Math.min(100, Math.round((p.montoPagado / p.monto) * 100)) : 0;
      const esDado = p.tipo === 'dado';
      return `
        <div class="card">
          <div class="section-header" style="margin-bottom:6px;">
            <div>
              <span class="pill ${esDado ? 'warn' : 'cop'}">${esDado ? 'Prestado a' : 'Recibido de'}</span>
              <strong style="margin-left:6px;">${escapeHtml(p.contraparte)}</strong>
            </div>
            <div style="display:flex;gap:6px;">
              ${!p.completado ? `<button class="btn small secondary" data-pago="${p.id}">+ Pago</button>` : ''}
              <button class="btn icon small secondary" data-edit="${p.id}">${ICON_EDIT}</button>
              <button class="btn icon small danger" data-del="${p.id}">${ICON_TRASH}</button>
            </div>
          </div>
          <div class="progress-bar"><div style="width:${pct}%;"></div></div>
          <div class="stat-sub">Pagado: ${formatMoney(p.montoPagado, p.moneda)} / ${formatMoney(p.monto, p.moneda)}</div>
          <div class="stat-sub">Pendiente: <strong>${formatMoney(pendiente, p.moneda)}</strong></div>
          ${p.fechaLimite ? `<div class="stat-sub">Vence: ${formatDate(p.fechaLimite)}</div>` : ''}
          ${p.notas ? `<div class="stat-sub">${escapeHtml(p.notas)}</div>` : ''}
          ${p.completado ? `<div class="pill pos" style="margin-top:8px;">${ICON_CHECK} Pagado por completo</div>` : ''}
        </div>`;
    };

    container.innerHTML = `
      <div class="section-header">
        <div class="text-dim">${prestamos.length} préstamo(s)</div>
        <button class="btn" id="add-prestamo">+ Nuevo préstamo</button>
      </div>
      <div class="filters">
        ${UI.selectHTML('filter-prestamo', [
          { value: 'todos', label: 'Todos' },
          { value: 'dado', label: 'Que yo presté' },
          { value: 'recibido', label: 'Que me prestaron' },
          { value: 'pendientes', label: 'Solo pendientes' }
        ], this.filtro, { id: 'filter-prestamo' })}
      </div>
      <div class="grid cols-1">${prestamos.map(cardHtml).join('') || '<div class="empty-state card">No hay préstamos con este filtro.</div>'}</div>
    `;

    UI.initSelects(container);
    container.querySelector('#filter-prestamo').onchange = (e) => { this.filtro = e.target.value; this.render(); };
    container.querySelector('#add-prestamo').onclick = () => this.openForm();
    container.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => this.openForm(b.dataset.edit));
    container.querySelectorAll('[data-pago]').forEach(b => b.onclick = () => this.openPago(b.dataset.pago));
    container.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      UI.confirmAction('¿Eliminar este préstamo?', () => {
        Storage.remove('prestamos', b.dataset.del);
        this.render();
        UI.toast('Préstamo eliminado');
      });
    });
  },

  openForm(id) {
    const prestamo = id ? Storage.find('prestamos', id) : null;
    UI.openModal(prestamo ? 'Editar préstamo' : 'Nuevo préstamo', `
      <form id="prestamo-form">
        <div class="form-row">
          <label>Tipo</label>
          ${UI.selectHTML('tipo', [
            { value: 'dado', label: 'Yo presté dinero' },
            { value: 'recibido', label: 'Me prestaron dinero' }
          ], prestamo?.tipo || 'dado')}
        </div>
        <div class="form-row">
          <label>Contraparte (nombre)</label>
          <input type="text" name="contraparte" required value="${escapeHtml(prestamo?.contraparte || '')}" placeholder="Ej: Juan, Banco X">
        </div>
        <div class="form-row">
          <label>Moneda</label>
          ${UI.selectHTML('moneda', [{ value: 'COP', label: 'COP' }, { value: 'USD', label: 'USD' }], prestamo?.moneda || 'COP')}
        </div>
        <div class="form-row">
          <label>Monto total</label>
          ${UI.moneyInputHTML('monto', prestamo?.monto ?? '', { required: true })}
        </div>
        <div class="form-row">
          <label>Monto ya pagado</label>
          ${UI.moneyInputHTML('montoPagado', prestamo?.montoPagado ?? 0)}
        </div>
        <div class="form-row inline">
          <div>
            <label>Fecha</label>
            <input type="date" name="fecha" value="${prestamo?.fecha || todayISO()}">
          </div>
          <div>
            <label>Fecha límite (opcional)</label>
            <input type="date" name="fechaLimite" value="${prestamo?.fechaLimite || ''}">
          </div>
        </div>
        <div class="form-row">
          <label>Notas</label>
          <textarea name="notas" rows="2">${escapeHtml(prestamo?.notas || '')}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">${prestamo ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        UI.initSelects(root);
        UI.initMoneyInputs(root);
        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#prestamo-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const monto = parseFloat(fd.get('monto'));
          const montoPagado = parseFloat(fd.get('montoPagado')) || 0;
          const data = {
            tipo: fd.get('tipo'),
            contraparte: fd.get('contraparte').trim(),
            monto,
            moneda: fd.get('moneda'),
            montoPagado,
            fecha: fd.get('fecha') || todayISO(),
            fechaLimite: fd.get('fechaLimite') || null,
            notas: fd.get('notas').trim(),
            completado: montoPagado >= monto,
            pagos: prestamo?.pagos || []
          };
          if (prestamo) Storage.update('prestamos', prestamo.id, data);
          else Storage.insert('prestamos', data);
          UI.closeModal();
          PrestamosView.render();
          UI.toast(prestamo ? 'Préstamo actualizado' : 'Préstamo creado');
        };
      }
    });
  },

  openPago(id) {
    const prestamo = Storage.find('prestamos', id);
    const pendiente = Math.max(0, prestamo.monto - prestamo.montoPagado);
    UI.openModal('Registrar pago', `
      <form id="pago-form">
        <p class="text-dim mt-0">${escapeHtml(prestamo.contraparte)} — pendiente: ${formatMoney(pendiente, prestamo.moneda)}</p>
        <div class="form-row">
          <label>Monto del pago</label>
          ${UI.moneyInputHTML('monto', '', { required: true })}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">Registrar</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        UI.initMoneyInputs(root);
        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#pago-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const monto = Math.min(parseFloat(fd.get('monto')), pendiente);
          const nuevoPagado = prestamo.montoPagado + monto;
          prestamo.montoPagado = nuevoPagado;
          prestamo.completado = nuevoPagado >= prestamo.monto;
          prestamo.pagos = [...(prestamo.pagos || []), { monto, fecha: todayISO() }];
          Storage.pagoPrestamo(prestamo.id, monto).catch(err => UI.toast('No se pudo guardar el pago: ' + err.message, 'danger'));
          UI.closeModal();
          PrestamosView.render();
          UI.toast(nuevoPagado >= prestamo.monto ? 'Préstamo saldado por completo' : 'Pago registrado');
        };
      }
    });
  }
};
