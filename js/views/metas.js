const MetasView = {
  render() {
    const container = document.getElementById('view-metas');
    const metas = Storage.get('metas');
    const cuentas = Storage.get('cuentas');

    if (metas.length === 0) {
      container.innerHTML = `
        <div class="empty-state card">
          <p>Aún no tienes metas de ahorro.</p>
          <button class="btn" id="add-meta-empty">+ Crear meta</button>
        </div>`;
      container.querySelector('#add-meta-empty').onclick = () => this.openForm();
      return;
    }

    const activas = metas.filter(m => !m.completada);
    const completadas = metas.filter(m => m.completada);

    const cardHtml = (m) => {
      const pct = m.montoObjetivo > 0 ? Math.min(100, Math.round((m.montoActual / m.montoObjetivo) * 100)) : 0;
      const dias = daysUntil(m.fechaLimite);
      return `
        <div class="card">
          <div class="section-header" style="margin-bottom:6px;">
            <strong>${escapeHtml(m.nombre)}</strong>
            <div style="display:flex;gap:6px;">
              <button class="btn small secondary" data-aporte="${m.id}">+ Aporte</button>
              <button class="btn icon small secondary" data-edit="${m.id}">${ICON_EDIT}</button>
              <button class="btn icon small danger" data-del="${m.id}">${ICON_TRASH}</button>
            </div>
          </div>
          <div class="progress-bar"><div style="width:${pct}%;"></div></div>
          <div class="stat-sub">${formatMoney(m.montoActual, m.moneda)} / ${formatMoney(m.montoObjetivo, m.moneda)} (${pct}%)</div>
          ${dias !== null ? `<div class="stat-sub">${dias >= 0 ? `⏰ ${dias} días restantes` : `⚠️ Venció hace ${Math.abs(dias)} días`}</div>` : ''}
          ${pct >= 100 ? '<div class="pill pos" style="margin-top:8px;">🎉 Completada</div>' : ''}
        </div>`;
    };

    container.innerHTML = `
      <div class="section-header">
        <div class="text-dim">${activas.length} meta(s) activa(s)</div>
        <button class="btn" id="add-meta">+ Nueva meta</button>
      </div>
      <div class="grid cols-3">${activas.map(cardHtml).join('') || '<div class="text-dim">Sin metas activas</div>'}</div>
      ${completadas.length ? `<h3 style="margin-top:28px;">Completadas</h3><div class="grid cols-3">${completadas.map(cardHtml).join('')}</div>` : ''}
    `;

    container.querySelector('#add-meta').onclick = () => this.openForm();
    container.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => this.openForm(b.dataset.edit));
    container.querySelectorAll('[data-aporte]').forEach(b => b.onclick = () => this.openAporte(b.dataset.aporte));
    container.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      UI.confirmAction('¿Eliminar esta meta de ahorro?', () => {
        Storage.remove('metas', b.dataset.del);
        this.render();
        UI.toast('Meta eliminada');
      });
    });
  },

  openForm(id) {
    const meta = id ? Storage.find('metas', id) : null;
    const cuentas = Storage.get('cuentas');
    const cuentaOptions = `<option value="">Ninguna (solo seguimiento)</option>` + cuentas.map(c => `<option value="${c.id}" ${meta?.cuentaId === c.id ? 'selected' : ''}>${escapeHtml(accountLabel(c))}</option>`).join('');

    UI.openModal(meta ? 'Editar meta' : 'Nueva meta de ahorro', `
      <form id="meta-form">
        <div class="form-row">
          <label>Nombre</label>
          <input type="text" name="nombre" required value="${escapeHtml(meta?.nombre || '')}" placeholder="Ej: Moto, Viaje, Fondo de emergencia">
        </div>
        <div class="form-row inline">
          <div>
            <label>Monto objetivo</label>
            <input type="number" step="0.01" name="montoObjetivo" required value="${meta?.montoObjetivo ?? ''}">
          </div>
          <div>
            <label>Moneda</label>
            <select name="moneda">
              <option value="COP" ${meta?.moneda === 'COP' || !meta ? 'selected' : ''}>COP</option>
              <option value="USD" ${meta?.moneda === 'USD' ? 'selected' : ''}>USD</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <label>Monto actual ahorrado</label>
          <input type="number" step="0.01" name="montoActual" value="${meta?.montoActual ?? 0}">
        </div>
        <div class="form-row">
          <label>Fecha límite (opcional)</label>
          <input type="date" name="fechaLimite" value="${meta?.fechaLimite || ''}">
        </div>
        <div class="form-row">
          <label>Vincular a cuenta (opcional)</label>
          <select name="cuentaId">${cuentaOptions}</select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">${meta ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#meta-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const montoObjetivo = parseFloat(fd.get('montoObjetivo'));
          const montoActual = parseFloat(fd.get('montoActual')) || 0;
          const data = {
            nombre: fd.get('nombre').trim(),
            montoObjetivo,
            montoActual,
            moneda: fd.get('moneda'),
            fechaLimite: fd.get('fechaLimite') || null,
            cuentaId: fd.get('cuentaId') || null,
            completada: montoActual >= montoObjetivo
          };
          if (meta) Storage.update('metas', meta.id, data);
          else Storage.insert('metas', data);
          UI.closeModal();
          MetasView.render();
          UI.toast(meta ? 'Meta actualizada' : 'Meta creada');
        };
      }
    });
  },

  openAporte(id) {
    const meta = Storage.find('metas', id);
    UI.openModal('Registrar aporte', `
      <form id="aporte-form">
        <p class="text-dim mt-0">${escapeHtml(meta.nombre)}</p>
        <div class="form-row">
          <label>Monto del aporte</label>
          <input type="number" step="0.01" name="monto" required min="0.01">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">Aportar</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#aporte-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const monto = parseFloat(fd.get('monto'));
          const nuevoMonto = meta.montoActual + monto;
          Storage.update('metas', meta.id, { montoActual: nuevoMonto, completada: nuevoMonto >= meta.montoObjetivo });
          UI.closeModal();
          MetasView.render();
          const pct = Math.round((nuevoMonto / meta.montoObjetivo) * 100);
          UI.toast(pct >= 100 ? `🎉 ¡Meta "${meta.nombre}" completada!` : `Aporte registrado (${pct}%)`);
        };
      }
    });
  }
};
