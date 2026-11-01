const DeudasView = {
  renderSkeleton() {
    const container = document.getElementById('view-deudas');
    const itemSkeleton = (conProgreso) => `
      <div class="debt-item">
        <div class="debt-item-top">
          <div class="skeleton" style="width:44px;height:44px;border-radius:13px;flex-shrink:0;"></div>
          <div class="debt-item-body">
            <div class="skeleton skeleton-line" style="width:70%;margin-bottom:8px;"></div>
            <div class="skeleton skeleton-line" style="width:50%;margin-bottom:6px;"></div>
            <div class="skeleton skeleton-line" style="width:40%;"></div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div class="skeleton skeleton-line" style="width:60px;margin-bottom:6px;margin-left:auto;"></div>
            <div class="skeleton skeleton-line" style="width:50px;height:16px;border-radius:999px;margin-left:auto;"></div>
          </div>
        </div>
        ${conProgreso ? `
          <div class="skeleton" style="height:7px;border-radius:99px;margin-top:4px;"></div>
          <div style="display:flex;justify-content:space-between;">
            <div class="skeleton skeleton-line" style="width:80px;"></div>
            <div class="skeleton skeleton-line" style="width:80px;"></div>
          </div>
        ` : ''}
      </div>`;
    container.innerHTML = `
      <div class="hero-card-debt" style="margin-bottom:18px;">
        <div class="hero-card-left">
          <div class="skeleton skeleton-line" style="width:130px;margin-bottom:10px;"></div>
          <div class="skeleton skeleton-line xl" style="width:180px;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-line" style="width:110px;"></div>
        </div>
        <div class="skeleton" style="width:70px;height:70px;border-radius:28px;"></div>
      </div>
      <div class="chip-tabs">
        <div class="skeleton" style="width:60px;height:36px;border-radius:999px;"></div>
        <div class="skeleton" style="width:110px;height:36px;border-radius:999px;"></div>
        <div class="skeleton" style="width:80px;height:36px;border-radius:999px;"></div>
      </div>
      <div class="section-header">
        <div class="skeleton skeleton-line" style="width:150px;"></div>
        <div class="skeleton skeleton-line" style="width:80px;"></div>
      </div>
      <div class="debt-list">${itemSkeleton(false)}${itemSkeleton(false)}</div>
      <div class="section-header">
        <div class="skeleton skeleton-line" style="width:80px;"></div>
        <div class="skeleton skeleton-line" style="width:100px;"></div>
      </div>
      <div class="debt-list">${itemSkeleton(true)}</div>
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

  // Último vencimiento que ya ocurrió (el diaPago más reciente que no es futuro).
  // Siempre devuelve una fecha <= hoy. Es independiente de si se pagó o no.
  ultimoVencimiento(diaPago) {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(), day = now.getDate();
    const esteMes = fechaDiaMes(y, m, diaPago);
    // Si el diaPago de este mes ya pasó o es hoy, el último vencimiento es este mes
    if (esteMes <= new Date(y, m, day)) return dateToISOLocal(esteMes);
    // Si no, fue el mes pasado
    return dateToISOLocal(fechaDiaMes(y, m - 1, diaPago));
  },

  // ¿El último vencimiento que ya pasó fue cubierto por un pago?
  // Busca un pago entre [vencimiento - 1 mes, vencimiento].
  ultimoVencimientoPagado(deuda) {
    return this.vencimientosCubiertos(deuda.historialPagos, deuda.diaPago, this.cuotaDeuda(deuda)).has(this.ultimoVencimiento(deuda.diaPago));
  },

  estaAtrasado(d) {
    if (!d.activa || this.pagadoEsteCiclo(d)) return false;
    const ultVenc = this.ultimoVencimiento(d.diaPago);
    // Un vencimiento anterior a la creación de la deuda no cuenta como atraso.
    if (d.creadoEn && ultVenc < d.creadoEn) return false;
    const diasUltVenc = daysUntil(ultVenc);
    return diasUltVenc !== null && diasUltVenc < 0 && !this.ultimoVencimientoPagado(d);
  },

  estadoDeuda(d) {
    if (!d.activa) return { label: 'Inactiva', cls: 'tipo' };
    if (this.pagadoEsteCiclo(d)) return { label: 'Pagado', cls: 'pos' };
    if (this.estaAtrasado(d)) return { label: 'Atrasado', cls: 'neg' };
    const dias = daysUntil(this.proximoPago(d.diaPago));
    if (dias !== null && dias <= (d.recordatorioDias ?? 3) && dias >= 0) return { label: 'Vence pronto', cls: 'warn' };
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
      const pagadosCount = miembros.filter(m => m.activo && this.pagadoEsteCicloMiembro(m, d)).length;
      return `
        <div class="debt-item" data-abrir="${d.id}">
          <div class="debt-item-top">
            <div class="debt-icon" style="background:color-mix(in srgb, ${color} 16%, transparent);color:${color};">${icon}</div>
            <div class="debt-item-body">
              <div class="debt-item-name">${escapeHtml(d.nombre)} <span class="pill" style="background:color-mix(in srgb, ${color} 16%, transparent);color:${color};">${CATEGORIAS_SUSCRIPCION[d.categoria]?.label || 'Otros'}</span></div>
              <div class="debt-item-sub">Próximo pago: ${d.diaPago} de cada mes</div>
              <div class="debt-item-sub">${ICON_USERS}${activosCount ? `${pagadosCount} de ${activosCount} miembros pagaron` : '0 miembros'}</div>
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
      <div class="hero-card-debt">
        <div class="hero-card-left">
          <div class="hero-label">${labelTotal}</div>
          <div class="hero-value" data-count="${totalMensual}" data-count-currency="COP">${formatMoney(0, 'COP')}</div>
          <div class="hero-sub">${activasFiltradas.length} ${activasFiltradas.length === 1 ? 'activo' : 'activos'} este mes</div>
        </div>
        <div class="hero-icon-badge">
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
          <div class="detail-header-name">
            ${escapeHtml(d.nombre)}
            <span class="pill" style="margin-left: 10px; background:color-mix(in srgb, ${color} 16%, transparent);color:${color};">${d.tipo === 'suscripcion' ? (CATEGORIAS_SUSCRIPCION[d.categoria]?.label || 'Otros') : 'Deuda'}</span>
            <span class="pill ${estado.cls}">${estado.label}</span>
          </div>
          <div class="detail-header-price">${formatMoney(d.monto, d.moneda)}<span class="text-dim" style="font-size:12px;font-weight:400;">/mes</span></div>
        </div>
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
    const year = now.getFullYear(), month = now.getMonth();
    let candidate = fechaDiaMes(year, month, diaPago);
    if (candidate < new Date(year, month, now.getDate())) {
      candidate = fechaDiaMes(year, month + 1, diaPago);
    }
    return dateToISOLocal(candidate);
  },

  // Fecha en que empezó el ciclo de cobro actual (un mes antes del próximo vencimiento).
  cicloInicio(diaPago) {
    const proximo = new Date(this.proximoPago(diaPago) + 'T00:00:00');
    return dateToISOLocal(fechaDiaMes(proximo.getFullYear(), proximo.getMonth() - 1, diaPago));
  },

  // Asigna cada pago (en orden) al vencimiento más reciente <= su fecha si aún no está
  // cubierto (pago a tiempo o tarde); si ya lo está, es un adelanto del siguiente
  // vencimiento sin cubrir. Avanza por (año, mes) lógicos para no saltar meses cortos.
  // Con `cuota` > 0, un pago de varias cuotas (ej. octubre y noviembre juntos) cubre
  // tantos vencimientos consecutivos como alcance su monto.
  vencimientosCubiertos(pagos, diaPago, cuota) {
    const cubiertos = new Set();
    const venc = (i) => dateToISOLocal(fechaDiaMes(Math.floor(i / 12), i % 12, diaPago));
    (pagos || []).filter(p => p.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(p => {
      const f = new Date(p.fecha + 'T00:00:00');
      let idx = f.getFullYear() * 12 + f.getMonth();
      if (venc(idx) > p.fecha) idx--;
      // Solo meses completos (15k con cuota de 10k = 1 mes); 1% de tolerancia por redondeos.
      const veces = cuota > 0 ? Math.max(1, Math.floor(p.monto / cuota + 0.01)) : 1;
      for (let n = 0; n < veces; n++) {
        while (cubiertos.has(venc(idx))) idx++;
        cubiertos.add(venc(idx));
      }
    });
    return cubiertos;
  },

  cuotaDeuda(deuda) {
    return deuda.tipoPago === 'variable' ? 0 : Number(deuda.monto) || 0;
  },

  // Pagado si está cubierto el vencimiento que acaba de pasar (vale hasta el próximo)
  // o si ya se adelantó el pago del próximo vencimiento.
  cicloCubierto(pagos, diaPago, cuota) {
    const cubiertos = this.vencimientosCubiertos(pagos, diaPago, cuota);
    return cubiertos.has(this.ultimoVencimiento(diaPago)) || cubiertos.has(this.proximoPago(diaPago));
  },

  pagadoEsteCiclo(deuda) {
    return this.cicloCubierto(deuda.historialPagos, deuda.diaPago, this.cuotaDeuda(deuda));
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
          if (!UI.guardSubmit(e)) return;
          const fd = new FormData(e.target);
          const monto = parseFloat(fd.get('monto'));
          const soloRegistro = fd.get('soloRegistro') === 'on';
          const cuentaId = soloRegistro ? null : fd.get('cuentaId');
          const fecha = fd.get('fecha') || todayISO();
          const cuenta = soloRegistro ? null : Storage.find('cuentas', cuentaId);

          deuda.historialPagos = [...(deuda.historialPagos || []), { fecha, monto }];
          deuda.montoPagado = (deuda.montoPagado || 0) + monto;
          if (cuenta) cuenta.saldo -= monto;

          const pagoOptimista = deuda.historialPagos[deuda.historialPagos.length - 1];
          Storage.pagoDeuda(deuda.id, { monto, cuentaId, fecha, soloRegistro }).then(() => {
            Storage.initFromServer().then(() => {
              DeudasView.render();
              if (!soloRegistro) {
                TransaccionesView.render();
                if (typeof DashboardView !== 'undefined') DashboardView.render();
              }
              const fresca = Storage.find('deudas', deuda.id);
              const pendientes = fresca ? DeudasView.miembrosDe(fresca.id)
                .filter(m => m.activo && !DeudasView.pagadoEsteCicloMiembro(m, fresca)) : [];
              if (pendientes.length && !document.querySelector('#modal-root form')) {
                UI.toast('¿También pagaron los miembros? Revisa y confirma los movimientos.');
                DeudasView.openPagoMasivo(fresca.id, { fecha });
              }
            });
          }).catch(err => {
            deuda.historialPagos = deuda.historialPagos.filter(p => p !== pagoOptimista);
            deuda.montoPagado = (deuda.montoPagado || 0) - monto;
            if (cuenta) cuenta.saldo += monto;
            DeudasView.render();
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
      const vencido = this.estaAtrasado(d);
      const prox = vencido ? this.ultimoVencimiento(d.diaPago) : this.proximoPago(d.diaPago);
      const dias = daysUntil(prox);
      const umbral = d.recordatorioDias ?? 3;

      if (vencido) {
        const titulo = `${d.nombre} — atrasado ${Math.abs(dias)} día(s)`;
        App.sendBrowserNotif('Pago atrasado', `${titulo} — ${formatMoney(d.monto, d.moneda)}`);
      } else if (dias !== null && dias >= 0 && dias <= umbral) {
        const texto = dias === 0 ? 'hoy' : `en ${dias} día(s)`;
        UI.toast(`"${d.nombre}" vence ${texto} — ${formatMoney(d.monto, d.moneda)}`, dias === 0 ? 'danger' : 'warn');
        App.sendBrowserNotif('Pago próximo', `"${d.nombre}" vence ${texto} — ${formatMoney(d.monto, d.moneda)}`);
      }
    });

    const miembros = this.pendingMemberReminders();
    miembros.forEach(r => {
      if (r.vencido) {
        App.sendBrowserNotif('Pago de miembro atrasado', `${r.miembro.nombre} — ${r.deuda.nombre}`);
      }
    });
  },

  // Miembros activos que aún no han pagado este ciclo, cerca o después de la fecha de pago.
  pendingMemberReminders() {
    const deudas = Storage.get('deudas').filter(d => d.activa);
    const resultado = [];
    deudas.forEach(d => {
      const dias = daysUntil(this.proximoPago(d.diaPago));
      const umbral = d.recordatorioDias ?? 3;
      const vencido = this.estaAtrasado(d);
      const deudaPagada = this.pagadoEsteCiclo(d);
      // Mostrar miembros pendientes si: la deuda ya fue pagada (cobrar a los que faltan),
      // está vencida, o está dentro del umbral de recordatorio.
      if (!deudaPagada && !vencido && (dias === null || dias > umbral)) return;
      const diasVenc = vencido ? daysUntil(this.ultimoVencimiento(d.diaPago)) : dias;
      this.miembrosDe(d.id).filter(m => m.activo).forEach(m => {
        if (!this.pagadoEsteCicloMiembro(m, d)) {
          resultado.push({ miembro: m, deuda: d, dias: diasVenc, vencido });
        }
      });
    });
    return resultado;
  },

  miembrosDe(deudaId) {
    return Storage.get('miembros').filter(m => String(m.deudaId) === String(deudaId));
  },

  // Pagado solo si cubrió el ciclo y no arrastra saldo pendiente de meses anteriores.
  pagadoEsteCicloMiembro(miembro, deuda) {
    if (!this.cicloCubierto(miembro.pagos, deuda.diaPago, Number(miembro.montoMensual) || 0)) return false;
    const debe = this.ciclosTranscurridosMiembro(miembro, deuda) * miembro.montoMensual - this.totalPagadoMiembro(miembro);
    return debe <= 0;
  },

  totalPagadoMiembro(miembro) {
    return (miembro.pagos || []).reduce((s, p) => s + p.monto, 0);
  },

  // Cuántos vencimientos (creadoEn <= d <= hoy) han ocurrido desde que se agregó el
  // miembro — para acumular la deuda en vez de "olvidarla" cada mes.
  ciclosTranscurridosMiembro(miembro, deuda) {
    if (!miembro.creadoEn) return 1;
    const hoy = todayISO();
    const c = new Date(miembro.creadoEn + 'T00:00:00');
    let idx = c.getFullYear() * 12 + c.getMonth();
    const venc = (i) => dateToISOLocal(fechaDiaMes(Math.floor(i / 12), i % 12, deuda.diaPago));
    if (venc(idx) < miembro.creadoEn) idx++;
    let count = 0;
    while (venc(idx) <= hoy) { count++; idx++; }
    return count;
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
              ${m.activo && !String(m.id).startsWith('tmp_') ? `<input type="checkbox" data-sel-miembro="${m.id}" ${pagadoEsteCiclo ? '' : 'checked'} style="margin-right:6px;">` : ''}
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
      ${miembros.some(m => m.activo) ? `<button class="btn" id="pagar-seleccionados" style="width:100%;margin-top:6px;">Marcar seleccionados como pagados</button>` : ''}
      <button class="btn secondary" id="add-miembro" style="width:100%;margin-top:6px;">+ Agregar miembro</button>
      <div class="modal-actions">
        <button type="button" class="btn" id="cerrar-miembros">Cerrar</button>
      </div>
    `, {
      onMount: (root) => {
        root.querySelector('#cerrar-miembros').onclick = () => UI.closeModal();
        root.querySelector('#add-miembro').onclick = () => this.openMiembroForm(deudaId);
        const pagarSel = root.querySelector('#pagar-seleccionados');
        if (pagarSel) pagarSel.onclick = () => {
          const ids = [...root.querySelectorAll('[data-sel-miembro]:checked')].map(c => c.dataset.selMiembro);
          if (!ids.length) { UI.toast('Selecciona al menos un miembro', 'warn'); return; }
          this.openPagoMasivo(deudaId, { preseleccion: ids, alCerrar: () => { UI.closeModal(); this.openMiembros(deudaId); } });
        };
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

  // Lo que debe hoy un miembro (deuda acumulada) o, si está al día, una cuota.
  montoSugeridoMiembro(m, deuda) {
    const debe = this.ciclosTranscurridosMiembro(m, deuda) * m.montoMensual - this.totalPagadoMiembro(m);
    return debe > 0 ? debe : Number(m.montoMensual) || 0;
  },

  // Registra el pago de varios miembros de una vez. `preseleccion`: ids marcados al abrir
  // (por defecto, todos los pendientes). Muestra los movimientos que se crearán.
  openPagoMasivo(deudaId, { preseleccion, fecha, alCerrar } = {}) {
    const deuda = Storage.find('deudas', deudaId);
    const candidatos = this.miembrosDe(deudaId).filter(m => m.activo && !String(m.id).startsWith('tmp_'));
    if (!candidatos.length) { UI.toast('No hay miembros activos para registrar', 'warn'); return; }
    const pendientes = new Set(candidatos.filter(m => !this.pagadoEsteCicloMiembro(m, deuda)).map(m => String(m.id)));
    const marcados = new Set((preseleccion || [...pendientes]).map(String));
    const cuentas = Storage.get('cuentas');
    const cuentaOpts = cuentas.map(c => ({ value: c.id, label: accountLabel(c) }));
    const cerrar = alCerrar || (() => UI.closeModal());

    UI.openModal(`Pagos de miembros — ${escapeHtml(deuda.nombre)}`, `
      <form id="pago-masivo-form">
        <p class="text-dim mt-0">Marca quiénes pagaron. Puedes ajustar el monto de cada uno.</p>
        ${candidatos.map(m => `
          <div class="form-row" style="display:flex;align-items:center;gap:10px;">
            <input type="checkbox" name="sel" value="${m.id}" id="pmas-${m.id}" ${marcados.has(String(m.id)) ? 'checked' : ''}>
            <label for="pmas-${m.id}" style="margin:0;flex:1;">${escapeHtml(m.nombre)}${pendientes.has(String(m.id)) ? '' : ' <span class="pill pos">al día</span>'}</label>
            <div style="width:140px;">${UI.moneyInputHTML('monto_' + m.id, Math.round(this.montoSugeridoMiembro(m, deuda)), { chips: [] })}</div>
          </div>`).join('')}
        <div class="form-row checkbox-row">
          <input type="checkbox" name="soloRegistro" id="pmas-solo" ${cuentaOpts.length ? '' : 'checked disabled'}>
          <label for="pmas-solo" style="margin:0;">Ya está reflejado en mi saldo (no crear ingresos)</label>
        </div>
        <div class="form-row" id="pmas-cuenta-row" ${cuentaOpts.length ? '' : 'style="display:none;"'}>
          <label>¿A qué cuenta llegaron los pagos?</label>
          ${cuentaOpts.length ? UI.selectHTML('cuentaId', cuentaOpts, cuentaOpts[0].value, { id: 'pmas-cuenta' }) : ''}
        </div>
        <div class="form-row">
          <label>Fecha</label>
          <input type="date" name="fecha" value="${fecha || todayISO()}">
        </div>
        <div class="card" style="margin:8px 0;"><p class="card-title" style="margin-top:0;">Movimientos a registrar</p><div id="pmas-resumen"></div></div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">No, cerrar</button>
          <button type="submit" class="btn" id="pmas-ok">Registrar pagos</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        UI.initSelects(root);
        UI.initMoneyInputs(root);
        const form = root.querySelector('#pago-masivo-form');
        const solo = root.querySelector('#pmas-solo');
        const cuentaRow = root.querySelector('#pmas-cuenta-row');

        const leer = () => {
          const fd = new FormData(form);
          const ids = new Set(fd.getAll('sel').map(String));
          const items = candidatos.filter(m => ids.has(String(m.id)))
            .map(m => ({ m, monto: parseFloat(fd.get('monto_' + m.id)) || 0 }));
          const soloRegistro = solo.checked;
          const cuenta = soloRegistro ? null : Storage.find('cuentas', fd.get('cuentaId'));
          return { items, soloRegistro, cuenta, fecha: fd.get('fecha') || todayISO() };
        };

        const resumen = () => {
          const { items, soloRegistro, cuenta } = leer();
          const total = items.reduce((s, i) => s + i.monto, 0);
          const destino = soloRegistro ? 'solo registro (sin tocar saldo)' : `ingreso a ${escapeHtml(cuenta?.nombre || '')}`;
          root.querySelector('#pmas-resumen').innerHTML = items.length
            ? items.map(i => `<div class="stat-sub">${escapeHtml(i.m.nombre)}: ${formatMoney(i.monto, deuda.moneda)} — ${destino}${i.monto <= 0 ? ' <span class="pill neg">monto inválido</span>' : ''}</div>`).join('')
              + `<div class="stat-sub"><strong>Total: ${formatMoney(total, deuda.moneda)}</strong></div>`
            : '<div class="stat-sub">Ningún miembro seleccionado.</div>';
          root.querySelector('#pmas-ok').disabled = !items.length || items.some(i => i.monto <= 0);
        };

        solo.addEventListener('change', () => { cuentaRow.style.display = solo.checked ? 'none' : ''; resumen(); });
        form.addEventListener('input', resumen);
        form.addEventListener('change', resumen);
        resumen();

        root.querySelector('#cancel-btn').onclick = cerrar;
        form.onsubmit = async (e) => {
          e.preventDefault();
          const { items, soloRegistro, cuenta, fecha: f } = leer();
          if (!items.length || items.some(i => i.monto <= 0)) return;
          if (!soloRegistro && !cuenta) { UI.toast('Elige una cuenta', 'warn'); return; }
          if (!UI.guardSubmit(e)) return;
          UI.closeModal();
          UI.toast(`Registrando ${items.length} pago(s)...`);

          // En serie: así un fallo no deja los demás a medias y se sabe exactamente cuál falló.
          const fallidos = [];
          for (const { m, monto } of items) {
            try {
              await Storage.pagoMiembro(m.id, { monto, cuentaId: cuenta?.id ?? null, fecha: f, soloRegistro });
            } catch (err) {
              fallidos.push(`${m.nombre} (${err.message})`);
            }
          }
          await Storage.initFromServer().catch(() => {});
          DeudasView.render();
          CuentasView.render();
          TransaccionesView.render();
          if (typeof DashboardView !== 'undefined') DashboardView.render();
          if (fallidos.length) UI.toast('No se registraron: ' + fallidos.join(', '), 'danger');
          else UI.toast(`${items.length} pago(s) de miembros registrados`);
        };
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
          if (!UI.guardSubmit(e)) return;
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

    const totalPagado = this.totalPagadoMiembro(miembro);
    const ciclos = this.ciclosTranscurridosMiembro(miembro, deuda);
    const totalEsperado = ciclos * miembro.montoMensual;
    const balance = totalPagado - totalEsperado;
    const debeVarios = balance < 0 && Math.abs(balance) > miembro.montoMensual;
    const mesesDebe = debeVarios ? Math.ceil(Math.abs(balance) / miembro.montoMensual) : 0;
    const montoSugerido = balance < 0 ? Math.abs(balance) : miembro.montoMensual;

    UI.openModal(`Pago de ${escapeHtml(miembro.nombre)}`, `
      <form id="pago-miembro-form">
        <p class="text-dim mt-0">${escapeHtml(deuda.nombre)} — cuota: ${formatMoney(miembro.montoMensual, deuda.moneda)}</p>
        ${debeVarios ? `<p class="stat-sub" style="margin:0 0 10px;"><span class="pill neg">Debe ${formatMoney(Math.abs(balance), deuda.moneda)} — ${mesesDebe} mes${mesesDebe > 1 ? 'es' : ''} sin pagar</span></p>` : ''}
        <div class="form-row">
          <label>¿Cuánto pagó?</label>
          ${UI.moneyInputHTML('monto', montoSugerido, { required: true })}
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
          if (!UI.guardSubmit(e)) return;
          const fd = new FormData(e.target);
          const monto = parseFloat(fd.get('monto'));
          const soloRegistro = fd.get('soloRegistro') === 'on';
          const cuentaId = soloRegistro ? null : fd.get('cuentaId');
          const fecha = fd.get('fecha') || todayISO();
          const cuenta = soloRegistro ? null : Storage.find('cuentas', cuentaId);

          // Optimista: refleja el pago (y el ingreso, salvo que ya esté contado) de inmediato.
          const pagoOptimista = { monto, cuentaId, fecha };
          miembro.pagos = [...(miembro.pagos || []), pagoOptimista];
          if (cuenta) cuenta.saldo += monto;

          Storage.pagoMiembro(miembroId, { monto, cuentaId, fecha, soloRegistro }).then(() => {
            // Refresca desde el servidor (y el ingreso auto-generado en Transacciones).
            Storage.initFromServer().then(() => {
              DeudasView.render();
              if (!soloRegistro) {
                TransaccionesView.render();
                if (typeof DashboardView !== 'undefined') DashboardView.render();
              }
            });
          }).catch(err => {
            miembro.pagos = (miembro.pagos || []).filter(p => p !== pagoOptimista);
            if (cuenta) cuenta.saldo -= monto;
            DeudasView.render();
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
          if (!UI.guardSubmit(e)) return;
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
