const MetasView = {
  renderSkeleton() {
    const container = document.getElementById('view-metas');
    const card = `
      <div class="card">
        <div class="section-header" style="margin-bottom:10px;">
          <div class="skeleton skeleton-line" style="width:130px;"></div>
          <div style="display:flex;gap:6px;">
            <div class="skeleton" style="width:70px;height:32px;border-radius:8px;"></div>
            <div class="skeleton" style="width:28px;height:28px;border-radius:8px;"></div>
            <div class="skeleton" style="width:28px;height:28px;border-radius:8px;"></div>
          </div>
        </div>
        <div class="skeleton" style="height:7px;border-radius:99px;margin-bottom:8px;"></div>
        <div class="skeleton skeleton-line" style="width:60%;"></div>
      </div>`;
    container.innerHTML = `
      <div class="section-header">
        <div class="skeleton skeleton-line" style="width:130px;"></div>
        <div class="skeleton" style="width:130px;height:40px;border-radius:10px;"></div>
      </div>
      <div class="grid cols-1">${card}${card}</div>
    `;
  },

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
      <div class="grid cols-1">${activas.map(cardHtml).join('') || '<div class="text-dim">Sin metas activas</div>'}</div>
      ${completadas.length ? `<h3 style="margin-top:28px;">Completadas</h3><div class="grid cols-1">${completadas.map(cardHtml).join('')}</div>` : ''}
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
    const cuentaOpts = [{ value: '', label: 'Ninguna (solo seguimiento)' }, ...cuentas.map(c => ({ value: c.id, label: accountLabel(c) }))];

    UI.openModal(meta ? 'Editar meta' : 'Nueva meta de ahorro', `
      <form id="meta-form">
        <div class="form-row">
          <label>Nombre</label>
          <input type="text" name="nombre" required value="${escapeHtml(meta?.nombre || '')}" placeholder="Ej: Moto, Viaje, Fondo de emergencia">
        </div>
        <div class="form-row">
          <label>Moneda</label>
          ${UI.selectHTML('moneda', [{ value: 'COP', label: 'COP' }, { value: 'USD', label: 'USD' }], meta?.moneda || 'COP')}
        </div>
        <div class="form-row">
          <label>Monto objetivo</label>
          ${UI.moneyInputHTML('montoObjetivo', meta?.montoObjetivo ?? '', { required: true })}
        </div>
        <div class="form-row">
          <label>Monto actual ahorrado</label>
          ${UI.moneyInputHTML('montoActual', meta?.montoActual ?? 0)}
        </div>
        <div class="form-row">
          <label>Fecha límite (opcional)</label>
          <input type="date" name="fechaLimite" value="${meta?.fechaLimite || ''}">
        </div>
        <div class="form-row">
          <label>Vincular a cuenta (opcional)</label>
          ${UI.selectHTML('cuentaId', cuentaOpts, meta?.cuentaId || '')}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">${meta ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        UI.initSelects(root);
        UI.initMoneyInputs(root);
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
          ${UI.moneyInputHTML('monto', '', { required: true })}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">Aportar</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        UI.initMoneyInputs(root);
        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#aporte-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const monto = parseFloat(fd.get('monto'));
          const nuevoMonto = meta.montoActual + monto;
          meta.montoActual = nuevoMonto;
          meta.completada = nuevoMonto >= meta.montoObjetivo;
          Storage.aporteMeta(meta.id, monto).catch(err => UI.toast('No se pudo guardar el aporte: ' + err.message, 'danger'));
          UI.closeModal();
          MetasView.render();
          const pct = Math.round((nuevoMonto / meta.montoObjetivo) * 100);
          UI.toast(pct >= 100 ? `🎉 ¡Meta "${meta.nombre}" completada!` : `Aporte registrado (${pct}%)`);
        };
      }
    });
  }
};
