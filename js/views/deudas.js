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
      return `
        <div class="card">
          <div class="section-header" style="margin-bottom:6px;">
            <div>
              <span class="pill ${d.tipo === 'suscripcion' ? 'cop' : 'warn'}">${d.tipo === 'suscripcion' ? 'Suscripción' : 'Deuda'}</span>
              ${!d.activa ? '<span class="pill tipo">Inactiva</span>' : ''}
              <strong style="margin-left:6px;">${escapeHtml(d.nombre)}</strong>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn icon small secondary" data-edit="${d.id}">${ICON_EDIT}</button>
              <button class="btn icon small danger" data-del="${d.id}">${ICON_TRASH}</button>
            </div>
          </div>
          <div class="balance" style="font-size:20px;">${formatMoney(d.monto, d.moneda)} <span class="text-dim" style="font-size:12px;font-weight:400;">/ mes</span></div>
          <div class="stat-sub">Día de pago: ${d.diaPago} de cada mes</div>
          ${d.activa ? `<div class="stat-sub ${enAlerta ? '' : ''}">${dias >= 0 ? `Próximo pago en ${dias} día(s)` : 'Vencido'} ${enAlerta ? '🔔' : ''}</div>` : ''}
          ${d.notas ? `<div class="stat-sub">${escapeHtml(d.notas)}</div>` : ''}
          ${d.activa ? `<button class="btn small secondary" style="margin-top:10px;" data-pagar="${d.id}">Marcar pago de este mes</button>` : ''}
        </div>`;
    };

    container.innerHTML = `
      <div class="grid cols-3" style="margin-bottom:20px;">
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
      <div class="grid cols-3">${deudas.map(cardHtml).join('')}</div>
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
    return candidate.toISOString().slice(0, 10);
  },

  marcarPago(id) {
    const deuda = Storage.find('deudas', id);
    const historial = deuda.historialPagos || [];
    historial.push({ fecha: todayISO(), monto: deuda.monto });
    Storage.update('deudas', id, { historialPagos: historial });
    this.render();
    UI.toast(`Pago de "${deuda.nombre}" registrado`);
  },

  checkReminders() {
    const deudas = Storage.get('deudas').filter(d => d.activa);
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
            <select name="tipo">
              <option value="suscripcion" ${deuda?.tipo === 'suscripcion' ? 'selected' : ''}>Suscripción</option>
              <option value="deuda" ${deuda?.tipo === 'deuda' ? 'selected' : ''}>Deuda</option>
            </select>
          </div>
          <div>
            <label>Moneda</label>
            <select name="moneda">
              <option value="COP" ${deuda?.moneda === 'COP' || !deuda ? 'selected' : ''}>COP</option>
              <option value="USD" ${deuda?.moneda === 'USD' ? 'selected' : ''}>USD</option>
            </select>
          </div>
        </div>
        <div class="form-row inline">
          <div>
            <label>Monto mensual</label>
            <input type="number" step="0.01" name="monto" required value="${deuda?.monto ?? ''}">
          </div>
          <div>
            <label>Día de pago (1-28)</label>
            <input type="number" name="diaPago" min="1" max="28" required value="${deuda?.diaPago ?? 1}">
          </div>
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
        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#deuda-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const data = {
            nombre: fd.get('nombre').trim(),
            tipo: fd.get('tipo'),
            moneda: fd.get('moneda'),
            monto: parseFloat(fd.get('monto')),
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
