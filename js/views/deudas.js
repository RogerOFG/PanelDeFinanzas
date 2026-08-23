const DeudasView = {
  renderSkeleton() {
    const container = document.getElementById('view-deudas');
    const card = `
      <div class="card">
        <div class="section-header" style="margin-bottom:6px;">
          <div>
            <div class="skeleton skeleton-line" style="width:80px;height:18px;border-radius:999px;margin-bottom:8px;"></div>
            <div class="skeleton skeleton-line" style="width:120px;"></div>
          </div>
          <div style="display:flex;gap:6px;">
            <div class="skeleton" style="width:28px;height:28px;border-radius:8px;"></div>
            <div class="skeleton" style="width:28px;height:28px;border-radius:8px;"></div>
          </div>
        </div>
        <div class="skeleton skeleton-line lg" style="width:50%;margin:10px 0;"></div>
        <div class="skeleton skeleton-line" style="width:65%;margin-bottom:6px;"></div>
        <div class="skeleton skeleton-line" style="width:45%;margin-bottom:10px;"></div>
        <div class="skeleton" style="width:200px;height:32px;border-radius:8px;"></div>
      </div>`;
    container.innerHTML = `
      <div class="grid cols-1" style="margin-bottom:20px;">
        <div class="card">
          <div class="skeleton skeleton-line" style="width:150px;margin-bottom:10px;"></div>
          <div class="skeleton skeleton-line xl" style="width:55%;"></div>
        </div>
      </div>
      <div class="section-header">
        <div class="skeleton skeleton-line" style="width:150px;"></div>
        <div class="skeleton" style="width:110px;height:40px;border-radius:10px;"></div>
      </div>
      <div class="grid cols-1">${card}${card}</div>
    `;
  },

  filtro: 'todos',
  detalleId: null,

  render() {
    if (this.detalleId && Storage.find('deudas', this.detalleId)) {
      this.renderDetalle(this.detalleId);
    } else {
      this.detalleId = null;
      this.renderLista();
    }
    App.updateNotifDot();
  },

  iconoDeuda(d) {
    if (d.tipo === 'deuda') return { icon: ICON_DEUDA, color: 'var(--danger)' };
    const cat = CATEGORIAS_SUSCRIPCION[d.categoria] || CATEGORIAS_SUSCRIPCION.otros;
    return { icon: cat.icon, color: cat.color };
  },

  estadoDeuda(d) {
    const dias = daysUntil(this.proximoPago(d.diaPago));
    const enAlerta = dias !== null && dias <= (d.recordatorioDias ?? 3) && dias >= 0;
    const pagado = this.pagadoEsteCiclo(d);
    if (!d.activa) return { label: 'Inactiva', cls: 'tipo' };
    if (pagado) return { label: 'Pagado', cls: 'pos' };
    if (dias !== null && dias < 0) return { label: 'Vencido', cls: 'neg' };
    if (enAlerta) return { label: 'Vence pronto', cls: 'warn' };
    return { label: 'Al día', cls: 'tipo' };
  },

  initials(nombre) {
    const partes = String(nombre || '').trim().split(/\s+/);
    return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || '?';
  },

  renderLista() {
    const container = document.getElementById('view-deudas');
    const todas = Storage.get('deudas').slice().sort((a, b) => (a.diaPago || 31) - (b.diaPago || 31));

    if (todas.length === 0) {
      container.innerHTML = `
        <div class="empty-state card">
          <p>No tienes deudas o suscripciones registradas.</p>
          <button class="btn" id="add-deuda-empty">+ Agregar</button>
        </div>`;
      container.querySelector('#add-deuda-empty').onclick = () => this.openForm();
      return;
    }

    const activas = todas.filter(d => d.activa);
    const activasFiltradas = activas.filter(d => this.filtro === 'todos' || d.tipo === this.filtro);
    const totalMensual = activasFiltradas.reduce((sum, d) => sum + toBaseCurrency(d.monto, d.moneda), 0);
    const labelTotal = this.filtro === 'suscripcion' ? 'Total mensual en suscripciones'
      : this.filtro === 'deuda' ? 'Total mensual en deudas'
      : 'Total mensual (activas)';

    const suscripciones = todas.filter(d => d.tipo === 'suscripcion' && (this.filtro === 'todos' || this.filtro === 'suscripcion'));
    const deudas = todas.filter(d => d.tipo === 'deuda' && (this.filtro === 'todos' || this.filtro === 'deuda'));

    const filaSuscripcion = (d) => {
      const { icon, color } = this.iconoDeuda(d);
      const estado = this.estadoDeuda(d);
      const miembros = this.miembrosDe(d.id);
      const activosCount = miembros.filter(m => m.activo).length;
      return `
        <div class="debt-item" data-abrir="${d.id}">
          <div class="debt-item-top">
            <div class="debt-icon" style="background:color-mix(in srgb, ${color} 16%, transparent);color:${color};">${icon}</div>
            <div class="debt-item-body">
              <div class="debt-item-name">${escapeHtml(d.nombre)} <span class="pill" style="background:color-mix(in srgb, ${color} 16%, transparent);color:${color};">${CATEGORIAS_SUSCRIPCION[d.categoria]?.label || 'Otros'}</span></div>
              <div class="debt-item-sub">Próximo pago: ${d.diaPago} de cada mes</div>
              <div class="debt-item-sub">${ICON_USERS}${miembros.length ? `${activosCount} de ${miembros.length} miembros` : '0 miembros'}</div>
            </div>
            <div class="debt-item-right">
              <div class="debt-item-amount">${formatMoney(d.monto, d.moneda)}<span class="text-dim" style="font-size:10.5px;font-weight:400;">/mes</span></div>
              <span class="pill ${estado.cls}" style="margin-top:6px;display:inline-block;">${estado.label}</span>
            </div>
            <span class="debt-item-chevron">${ICON_CHEVRON}</span>
          </div>
        </div>`;
    };

    const filaDeuda = (d) => {
      const { icon, color } = this.iconoDeuda(d);
      const tieneTotal = d.montoTotal && d.montoTotal > 0;
      const pendiente = tieneTotal ? Math.max(0, d.montoTotal - (d.montoPagado || 0)) : null;
      const pct = tieneTotal ? Math.min(100, Math.round(((d.montoPagado || 0) / d.montoTotal) * 100)) : 0;
      const pagadoEsteCiclo = this.pagadoEsteCiclo(d);
      return `
        <div class="debt-item">
          <div class="debt-item-top" data-abrir="${d.id}">
            <div class="debt-icon" style="background:color-mix(in srgb, ${color} 16%, transparent);color:${color};">${icon}</div>
            <div class="debt-item-body">
              <div class="debt-item-name">${escapeHtml(d.nombre)} <span class="pill warn">Deuda</span></div>
              <div class="debt-item-sub">Próximo pago: ${d.diaPago} de cada mes</div>
            </div>
            <div class="debt-item-right">
              <div class="debt-item-amount">${formatMoney(d.monto, d.moneda)}<span class="text-dim" style="font-size:10.5px;font-weight:400;">/mes</span></div>
            </div>
          </div>
          ${tieneTotal ? `
            <div class="progress-bar"><div style="width:${pct}%;"></div></div>
            <div class="debt-item-progress-row">
              <span>Pagado: <strong style="color:var(--accent);">${formatMoney(d.montoPagado || 0, d.moneda)}</strong></span>
              <span>Pendiente: <strong style="color:var(--danger);">${formatMoney(pendiente, d.moneda)}</strong></span>
            </div>
          ` : ''}
          <div class="debt-item-actions">
            <button class="btn secondary small" data-abrir="${d.id}">Ver detalle</button>
            ${d.activa ? `<button class="btn ${pagadoEsteCiclo ? 'secondary' : ''} small" ${pagadoEsteCiclo ? 'disabled' : ''} data-pagar="${d.id}">${pagadoEsteCiclo ? 'Ya pagado' : 'Pagar ahora →'}</button>` : ''}
          </div>
        </div>`;
    };

    container.innerHTML = `
      <div class="hero-card">
        <div class="hero-glow"></div>
        <div class="hero-label">${labelTotal}</div>
        <div class="hero-value" data-count="${totalMensual}" data-count-currency="COP">${formatMoney(0, 'COP')}</div>
        <div class="hero-trend pos" style="color:var(--text-dim);">${activasFiltradas.length} activo(s) este mes</div>
        <div class="detail-header-badge" style="position:absolute;top:20px;right:20px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 000 4h4v-4z"/></svg>
        </div>
      </div>

      <div class="chip-tabs">
        <button class="chip-tab ${this.filtro === 'todos' ? 'active' : ''}" data-filtro="todos">Todas</button>
        <button class="chip-tab ${this.filtro === 'suscripcion' ? 'active' : ''}" data-filtro="suscripcion">Suscripciones</button>
        <button class="chip-tab ${this.filtro === 'deuda' ? 'active' : ''}" data-filtro="deuda">Deudas</button>
      </div>

      ${this.filtro !== 'deuda' ? `
        <div class="section-header">
          <span class="section-title">Suscripciones activas</span>
          <button class="link-btn" id="add-suscripcion">Agregar +</button>
        </div>
        <div class="debt-list">${suscripciones.length ? suscripciones.map(filaSuscripcion).join('') : '<div class="empty-state card">Sin suscripciones.</div>'}</div>
      ` : ''}

      ${this.filtro !== 'suscripcion' ? `
        <div class="section-header">
          <span class="section-title">Deudas</span>
          <button class="link-btn" id="add-deuda">Agregar deuda +</button>
        </div>
        <div class="debt-list">${deudas.length ? deudas.map(filaDeuda).join('') : '<div class="empty-state card">Sin deudas.</div>'}</div>
      ` : ''}
    `;

    container.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => { this.filtro = b.dataset.filtro; this.render(); });
    const addSus = container.querySelector('#add-suscripcion');
    if (addSus) addSus.onclick = () => this.openForm(null, 'suscripcion');
    const addDeuda = container.querySelector('#add-deuda');
    if (addDeuda) addDeuda.onclick = () => this.openForm(null, 'deuda');
    container.querySelectorAll('[data-abrir]').forEach(el => el.onclick = (e) => {
      e.stopPropagation();
      this.detalleId = el.dataset.abrir;
      this.render();
    });
    container.querySelectorAll('[data-pagar]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      this.marcarPago(b.dataset.pagar);
    });

    animateCounters(container);
  },

  renderDetalle(id) {
    const container = document.getElementById('view-deudas');
    const d = Storage.find('deudas', id);
    const { icon, color } = this.iconoDeuda(d);
    const estado = this.estadoDeuda(d);
    const prox = this.proximoPago(d.diaPago);
    const pagadoEsteCiclo = this.pagadoEsteCiclo(d);
    const historial = (d.historialPagos || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    const ultimoPago = historial[0];
    const miembros = this.miembrosDe(d.id);
    const activosCount = miembros.filter(m => m.activo).length;
    const tieneTotal = d.montoTotal && d.montoTotal > 0;
    const pendiente = tieneTotal ? Math.max(0, d.montoTotal - (d.montoPagado || 0)) : null;
    const pct = tieneTotal ? Math.min(100, Math.round(((d.montoPagado || 0) / d.montoTotal) * 100)) : 0;

    const avatarColors = ['var(--accent)', 'var(--accent-2)', 'var(--warning)', 'var(--danger)'];
    const filaMiembroMini = (m, i) => {
      const pagado = this.pagadoEsteCicloMiembro(m, d);
      return `
        <div class="member-row">
          <div class="member-avatar" style="background:${avatarColors[i % avatarColors.length]};">${this.initials(m.nombre)}</div>
          <div class="member-body">
            <div class="member-name">${escapeHtml(m.nombre)}</div>
            <div class="member-role">Miembro</div>
          </div>
          <span class="pill ${!m.activo ? 'tipo' : (pagado ? 'pos' : 'warn')}">${!m.activo ? 'Inactivo' : (pagado ? 'Activo' : 'Pendiente de pago')}</span>
        </div>`;
    };

    container.innerHTML = `
      <div class="detail-topbar">
        <button class="icon-btn" id="detalle-back" aria-label="Volver">${ICON_BACK}</button>
        <span class="detail-topbar-title">Detalle de ${d.tipo === 'suscripcion' ? 'suscripción' : 'deuda'}</span>
        <button class="icon-btn" id="detalle-editar" aria-label="Editar">${ICON_EDIT}</button>
      </div>

      <div class="detail-header-card">
        <div class="detail-header-icon" style="background:color-mix(in srgb, ${color} 16%, transparent);color:${color};">${icon}</div>
        <div style="flex:1;min-width:0;">
          <div class="detail-header-name">${escapeHtml(d.nombre)}</div>
          <span class="pill" style="background:color-mix(in srgb, ${color} 16%, transparent);color:${color};">${d.tipo === 'suscripcion' ? (CATEGORIAS_SUSCRIPCION[d.categoria]?.label || 'Otros') : 'Deuda'}</span>
          <div class="detail-header-price">${formatMoney(d.monto, d.moneda)}<span class="text-dim" style="font-size:12px;font-weight:400;">/mes</span></div>
          <span class="pill ${estado.cls}">${estado.label}</span>
        </div>
        <div class="detail-header-badge">${ICON_CALENDAR}</div>
      </div>

      ${tieneTotal ? `
        <div class="card" style="margin-bottom:16px;">
          <p class="card-title">Progreso de pago</p>
          <div class="progress-bar"><div style="width:${pct}%;"></div></div>
          <div class="debt-item-progress-row">
            <span>Pagado: <strong style="color:var(--accent);">${formatMoney(d.montoPagado || 0, d.moneda)}</strong></span>
            <span>Pendiente: <strong style="color:var(--danger);">${formatMoney(pendiente, d.moneda)}</strong></span>
          </div>
        </div>
      ` : ''}

      <div class="card" style="margin-bottom:16px;">
        <p class="card-title">Resumen</p>
        <div class="detail-row">
          <span class="detail-row-label">${ICON_CALENDAR} Próximo pago</span>
          <span class="detail-row-value">${d.diaPago} de cada mes</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">${ICON_CLOCK} Último pago</span>
          <span class="detail-row-value">${ultimoPago ? formatDate(ultimoPago.fecha) : '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row-label">${ICON_STATUS} Estado</span>
          <span class="pill ${d.activa ? 'pos' : 'tipo'}">${d.activa ? 'Activa' : 'Inactiva'}</span>
        </div>
        ${d.tipo === 'suscripcion' ? `
        <div class="detail-row">
          <span class="detail-row-label">${ICON_USERS} Miembros</span>
          <span class="detail-row-value">${activosCount} de ${miembros.length} miembros</span>
        </div>` : ''}
      </div>

      ${d.tipo === 'suscripcion' ? `
        <div class="card" style="margin-bottom:16px;">
          <div class="section-header" style="margin-bottom:6px;">
            <span class="section-title">Miembros</span>
            <button class="link-btn" id="detalle-gestionar">Gestionar ${ICON_CHEVRON}</button>
          </div>
          ${miembros.length ? miembros.map(filaMiembroMini).join('') : '<div class="empty-state">Aún no has agregado miembros.</div>'}
        </div>
      ` : ''}

      <div class="card" style="margin-bottom:16px;">
        <div class="section-header" style="margin-bottom:6px;">
          <span class="section-title">Historial de pagos</span>
          ${historial.length > 3 ? `<button class="link-btn" id="detalle-historial">Ver todo ${ICON_CHEVRON}</button>` : ''}
        </div>
        ${historial.length ? historial.slice(0, 3).map(p => `
          <div class="history-row">
            <div class="history-icon">${ICON_CALENDAR}</div>
            <div class="history-body">${formatDate(p.fecha)}<div class="history-sub">Pago manual</div></div>
            <span class="pill pos">${formatMoney(p.monto, d.moneda)}</span>
          </div>
        `).join('') : '<div class="empty-state">Sin pagos registrados.</div>'}
      </div>

      ${d.notas ? `
        <div class="card" style="margin-bottom:16px;">
          <p class="card-title">Notas</p>
          <div class="detail-row" style="border:none;padding:0;">
            <span class="detail-row-label" style="align-items:flex-start;">${ICON_NOTE}</span>
            <span class="detail-row-value" style="text-align:left;font-weight:400;color:var(--text-dim);">${escapeHtml(d.notas)}</span>
          </div>
        </div>
      ` : ''}

      <div class="detail-actions">
        ${d.tipo === 'suscripcion' ? `<button class="btn secondary" id="detalle-ver-miembros">${ICON_USERS} Ver miembros</button>` : `<button class="btn secondary" id="detalle-borrar">${ICON_TRASH} Eliminar</button>`}
        ${d.activa ? `<button class="btn ${pagadoEsteCiclo ? 'secondary' : ''}" ${pagadoEsteCiclo ? 'disabled' : ''} id="detalle-pagar">${ICON_CHECK} ${pagadoEsteCiclo ? 'Ya pagado este mes' : 'Marcar como pagado'}</button>` : ''}
      </div>
    `;

    container.querySelector('#detalle-back').onclick = () => { this.detalleId = null; this.render(); };
    container.querySelector('#detalle-editar').onclick = () => this.openForm(d.id);
    const gestionarBtn = container.querySelector('#detalle-gestionar');
    if (gestionarBtn) gestionarBtn.onclick = () => this.openMiembros(d.id);
    const verMiembrosBtn = container.querySelector('#detalle-ver-miembros');
    if (verMiembrosBtn) verMiembrosBtn.onclick = () => this.openMiembros(d.id);
    const borrarBtn = container.querySelector('#detalle-borrar');
    if (borrarBtn) borrarBtn.onclick = () => {
      UI.confirmAction('¿Eliminar esta deuda/suscripción?', () => {
        Storage.remove('deudas', d.id);
        this.detalleId = null;
        this.render();
        UI.toast('Eliminada');
      });
    };
    const historialBtn = container.querySelector('#detalle-historial');
    if (historialBtn) historialBtn.onclick = () => this.openHistorial(d.id);
    const pagarBtn = container.querySelector('#detalle-pagar');
    if (pagarBtn) pagarBtn.onclick = () => this.marcarPago(d.id);

    animateCounters(container);
  },

  openHistorial(id) {
    const d = Storage.find('deudas', id);
    const historial = (d.historialPagos || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    UI.openModal(`Historial de pagos — ${escapeHtml(d.nombre)}`, `
      ${historial.length ? historial.map(p => `
        <div class="history-row">
          <div class="history-icon">${ICON_CALENDAR}</div>
          <div class="history-body">${formatDate(p.fecha)}<div class="history-sub">Pago manual</div></div>
          <span class="pill pos">${formatMoney(p.monto, d.moneda)}</span>
        </div>
      `).join('') : '<div class="empty-state">Sin pagos registrados.</div>'}
      <div class="modal-actions">
        <button type="button" class="btn" id="cerrar-historial">Cerrar</button>
      </div>
    `, {
      onMount: (root) => { root.querySelector('#cerrar-historial').onclick = () => UI.closeModal(); }
    });
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
    this.openPagoDeuda(deuda);
  },

  openPagoDeuda(deuda) {
    const cuentas = Storage.get('cuentas');
    const cuentaOpts = cuentas.map(c => ({ value: c.id, label: accountLabel(c) }));

    UI.openModal(`Pago de ${escapeHtml(deuda.nombre)}`, `
      <form id="pago-deuda-form">
        <div class="form-row">
          <label>${deuda.tipoPago === 'variable' ? '¿Cuánto pagaste este mes?' : 'Monto'}</label>
          ${UI.moneyInputHTML('monto', deuda.monto ?? '', { required: true })}
        </div>
        <div class="form-row checkbox-row">
          <input type="checkbox" name="soloRegistro" id="pd-solo-registro">
          <label for="pd-solo-registro" style="margin:0;">Ya está reflejado en mi saldo (no crear un gasto nuevo)</label>
        </div>
        <div class="form-row" id="pd-cuenta-row">
          <label>¿De qué cuenta salió el pago?</label>
          ${UI.selectHTML('cuentaId', cuentaOpts, cuentaOpts[0]?.value, { id: 'pd-cuenta' })}
        </div>
        <div class="form-row">
          <label>Fecha</label>
          <input type="date" name="fecha" value="${todayISO()}">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">Registrar</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        UI.initSelects(root);
        UI.initMoneyInputs(root);

        const soloRegistroChk = root.querySelector('#pd-solo-registro');
        const cuentaRow = root.querySelector('#pd-cuenta-row');
        soloRegistroChk.addEventListener('change', () => {
          cuentaRow.style.display = soloRegistroChk.checked ? 'none' : '';
        });

        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#pago-deuda-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const monto = parseFloat(fd.get('monto'));
          const soloRegistro = fd.get('soloRegistro') === 'on';
          const cuentaId = soloRegistro ? null : fd.get('cuentaId');
          const fecha = fd.get('fecha') || todayISO();
          const cuenta = soloRegistro ? null : Storage.find('cuentas', cuentaId);

          deuda.historialPagos = [...(deuda.historialPagos || []), { fecha, monto }];
          deuda.montoPagado = (deuda.montoPagado || 0) + monto;
          if (cuenta) cuenta.saldo -= monto;

          Storage.pagoDeuda(deuda.id, { monto, cuentaId, fecha, soloRegistro }).then(() => {
            if (!soloRegistro) {
              Storage.initFromServer().then(() => {
                TransaccionesView.render();
                if (typeof DashboardView !== 'undefined') DashboardView.render();
              });
            }
          }).catch(err => {
            if (cuenta) cuenta.saldo += monto;
            CuentasView.render();
            UI.toast('No se pudo guardar el pago: ' + err.message, 'danger');
          });

          UI.closeModal();
          DeudasView.render();
          CuentasView.render();
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

    this.pendingMemberReminders().forEach(r => {
      UI.toast(`Falta marcar el pago de ${r.miembro.nombre} — ${r.deuda.nombre} (${formatMoney(r.miembro.montoMensual, r.deuda.moneda)})`, 'warn');
    });
  },

  // Miembros activos que aún no han pagado este ciclo, cerca o después de la fecha de pago.
  pendingMemberReminders() {
    const deudas = Storage.get('deudas').filter(d => d.activa);
    const resultado = [];
    deudas.forEach(d => {
      const dias = daysUntil(this.proximoPago(d.diaPago));
      const umbral = d.recordatorioDias ?? 3;
      if (dias === null || dias > umbral) return;
      this.miembrosDe(d.id).filter(m => m.activo).forEach(m => {
        if (!this.pagadoEsteCicloMiembro(m, d)) resultado.push({ miembro: m, deuda: d, dias });
      });
    });
    return resultado;
  },

  miembrosDe(deudaId) {
    return Storage.get('miembros').filter(m => String(m.deudaId) === String(deudaId));
  },

  pagadoEsteCicloMiembro(miembro, deuda) {
    const inicio = this.cicloInicio(deuda.diaPago);
    return (miembro.pagos || []).some(p => p.fecha >= inicio);
  },

  totalPagadoMiembro(miembro) {
    return (miembro.pagos || []).reduce((s, p) => s + p.monto, 0);
  },

  miembrosConDeuda(deuda) {
    return this.miembrosDe(deuda.id).filter(m => m.activo).filter(m => {
      const ciclos = this.ciclosTranscurridosMiembro(m, deuda);
      return this.totalPagadoMiembro(m) - (ciclos * m.montoMensual) < 0;
    });
  },

  // Cuántos ciclos de cobro (meses) han empezado desde que se agregó el miembro,
  // incluyendo el actual — para acumular la deuda en vez de "olvidarla" cada mes.
  ciclosTranscurridosMiembro(miembro, deuda) {
    if (!miembro.creadoEn) return 1;
    const creado = new Date(miembro.creadoEn + 'T00:00:00');
    const inicioActual = new Date(this.cicloInicio(deuda.diaPago) + 'T00:00:00');
    let cursor = new Date(creado.getFullYear(), creado.getMonth(), deuda.diaPago);
    if (cursor < creado) cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, deuda.diaPago);
    let count = 0;
    while (cursor <= inicioActual) {
      count++;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, deuda.diaPago);
    }
    return Math.max(count, 1);
  },

  openMiembros(deudaId) {
    const deuda = Storage.find('deudas', deudaId);
    const miembros = this.miembrosDe(deudaId);

    const filaMiembro = (m) => {
      const pagadoEsteCiclo = this.pagadoEsteCicloMiembro(m, deuda);
      const totalPagado = this.totalPagadoMiembro(m);
      const ultimoPago = (m.pagos || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

      const ciclos = this.ciclosTranscurridosMiembro(m, deuda);
      const totalEsperado = ciclos * m.montoMensual;
      const balance = totalPagado - totalEsperado; // negativo = debe, positivo = pagó de más

      let difTexto, difClase;
      if (balance === 0) {
        difTexto = 'Al día';
        difClase = 'pos';
      } else if (balance > 0) {
        difTexto = `Pagó ${formatMoney(balance, deuda.moneda)} de más`;
        difClase = 'pos';
      } else {
        const mesesDebe = Math.ceil(Math.abs(balance) / m.montoMensual);
        difTexto = `Debe ${formatMoney(Math.abs(balance), deuda.moneda)} — ${mesesDebe} mes${mesesDebe > 1 ? 'es' : ''} sin pagar`;
        difClase = 'neg';
      }

      return `
        <div class="card" style="margin-bottom:10px;">
          <div class="section-header" style="margin-bottom:6px;">
            <div>
              <strong>${escapeHtml(m.nombre)}</strong>
              ${!m.activo ? '<span class="pill tipo" style="margin-left:6px;">Inactivo</span>' : ''}
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn icon small secondary" data-editar-miembro="${m.id}">${ICON_EDIT}</button>
              <button class="btn icon small danger" data-borrar-miembro="${m.id}">${ICON_TRASH}</button>
            </div>
          </div>
          <div class="stat-sub">Cuota mensual: ${formatMoney(m.montoMensual, deuda.moneda)}</div>
          <div class="stat-sub">Total acumulado pagado: <strong>${formatMoney(totalPagado, deuda.moneda)}</strong></div>
          <div class="stat-sub"><span class="pill ${difClase}">${difTexto}</span></div>
          ${ultimoPago ? `<div class="stat-sub">Último pago: ${formatDate(ultimoPago.fecha)} · ${formatMoney(ultimoPago.monto, deuda.moneda)}</div>` : ''}
          ${m.activo ? `<button class="btn small ${balance < -m.montoMensual ? 'danger' : (pagadoEsteCiclo ? 'secondary' : 'warning')}" style="margin-top:8px;" data-pagar-miembro="${m.id}">${pagadoEsteCiclo ? 'Registrar otro pago' : 'Marcar que pagó'}</button>` : ''}
        </div>`;
    };

    UI.openModal(`Miembros — ${escapeHtml(deuda.nombre)}`, `
      <div id="miembros-lista">
        ${miembros.length ? miembros.map(filaMiembro).join('') : '<div class="empty-state">Aún no has agregado miembros.</div>'}
      </div>
      <button class="btn secondary" id="add-miembro" style="width:100%;margin-top:6px;">+ Agregar miembro</button>
      <div class="modal-actions">
        <button type="button" class="btn" id="cerrar-miembros">Cerrar</button>
      </div>
    `, {
      onMount: (root) => {
        root.querySelector('#cerrar-miembros').onclick = () => UI.closeModal();
        root.querySelector('#add-miembro').onclick = () => this.openMiembroForm(deudaId);
        root.querySelectorAll('[data-editar-miembro]').forEach(b => b.onclick = () => this.openMiembroForm(deudaId, b.dataset.editarMiembro));
        root.querySelectorAll('[data-pagar-miembro]').forEach(b => b.onclick = () => this.openPagoMiembro(b.dataset.pagarMiembro));
        root.querySelectorAll('[data-borrar-miembro]').forEach(b => b.onclick = () => {
          UI.confirmAction('¿Eliminar este miembro? Se conservará el historial de transacciones ya creadas.', () => {
            Storage.remove('miembros', b.dataset.borrarMiembro);
            UI.closeModal();
            DeudasView.render();
            DeudasView.openMiembros(deudaId);
          });
        });
      }
    });
  },

  openMiembroForm(deudaId, id) {
    const miembro = id ? Storage.find('miembros', id) : null;
    UI.openModal(miembro ? 'Editar miembro' : 'Nuevo miembro', `
      <form id="miembro-form">
        <div class="form-row">
          <label>Nombre</label>
          <input type="text" name="nombre" required value="${escapeHtml(miembro?.nombre || '')}" placeholder="Ej: Mamá, Juan">
        </div>
        <div class="form-row">
          <label>Cuánto paga cada mes</label>
          ${UI.moneyInputHTML('montoMensual', miembro?.montoMensual ?? '', { required: true })}
        </div>
        <div class="form-row checkbox-row">
          <input type="checkbox" name="activo" id="chk-miembro-activo" ${miembro?.activo !== false ? 'checked' : ''}>
          <label for="chk-miembro-activo" style="margin:0;">Activo</label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">${miembro ? 'Guardar' : 'Agregar'}</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        UI.initMoneyInputs(root);
        root.querySelector('#cancel-btn').onclick = () => { UI.closeModal(); DeudasView.openMiembros(deudaId); };
        root.querySelector('#miembro-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const data = {
            deudaId,
            nombre: fd.get('nombre').trim(),
            montoMensual: parseFloat(fd.get('montoMensual')),
            activo: fd.get('activo') === 'on'
          };
          const refrescar = () => {
            DeudasView.render();
            DeudasView.openMiembros(deudaId);
          };

          if (miembro) {
            Storage.update('miembros', miembro.id, data);
            UI.closeModal();
            refrescar();
          } else {
            // Espera la confirmación del servidor antes de reabrir la lista, para que
            // el botón de "marcar pago" quede apuntando al ID real, no al temporal.
            UI.closeModal();
            Storage.insert('miembros', data, refrescar, refrescar);
          }
          UI.toast(miembro ? 'Miembro actualizado' : 'Miembro agregado');
        };
      }
    });
  },

  openPagoMiembro(miembroId) {
    const miembro = Storage.find('miembros', miembroId);
    const deuda = Storage.find('deudas', miembro.deudaId);
    const cuentas = Storage.get('cuentas');
    const cuentaOpts = cuentas.map(c => ({ value: c.id, label: accountLabel(c) }));

    UI.openModal(`Pago de ${escapeHtml(miembro.nombre)}`, `
      <form id="pago-miembro-form">
        <p class="text-dim mt-0">${escapeHtml(deuda.nombre)} — cuota: ${formatMoney(miembro.montoMensual, deuda.moneda)}</p>
        <div class="form-row">
          <label>¿Cuánto pagó?</label>
          ${UI.moneyInputHTML('monto', miembro.montoMensual, { required: true })}
        </div>
        <div class="form-row checkbox-row">
          <input type="checkbox" name="soloRegistro" id="pm-solo-registro">
          <label for="pm-solo-registro" style="margin:0;">Ya está reflejado en mi saldo (no crear un ingreso nuevo)</label>
        </div>
        <div class="form-row" id="pm-cuenta-row">
          <label>¿A qué cuenta llegó el pago?</label>
          ${UI.selectHTML('cuentaId', cuentaOpts, cuentaOpts[0]?.value, { id: 'pm-cuenta' })}
        </div>
        <div class="form-row">
          <label>Fecha</label>
          <input type="date" name="fecha" value="${todayISO()}">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">Registrar pago</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        UI.initSelects(root);
        UI.initMoneyInputs(root);
        root.querySelector('#cancel-btn').onclick = () => { UI.closeModal(); DeudasView.openMiembros(miembro.deudaId); };

        const soloRegistroChk = root.querySelector('#pm-solo-registro');
        const cuentaRow = root.querySelector('#pm-cuenta-row');
        soloRegistroChk.addEventListener('change', () => {
          cuentaRow.style.display = soloRegistroChk.checked ? 'none' : '';
        });

        root.querySelector('#pago-miembro-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const monto = parseFloat(fd.get('monto'));
          const soloRegistro = fd.get('soloRegistro') === 'on';
          const cuentaId = soloRegistro ? null : fd.get('cuentaId');
          const fecha = fd.get('fecha') || todayISO();
          const cuenta = soloRegistro ? null : Storage.find('cuentas', cuentaId);

          // Optimista: refleja el pago (y el ingreso, salvo que ya esté contado) de inmediato.
          miembro.pagos = [...(miembro.pagos || []), { monto, cuentaId, fecha }];
          if (cuenta) cuenta.saldo += monto;

          Storage.pagoMiembro(miembroId, { monto, cuentaId, fecha, soloRegistro }).then(() => {
            if (!soloRegistro) {
              // Refresca transacciones para que el ingreso auto-generado aparezca en la lista.
              Storage.initFromServer().then(() => {
                TransaccionesView.render();
                if (typeof DashboardView !== 'undefined') DashboardView.render();
              });
            }
          }).catch(err => {
            miembro.pagos = miembro.pagos.filter(p => p !== miembro.pagos[miembro.pagos.length - 1]);
            if (cuenta) cuenta.saldo -= monto;
            CuentasView.render();
            UI.toast('No se pudo registrar el pago: ' + err.message, 'danger');
          });

          UI.closeModal();
          DeudasView.render();
          CuentasView.render();
          DeudasView.openMiembros(miembro.deudaId);
          UI.toast(`Pago de ${miembro.nombre} registrado`);
        };
      }
    });
  },

  openForm(id, tipoDefault) {
    const deuda = id ? Storage.find('deudas', id) : null;
    const tipoInicial = deuda?.tipo || tipoDefault || 'suscripcion';
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
            ], tipoInicial, { id: 'deuda-tipo' })}
          </div>
          <div>
            <label>Moneda</label>
            ${UI.selectHTML('moneda', [{ value: 'COP', label: 'COP' }, { value: 'USD', label: 'USD' }], deuda?.moneda || 'COP')}
          </div>
        </div>
        <div class="form-row" id="categoria-row" style="display:${tipoInicial === 'suscripcion' ? '' : 'none'};">
          <label>Categoría</label>
          ${UI.selectHTML('categoria', Object.entries(CATEGORIAS_SUSCRIPCION).map(([value, c]) => ({ value, label: c.label })), deuda?.categoria || 'otros')}
        </div>
        <div class="form-row">
          <label>¿Cómo se paga cada mes?</label>
          ${UI.selectHTML('tipoPago', [
            { value: 'fijo', label: 'Monto fijo (siempre lo mismo)' },
            { value: 'variable', label: 'Monto variable (lo escribo cada vez)' }
          ], deuda?.tipoPago || 'fijo', { id: 'tipo-pago' })}
        </div>
        <div class="form-row">
          <label id="monto-mensual-label">Monto mensual</label>
          ${UI.moneyInputHTML('monto', deuda?.monto ?? '', { id: 'monto-mensual', required: true })}
        </div>
        <div class="form-row">
          <label>Día de pago (1-28)</label>
          <input type="number" name="diaPago" min="1" max="28" required value="${deuda?.diaPago ?? 1}">
        </div>
        <div class="form-row">
          <label>Monto total adeudado (opcional — solo si es una deuda con un total a pagar)</label>
          ${UI.moneyInputHTML('montoTotal', deuda?.montoTotal ?? '', { placeholder: 'Ej: tarjeta de crédito' })}
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
        UI.initMoneyInputs(root);

        const tipoPagoHidden = root.querySelector('#tipo-pago');
        const montoLabel = root.querySelector('#monto-mensual-label');
        function updateMontoLabel() {
          montoLabel.textContent = tipoPagoHidden.value === 'variable' ? 'Monto aproximado del mes' : 'Monto mensual';
        }
        tipoPagoHidden.addEventListener('change', updateMontoLabel);
        updateMontoLabel();

        const tipoHidden = root.querySelector('#deuda-tipo');
        const categoriaRow = root.querySelector('#categoria-row');
        tipoHidden.addEventListener('change', () => {
          categoriaRow.style.display = tipoHidden.value === 'suscripcion' ? '' : 'none';
        });

        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#deuda-form').onsubmit = (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const montoTotal = parseFloat(fd.get('montoTotal'));
          const data = {
            nombre: fd.get('nombre').trim(),
            tipo: fd.get('tipo'),
            categoria: fd.get('tipo') === 'suscripcion' ? fd.get('categoria') : null,
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
