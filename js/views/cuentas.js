const CuentasView = {
  renderSkeleton() {
    const container = document.getElementById('view-cuentas');
    const card = `
      <div class="account-card">
        <div class="actions">
          <div class="skeleton" style="width:28px;height:28px;border-radius:8px;"></div>
          <div class="skeleton" style="width:28px;height:28px;border-radius:8px;"></div>
        </div>
        <div class="skeleton" style="width:30px;height:30px;border-radius:9px;margin-bottom:10px;"></div>
        <div class="skeleton skeleton-line" style="width:56px;height:18px;border-radius:999px;display:inline-block;margin-right:6px;"></div>
        <div class="skeleton skeleton-line" style="width:96px;height:18px;border-radius:999px;display:inline-block;"></div>
        <div class="skeleton skeleton-line xl" style="width:65%;margin-top:10px;margin-bottom:8px;"></div>
        <div class="skeleton skeleton-line" style="width:45%;"></div>
      </div>`;
    container.innerHTML = `
      <div class="section-header">
        <div class="skeleton skeleton-line" style="width:140px;"></div>
        <div class="skeleton" style="width:130px;height:40px;border-radius:10px;"></div>
      </div>
      <div class="grid cols-1">${card}${card}${card}</div>
    `;
  },

  render() {
    const cuentas = Storage.get('cuentas');
    const container = document.getElementById('view-cuentas');

    if (cuentas.length === 0) {
      container.innerHTML = `
        <div class="empty-state card">
          <p>Aún no tienes cuentas registradas.</p>
          <button class="btn" id="add-cuenta-empty">+ Crear primera cuenta</button>
        </div>`;
      container.querySelector('#add-cuenta-empty').onclick = () => CuentasView.openForm();
      return;
    }

    const cards = cuentas.map(c => `
      <div class="account-card">
        <div class="actions">
          <button class="btn icon small secondary" data-edit="${c.id}" title="Editar">${ICON_EDIT}</button>
          <button class="btn icon small danger" data-del="${c.id}" title="Eliminar">${ICON_TRASH}</button>
        </div>
        <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 14px;">
          <span class="pill ${c.moneda === 'USD' ? 'usd' : 'cop'}">${c.moneda}</span>
          <span class="pill tipo">${TIPO_CUENTA_LABELS[c.tipo] || c.tipo}</span>
        </div>
        <div class="account-mini-icon-container">
          <div class="account-mini-icon" style="background:color-mix(in srgb, ${ACCOUNT_TIPO_COLOR[c.tipo]} 15%, transparent);color:${ACCOUNT_TIPO_COLOR[c.tipo]};margin-bottom:0px;">${ICON_ACCOUNT_TIPO[c.tipo] || ICON_ACCOUNT_TIPO.banco}</div>
          <div class="text-dim" style="font-size:16px;font-weight:600;">${escapeHtml(c.nombre)}</div>
        </div>
        <div class="balance" data-count="${c.saldo}" data-count-currency="${c.moneda}">${formatMoney(0, c.moneda)}</div>
        ${c.titular ? `<div class="text-dim" style="font-size:12px;margin-top:4px;">Titular: ${escapeHtml(c.titular)}</div>` : ''}
        ${c.notas ? `<div class="text-dim" style="font-size:12px;margin-top:6px;">${escapeHtml(c.notas)}</div>` : ''}
      </div>
    `).join('');

    container.innerHTML = `
      <div class="section-header">
        <div class="text-dim">${cuentas.length} cuenta(s) registrada(s)</div>
        <button class="btn" id="add-cuenta">+ Nueva cuenta</button>
      </div>
      <div class="grid cols-1">${cards}</div>
    `;

    container.querySelector('#add-cuenta').onclick = () => CuentasView.openForm();
    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = () => CuentasView.openForm(btn.dataset.edit);
    });
    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.del;
        const usada = Storage.get('transacciones').some(t => String(t.cuentaId) === String(id) || String(t.cuentaDestinoId) === String(id));
        const msg = usada
          ? '¿Eliminar esta cuenta? Tiene transacciones asociadas que conservarán la referencia histórica.'
          : '¿Eliminar esta cuenta?';
        UI.confirmAction(msg, () => {
          Storage.remove('cuentas', id);
          CuentasView.render();
          UI.toast('Cuenta eliminada');
        });
      };
    });

    animateCounters(container);
  },

  openForm(id) {
    const cuenta = id ? Storage.find('cuentas', id) : null;
    UI.openModal(cuenta ? 'Editar cuenta' : 'Nueva cuenta', `
      <form id="cuenta-form">
        <div class="form-row">
          <label>Nombre</label>
          <input type="text" name="nombre" required value="${escapeHtml(cuenta?.nombre || '')}" placeholder="Ej: Nequi, Ahorros Bancolombia, Acciones DIAN">
        </div>
        <div class="form-row inline">
          <div>
            <label>Tipo de cuenta</label>
            ${UI.selectHTML('tipo', [
              { value: 'efectivo', label: 'Efectivo' },
              { value: 'banco', label: 'Cuenta bancaria' },
              { value: 'inversion', label: 'Inversión' },
              { value: 'terceros', label: 'Cuenta de terceros' }
            ], cuenta?.tipo || 'efectivo')}
          </div>
          <div>
            <label>Moneda</label>
            ${UI.selectHTML('moneda', [
              { value: 'COP', label: 'COP (Pesos)' },
              { value: 'USD', label: 'USD (Dólares)' }
            ], cuenta?.moneda || 'COP')}
          </div>
        </div>
        <div class="form-row">
          <label>Saldo actual</label>
          ${UI.moneyInputHTML('saldo', cuenta?.saldo ?? 0)}
        </div>
        <div class="form-row">
          <label>Titular (si no es a tu nombre)</label>
          <input type="text" name="titular" value="${escapeHtml(cuenta?.titular || '')}" placeholder="Ej: dinero de mamá, cuenta de socio">
        </div>
        <div class="form-row">
          <label>Notas</label>
          <textarea name="notas" rows="2">${escapeHtml(cuenta?.notas || '')}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">${cuenta ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        UI.initSelects(root);
        UI.initMoneyInputs(root);
        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#cuenta-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const data = {
            nombre: fd.get('nombre').trim(),
            tipo: fd.get('tipo'),
            moneda: fd.get('moneda'),
            saldo: parseFloat(fd.get('saldo')) || 0,
            titular: fd.get('titular').trim(),
            notas: fd.get('notas').trim()
          };
          if (cuenta) {
            Storage.update('cuentas', cuenta.id, data);
            UI.toast('Cuenta actualizada');
          } else {
            data.creada = todayISO();
            Storage.insert('cuentas', data);
            UI.toast('Cuenta creada');
          }
          UI.closeModal();
          CuentasView.render();
          if (typeof DashboardView !== 'undefined') DashboardView.render();
        };
      }
    });
  }
};
