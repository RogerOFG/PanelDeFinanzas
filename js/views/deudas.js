const DeudasView = {
  render() {
    const container = document.getElementById('view-deudas');
    const deudas = Storage.get('deudas').slice().sort((a, b) => (a.diaPago || 31) - (b.diaPago || 31));

    if (deudas.length === 0) {
      container.innerHTML = `
        <div class="empty-state card">
          <p>No tienes deudas o suscripciones registradas.</p>
          <button class="btn" id="add-deuda-empty">+ Agregar</button>
        </div>`;
      container.querySelector('#add-deuda-empty').onclick = () => this.openForm();
      return;
    }

    const totalMensual = deudas.filter(d => d.activa).reduce((sum, d) => sum + toBaseCurrency(d.monto, d.moneda), 0);

    const cardHtml = (d) => {
      const prox = this.proximoPago(d.diaPago);
      const dias = daysUntil(prox);
      const enAlerta = d.activa && dias !== null && dias <= (d.recordatorioDias ?? 3) && dias >= 0;
      const pagadoEsteCiclo = this.pagadoEsteCiclo(d);
      const ultimoPago = (d.historialPagos || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
      const tieneTotal = d.montoTotal && d.montoTotal > 0;
      const pendiente = tieneTotal ? Math.max(0, d.montoTotal - (d.montoPagado || 0)) : null;
      const pct = tieneTotal ? Math.min(100, Math.round(((d.montoPagado || 0) / d.montoTotal) * 100)) : 0;

      const urgente = !pagadoEsteCiclo && d.activa && (dias < 0 || enAlerta);
      const pagoBtnClass = pagadoEsteCiclo ? 'btn small success' : (urgente ? 'btn small danger' : 'btn small warning');

      return `
        <div class="card">
          <div class="section-header" style="margin-bottom:6px;">
            <div>
              <div style="margin-bottom:5px;">
                <span class="pill ${d.tipo === 'suscripcion' ? 'cop' : 'warn'}">${d.tipo === 'suscripcion' ? 'Suscripción' : 'Deuda'}</span>
                ${!d.activa ? '<span class="pill tipo">Inactiva</span>' : ''}
              </div>
              <strong>${escapeHtml(d.nombre)}</strong>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn icon small secondary" data-edit="${d.id}">${ICON_EDIT}</button>
              <button class="btn icon small danger" data-del="${d.id}">${ICON_TRASH}</button>
            </div>
          </div>
          <div class="balance" style="font-size:20px;">${formatMoney(d.monto, d.moneda)} <span class="text-dim" style="font-size:12px;font-weight:400;">/ mes ${d.tipoPago === 'variable' ? '(aprox.)' : ''}</span></div>
          ${tieneTotal ? `
            <div class="progress-bar"><div style="width:${pct}%;"></div></div>
            <div class="stat-sub">Pagado: ${formatMoney(d.montoPagado || 0, d.moneda)} / ${formatMoney(d.montoTotal, d.moneda)}</div>
            <div class="stat-sub">Pendiente: <strong>${formatMoney(pendiente, d.moneda)}</strong></div>
          ` : `
            <div class="stat-sub">Total acumulado pagado: <strong>${formatMoney(d.montoPagado || 0, d.moneda)}</strong></div>
          `}
          <div class="stat-sub">Día de pago: ${d.diaPago} de cada mes</div>
          ${d.activa ? `<div class="stat-sub">${dias >= 0 ? `Próximo pago en ${dias} día(s)` : 'Vencido'} ${enAlerta && !pagadoEsteCiclo ? '🔔' : ''}</div>` : ''}
          ${ultimoPago ? `<div class="stat-sub">Último pago: ${formatDate(ultimoPago.fecha)} · ${formatMoney(ultimoPago.monto, d.moneda)}</div>` : ''}
          ${d.notas ? `<div class="stat-sub">${escapeHtml(d.notas)}</div>` : ''}
          ${d.activa ? (pagadoEsteCiclo
            ? `<button class="${pagoBtnClass}" style="margin-top:10px;" disabled>Ya pagado este mes</button>`
            : `<button class="${pagoBtnClass}" style="margin-top:10px;" data-pagar="${d.id}">Marcar pago de este mes</button>`
          ) : ''}
        </div>`;
    };

    container.innerHTML = `
      <div class="grid cols-1" style="margin-bottom:20px;">
        <div class="card">
          <p class="card-title">Total mensual (activas)</p>
          <div class="stat-value">${formatMoney(totalMensual, 'COP')}</div>
          <div class="stat-sub">Convertido a moneda base</div>
        </div>
      </div>
      <div class="section-header">
        <div class="text-dim">${deudas.length} deuda(s)/suscripción(es)</div>
        <button class="btn" id="add-deuda">+ Nueva</button>
      </div>
      <div class="grid cols-1">${deudas.map(cardHtml).join('')}</div>
    `;

    container.querySelector('#add-deuda').onclick = () => this.openForm();
    container.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => this.openForm(b.dataset.edit));
    container.querySelectorAll('[data-pagar]').forEach(b => b.onclick = () => this.marcarPago(b.dataset.pagar));
    container.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      UI.confirmAction('¿Eliminar esta deuda/suscripción?', () => {
        Storage.remove('deudas', b.dataset.del);
        this.render();
        UI.toast('Eliminada');
      });
    });

    App.updateNotifDot();
  },

  proximoPago(diaPago) {
    const now = new Date();
    let year = now.getFullYear(), month = now.getMonth();
    let candidate = new Date(year, month, diaPago);
    if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      candidate = new Date(year, month + 1, diaPago);
    }
    return dateToISOLocal(candidate);
  },

  // Fecha en que empezó el ciclo de cobro actual (el último día de pago que ya pasó o es hoy).
  cicloInicio(diaPago) {
    const now = new Date();
    let year = now.getFullYear(), month = now.getMonth();
    let due = new Date(year, month, diaPago);
    if (due > now) due = new Date(year, month - 1, diaPago);
    return dateToISOLocal(due);
  },

  pagadoEsteCiclo(deuda) {
    const inicio = this.cicloInicio(deuda.diaPago);
    return (deuda.historialPagos || []).some(p => p.fecha >= inicio);
  },

  marcarPago(id) {
    const deuda = Storage.find('deudas', id);
    if (deuda.tipoPago === 'variable') {
      this.openPagoVariable(deuda);
      return;
    }
    const monto = deuda.monto;
    deuda.historialPagos = [...(deuda.historialPagos || []), { fecha: todayISO(), monto }];
    deuda.montoPagado = (deuda.montoPagado || 0) + monto;
    Storage.pagoDeuda(id, monto).catch(err => UI.toast('No se pudo guardar el pago: ' + err.message, 'danger'));
    this.render();
    UI.toast(`Pago de "${deuda.nombre}" registrado`);
  },

  openPagoVariable(deuda) {
    UI.openModal('Registrar pago', `
      <form id="pago-deuda-form">
        <p class="text-dim mt-0">${escapeHtml(deuda.nombre)}</p>
        <div class="form-row">
          <label>¿Cuánto pagaste este mes?</label>
          <input type="number" step="0.01" name="monto" required min="0.01" value="${deuda.monto ?? ''}">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">Registrar</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#pago-deuda-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const monto = parseFloat(fd.get('monto'));
          deuda.historialPagos = [...(deuda.historialPagos || []), { fecha: todayISO(), monto }];
          deuda.montoPagado = (deuda.montoPagado || 0) + monto;
          Storage.pagoDeuda(deuda.id, monto).catch(err => UI.toast('No se pudo guardar el pago: ' + err.message, 'danger'));
          UI.closeModal();
          DeudasView.render();
          UI.toast(`Pago de "${deuda.nombre}" registrado`);
        };
      }
    });
  },

  checkReminders() {
    const deudas = Storage.get('deudas').filter(d => d.activa && !this.pagadoEsteCiclo(d));
    deudas.forEach(d => {
      const prox = this.proximoPago(d.diaPago);
      const dias = daysUntil(prox);
      const umbral = d.recordatorioDias ?? 3;
      if (dias !== null && dias >= 0 && dias <= umbral) {
        UI.toast(`"${d.nombre}" vence en ${dias === 0 ? 'hoy' : dias + ' día(s)'} — ${formatMoney(d.monto, d.moneda)}`, dias === 0 ? 'danger' : 'warn');
      }
    });
  },

  openForm(id) {
    const deuda = id ? Storage.find('deudas', id) : null;
    UI.openModal(deuda ? 'Editar deuda/suscripción' : 'Nueva deuda/suscripción', `
      <form id="deuda-form">
        <div class="form-row">
          <label>Nombre</label>
          <input type="text" name="nombre" required value="${escapeHtml(deuda?.nombre || '')}" placeholder="Ej: Netflix, Tarjeta de crédito">
        </div>
        <div class="form-row inline">
          <div>
            <label>Tipo</label>
            ${UI.selectHTML('tipo', [
              { value: 'suscripcion', label: 'Suscripción' },
              { value: 'deuda', label: 'Deuda' }
            ], deuda?.tipo || 'suscripcion')}
          </div>
          <div>
            <label>Moneda</label>
            ${UI.selectHTML('moneda', [{ value: 'COP', label: 'COP' }, { value: 'USD', label: 'USD' }], deuda?.moneda || 'COP')}
          </div>
        </div>
        <div class="form-row">
          <label>¿Cómo se paga cada mes?</label>
          ${UI.selectHTML('tipoPago', [
            { value: 'fijo', label: 'Monto fijo (siempre lo mismo)' },
            { value: 'variable', label: 'Monto variable (lo escribo cada vez)' }
          ], deuda?.tipoPago || 'fijo', { id: 'tipo-pago' })}
        </div>
        <div class="form-row inline">
          <div>
            <label id="monto-mensual-label">Monto mensual</label>
            <input type="number" step="0.01" name="monto" id="monto-mensual" required value="${deuda?.monto ?? ''}">
          </div>
          <div>
            <label>Día de pago (1-28)</label>
            <input type="number" name="diaPago" min="1" max="28" required value="${deuda?.diaPago ?? 1}">
          </div>
        </div>
        <div class="form-row">
          <label>Monto total adeudado (opcional — solo si es una deuda con un total a pagar)</label>
          <input type="number" step="0.01" name="montoTotal" value="${deuda?.montoTotal ?? ''}" placeholder="Ej: tarjeta de crédito, préstamo bancario">
        </div>
        <div class="form-row">
          <label>Avisar con cuántos días de anticipación</label>
          <input type="number" name="recordatorioDias" min="0" max="15" value="${deuda?.recordatorioDias ?? 3}">
        </div>
        <div class="form-row checkbox-row">
          <input type="checkbox" name="activa" id="chk-activa" ${deuda?.activa !== false ? 'checked' : ''}>
          <label for="chk-activa" style="margin:0;">Activa</label>
        </div>
        <div class="form-row">
          <label>Notas</label>
          <textarea name="notas" rows="2">${escapeHtml(deuda?.notas || '')}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">${deuda ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        UI.initSelects(root);

        const tipoPagoHidden = root.querySelector('#tipo-pago');
        const montoLabel = root.querySelector('#monto-mensual-label');
        function updateMontoLabel() {
          montoLabel.textContent = tipoPagoHidden.value === 'variable' ? 'Monto aproximado del mes' : 'Monto mensual';
        }
        tipoPagoHidden.addEventListener('change', updateMontoLabel);
        updateMontoLabel();

        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#deuda-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const montoTotal = parseFloat(fd.get('montoTotal'));
          const data = {
            nombre: fd.get('nombre').trim(),
            tipo: fd.get('tipo'),
            moneda: fd.get('moneda'),
            monto: parseFloat(fd.get('monto')),
            tipoPago: fd.get('tipoPago'),
            montoTotal: isNaN(montoTotal) ? null : montoTotal,
            montoPagado: deuda?.montoPagado || 0,
            diaPago: parseInt(fd.get('diaPago')),
            recordatorioDias: parseInt(fd.get('recordatorioDias')) || 0,
            activa: fd.get('activa') === 'on',
            notas: fd.get('notas').trim(),
            historialPagos: deuda?.historialPagos || []
          };
          if (deuda) Storage.update('deudas', deuda.id, data);
          else Storage.insert('deudas', data);
          UI.closeModal();
          DeudasView.render();
          UI.toast(deuda ? 'Actualizada' : 'Creada');
        };
      }
    });
  }
};
