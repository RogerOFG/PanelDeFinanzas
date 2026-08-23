const CUOTA_MANEJO_MODOS = {
  siempre: 'se cobra siempre',
  solo_si_usa: 'solo si hay compras ese mes',
  nunca: 'nunca se cobra'
};

const TarjetasView = {
  detalleId: null,

  renderSkeleton() {
    const container = document.getElementById('view-tarjetas');
    const itemSkeleton = `
      <div class="debt-item">
        <div class="debt-item-top">
          <div class="skeleton" style="width:44px;height:44px;border-radius:13px;flex-shrink:0;"></div>
          <div class="debt-item-body">
            <div class="skeleton skeleton-line" style="width:60%;margin-bottom:8px;"></div>
            <div class="skeleton skeleton-line" style="width:50%;margin-bottom:6px;"></div>
            <div class="skeleton skeleton-line" style="width:70%;"></div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div class="skeleton skeleton-line" style="width:70px;margin-bottom:6px;margin-left:auto;"></div>
            <div class="skeleton skeleton-line" style="width:50px;height:16px;border-radius:999px;margin-left:auto;"></div>
          </div>
        </div>
      </div>`;
    container.innerHTML = `
      <div class="hero-card-debt" style="margin-bottom:18px;">
        <div class="hero-card-left">
          <div class="skeleton skeleton-line" style="width:170px;margin-bottom:10px;"></div>
          <div class="skeleton skeleton-line xl" style="width:180px;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-line" style="width:120px;"></div>
        </div>
        <div class="skeleton" style="width:70px;height:70px;border-radius:28px;"></div>
      </div>
      <div class="section-header">
        <div class="skeleton skeleton-line" style="width:110px;"></div>
        <div class="skeleton skeleton-line" style="width:80px;"></div>
      </div>
      <div class="debt-list">${itemSkeleton}${itemSkeleton}</div>
    `;
  },

  render() {
    if (this.detalleId && Storage.find('tarjetas', this.detalleId)) {
      this.renderDetalle(this.detalleId);
    } else {
      this.detalleId = null;
      this.renderLista();
    }
  },

  // Próxima fecha de corte a partir de hoy.
  proximoCorte(diaCorte) {
    const now = new Date();
    let candidate = new Date(now.getFullYear(), now.getMonth(), diaCorte);
    if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      candidate = new Date(now.getFullYear(), now.getMonth() + 1, diaCorte);
    }
    return dateToISOLocal(candidate);
  },

  cicloInicio(diaCorte) {
    const now = new Date();
    let due = new Date(now.getFullYear(), now.getMonth(), diaCorte);
    if (due > now) due = new Date(now.getFullYear(), now.getMonth() - 1, diaCorte);
    return dateToISOLocal(due);
  },

  pagadoEsteCiclo(tarjeta) {
    const inicio = this.cicloInicio(tarjeta.diaCorte);
    return (tarjeta.historialPagos || []).some(p => p.fecha >= inicio);
  },

  comprasPendientes(tarjeta) {
    return (tarjeta.compras || []).filter(c => c.cuotasPagadas < c.cuotas);
  },

  cobraManejoEsteCorte(tarjeta) {
    const modo = tarjeta.cuotaManejoModo || 'siempre';
    if (modo === 'nunca') return false;
    if (modo === 'solo_si_usa') return this.comprasPendientes(tarjeta).length > 0;
    return true;
  },

  totalPorPagar(tarjeta) {
    const cuotaManejo = this.cobraManejoEsteCorte(tarjeta) ? (parseFloat(tarjeta.cuotaManejo) || 0) : 0;
    const cuotas = this.comprasPendientes(tarjeta).reduce((sum, c) => sum + c.montoTotal / c.cuotas, 0);
    return Math.round(cuotaManejo + cuotas);
  },

  renderLista() {
    const container = document.getElementById('view-tarjetas');
    const tarjetas = Storage.get('tarjetas').slice().sort((a, b) => (a.diaCorte || 31) - (b.diaCorte || 31));

    if (tarjetas.length === 0) {
      container.innerHTML = `
        <div class="empty-state card">
          <p>No tienes tarjetas de crédito registradas.</p>
          <button class="btn" id="add-tarjeta-empty">+ Agregar</button>
        </div>`;
      container.querySelector('#add-tarjeta-empty').onclick = () => this.openForm();
      return;
    }

    const totalMensual = tarjetas.filter(t => t.activa).reduce((sum, t) => sum + this.totalPorPagar(t), 0);

    const fila = (t) => {
      const prox = this.proximoCorte(t.diaCorte);
      const dias = daysUntil(prox);
      const pagado = this.pagadoEsteCiclo(t);
      const total = this.totalPorPagar(t);
      const estado = !t.activa ? { label: 'Inactiva', cls: 'tipo' }
        : pagado ? { label: 'Pagado', cls: 'pos' }
        : dias !== null && dias <= 3 ? { label: 'Corte próximo', cls: 'warn' }
        : { label: 'Al día', cls: 'tipo' };
      return `
        <div class="debt-item" data-abrir="${t.id}">
          <div class="debt-item-top">
            <div class="debt-icon" style="background:color-mix(in srgb, var(--accent-2) 16%, transparent);color:var(--accent-2);">${ICON_CARD}</div>
            <div class="debt-item-body">
              <div class="debt-item-name">${escapeHtml(t.nombre)}</div>
              <div class="debt-item-sub">Corte: día ${t.diaCorte} de cada mes</div>
              <div class="debt-item-sub">${this.comprasPendientes(t).length} compra(s) con saldo pendiente</div>
            </div>
            <div class="debt-item-right">
              <div class="debt-item-amount">${formatMoney(total, t.moneda)}</div>
              <span class="pill ${estado.cls}" style="margin-top:6px;display:inline-block;">${estado.label}</span>
            </div>
            <span class="debt-item-chevron">${ICON_CHEVRON}</span>
          </div>
        </div>`;
    };

    container.innerHTML = `
      <div class="hero-card-debt">
        <div class="hero-card-left">
          <div class="hero-label">Total por pagar este mes</div>
          <div class="hero-value" data-count="${totalMensual}" data-count-currency="COP">${formatMoney(0, 'COP')}</div>
          <div class="hero-sub">${tarjetas.filter(t => t.activa).length} tarjeta(s) activa(s)</div>
        </div>
        <div class="hero-icon-badge">
          ${ICON_CARD}
        </div>
      </div>

      <div class="section-header">
        <span class="section-title">Tus tarjetas</span>
        <button class="link-btn" id="add-tarjeta-btn">+ Agregar</button>
      </div>

      <div class="debt-list">${tarjetas.map(fila).join('')}</div>
    `;

    container.querySelector('#add-tarjeta-btn').onclick = () => this.openForm();
    container.querySelectorAll('[data-abrir]').forEach(el => {
      el.onclick = () => { this.detalleId = el.dataset.abrir; this.render(); };
    });

    if (typeof animateCounters === 'function') animateCounters(container);
  },

  renderDetalle(id) {
    const t = Storage.find('tarjetas', id);
    const container = document.getElementById('view-tarjetas');
    const total = this.totalPorPagar(t);
    const prox = this.proximoCorte(t.diaCorte);
    const dias = daysUntil(prox);
    const pagado = this.pagadoEsteCiclo(t);

    const filaCompra = (c) => {
      const porCuota = c.montoTotal / c.cuotas;
      const completa = c.cuotasPagadas >= c.cuotas;
      return `
        <div class="detail-row">
          <div class="detail-row-label">
            ${ICON_NOTE}
            <div>
              <div>${escapeHtml(c.descripcion)}${c.tieneIntereses ? ' <span class="pill warn">Con intereses</span>' : ''}</div>
              <div class="text-dim" style="font-size:11px;margin-top:2px;">${formatDate(c.fecha)} · ${formatMoney(porCuota, t.moneda)}/cuota</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div class="detail-row-value">${formatMoney(c.montoTotal, t.moneda)}</div>
            <span class="pill ${completa ? 'pos' : 'tipo'}" style="margin-top:4px;display:inline-block;">${c.cuotasPagadas}/${c.cuotas} cuotas</span>
            ${c.cuotasPagadas === 0 ? `<button class="btn secondary small" style="margin-top:6px;" data-borrar-compra="${c.id}">${ICON_TRASH}</button>` : ''}
          </div>
        </div>`;
    };

    container.innerHTML = `
      <div class="detail-topbar">
        <button class="icon-btn" id="detalle-back">${ICON_BACK}</button>
        <div class="detail-topbar-title">Detalle de tarjeta</div>
        <button class="icon-btn" id="detalle-editar">${ICON_EDIT}</button>
      </div>

      <div class="detail-header-card">
        <div class="detail-header-icon" style="background:color-mix(in srgb, var(--accent-2) 16%, transparent);color:var(--accent-2);">${ICON_CARD}</div>
        <div style="flex:1;">
          <div class="detail-header-name">${escapeHtml(t.nombre)}</div>
          <div class="detail-header-price">${formatMoney(total, t.moneda)} <span class="text-dim" style="font-size:12px;font-weight:400;">${pagado ? 'próxima cuota mensual' : 'por pagar este corte'}</span></div>
          <span class="pill ${pagado ? 'pos' : (dias !== null && dias <= 3 ? 'warn' : 'tipo')}">${pagado ? 'Pagado' : dias === 0 ? 'Corte hoy' : `Corte en ${dias} día(s)`}</span>
        </div>
      </div>

      <div class="card" style="margin-bottom:18px;">
        <div class="detail-row"><div class="detail-row-label">${ICON_CALENDAR}Día de corte</div><div class="detail-row-value">${t.diaCorte} de cada mes</div></div>
        ${t.cupo ? `<div class="detail-row"><div class="detail-row-label">${ICON_STATUS}Cupo mensual</div><div class="detail-row-value">${formatMoney(t.cupo, t.moneda)}</div></div>` : ''}
        <div class="detail-row"><div class="detail-row-label">${ICON_CLOCK}Cuota de manejo</div><div class="detail-row-value">${t.cuotaManejo ? `${formatMoney(t.cuotaManejo, t.moneda)} · ${CUOTA_MANEJO_MODOS[t.cuotaManejoModo || 'siempre']}` : 'No tiene'}</div></div>
        ${t.notas ? `<div class="detail-row"><div class="detail-row-label">${ICON_NOTE}Notas</div><div class="detail-row-value">${escapeHtml(t.notas)}</div></div>` : ''}
      </div>

      <div class="section-header">
        <span class="section-title">Compras</span>
        <button class="link-btn" id="add-compra-btn">+ Registrar compra</button>
      </div>
      ${(t.compras || []).length ? `<div class="card" style="margin-bottom:18px;">${(t.compras || []).map(filaCompra).join('')}</div>` : '<div class="empty-state card" style="margin-bottom:18px;">Sin compras registradas.</div>'}

      <button class="btn ${pagado ? 'secondary' : ''}" ${pagado || total <= 0 ? 'disabled' : ''} id="pagar-btn" style="width:100%;margin-bottom:18px;">
        ${pagado ? 'Ya pagado este corte' : total <= 0 ? 'Nada pendiente por pagar' : `Pagar extracto — ${formatMoney(total, t.moneda)}`}
      </button>

      ${(t.historialPagos || []).length ? `
        <div class="section-header"><span class="section-title">Historial de pagos</span></div>
        <div class="card">
          ${t.historialPagos.slice().reverse().map(p => `
            <div class="detail-row"><div class="detail-row-label">${ICON_CHECK}${formatDate(p.fecha)}</div><div class="detail-row-value">${formatMoney(p.monto, t.moneda)}</div></div>
          `).join('')}
        </div>` : ''}
    `;

    container.querySelector('#detalle-back').onclick = () => { this.detalleId = null; this.render(); };
    container.querySelector('#detalle-editar').onclick = () => this.openForm(t);
    container.querySelector('#add-compra-btn').onclick = () => this.openCompraForm(t);
    container.querySelectorAll('[data-borrar-compra]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this.eliminarCompra(t, btn.dataset.borrarCompra);
      };
    });
    const pagarBtn = container.querySelector('#pagar-btn');
    if (!pagarBtn.disabled) pagarBtn.onclick = () => this.openPagoForm(t);
  },

  openForm(tarjeta) {
    const esEdicion = !!tarjeta;
    UI.openModal(esEdicion ? 'Editar tarjeta' : 'Nueva tarjeta de crédito', `
      <form id="tarjeta-form">
        <div class="form-row">
          <label>Nombre</label>
          <input type="text" name="nombre" required value="${escapeHtml(tarjeta?.nombre || '')}" placeholder="Ej: Tarjeta Visa Bancolombia">
        </div>
        <div class="form-row">
          <label>Moneda</label>
          ${UI.selectHTML('moneda', [{ value: 'COP', label: 'COP' }, { value: 'USD', label: 'USD' }], tarjeta?.moneda || 'COP', { id: 'tj-moneda' })}
        </div>
        <div class="form-row">
          <label>Día de corte (1-31)</label>
          <input type="number" name="diaCorte" min="1" max="31" required value="${tarjeta?.diaCorte ?? ''}">
        </div>
        <div class="form-row">
          <label>Cupo mensual (opcional)</label>
          ${UI.moneyInputHTML('cupo', tarjeta?.cupo ?? '', {})}
        </div>
        <div class="form-row">
          <label>Cuota de manejo (deja en 0 si no tiene)</label>
          ${UI.moneyInputHTML('cuotaManejo', tarjeta?.cuotaManejo ?? 0, {})}
        </div>
        <div class="form-row">
          <label>¿Cuándo se cobra la cuota de manejo?</label>
          ${UI.selectHTML('cuotaManejoModo', [
            { value: 'siempre', label: 'Siempre, la use o no' },
            { value: 'solo_si_usa', label: 'Solo si hago compras ese mes' },
            { value: 'nunca', label: 'Nunca' }
          ], tarjeta?.cuotaManejoModo || 'siempre', { id: 'tj-manejo-modo' })}
        </div>
        <div class="form-row">
          <label>Notas (opcional)</label>
          <input type="text" name="notas" value="${escapeHtml(tarjeta?.notas || '')}">
        </div>
        ${esEdicion ? `
        <div class="form-row checkbox-row">
          <input type="checkbox" name="activa" id="tj-activa" ${tarjeta.activa ? 'checked' : ''}>
          <label for="tj-activa" style="margin:0;">Tarjeta activa</label>
        </div>` : ''}
        <div class="modal-actions">
          ${esEdicion ? `<button type="button" class="btn danger" id="borrar-btn">Eliminar</button>` : ''}
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">Guardar</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        UI.initSelects(root);
        UI.initMoneyInputs(root);
        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        if (esEdicion) {
          root.querySelector('#borrar-btn').onclick = () => {
            UI.confirmAction(`¿Eliminar "${tarjeta.nombre}"? Se borrará también su historial de compras y pagos.`, () => {
              Storage.remove('tarjetas', tarjeta.id);
              UI.closeModal();
              this.detalleId = null;
              this.render();
              UI.toast('Tarjeta eliminada');
            });
          };
        }
        root.querySelector('#tarjeta-form').onsubmit = (e) => {
          e.preventDefault();
          if (!UI.guardSubmit(e)) return;
          const fd = new FormData(e.target);
          const data = {
            nombre: fd.get('nombre'),
            moneda: fd.get('moneda'),
            diaCorte: parseInt(fd.get('diaCorte'), 10),
            cupo: fd.get('cupo') ? parseFloat(fd.get('cupo')) : null,
            cuotaManejo: parseFloat(fd.get('cuotaManejo')) || 0,
            cuotaManejoModo: fd.get('cuotaManejoModo') || 'siempre',
            notas: fd.get('notas') || null
          };
          if (esEdicion) {
            data.activa = fd.get('activa') === 'on';
            Storage.update('tarjetas', tarjeta.id, data);
          } else {
            Storage.insert('tarjetas', { ...data, activa: true, compras: [], historialPagos: [] }, null, (created) => {
              this.detalleId = created.id;
              this.render();
            });
          }
          UI.closeModal();
          this.render();
          UI.toast(esEdicion ? 'Tarjeta actualizada' : 'Tarjeta agregada');
        };
      }
    });
  },

  openCompraForm(tarjeta) {
    UI.openModal(`Registrar compra — ${escapeHtml(tarjeta.nombre)}`, `
      <form id="compra-form">
        <div class="form-row">
          <label>Descripción</label>
          <input type="text" name="descripcion" required placeholder="Ej: Compra en tienda X">
        </div>
        <div class="form-row">
          <label>Monto total</label>
          ${UI.moneyInputHTML('montoTotal', '', { required: true })}
        </div>
        <div class="form-row">
          <label>Número de cuotas</label>
          <input type="number" name="cuotas" min="1" value="1" required>
        </div>
        <div class="form-row checkbox-row">
          <input type="checkbox" name="tieneIntereses" id="ct-intereses">
          <label for="ct-intereses" style="margin:0;">Tiene intereses (el monto total ya los incluye)</label>
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
      <p class="text-dim" style="font-size:12px;">Esta compra no se registra en Transacciones ni afecta tu saldo — solo queda pendiente de cobro para el día de corte.</p>
    `, {
      onMount: (root) => {
        UI.initMoneyInputs(root);
        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#compra-form').onsubmit = (e) => {
          e.preventDefault();
          if (!UI.guardSubmit(e)) return;
          const fd = new FormData(e.target);
          const compra = {
            descripcion: fd.get('descripcion'),
            montoTotal: parseFloat(fd.get('montoTotal')),
            cuotas: parseInt(fd.get('cuotas'), 10) || 1,
            tieneIntereses: fd.get('tieneIntereses') === 'on',
            fecha: fd.get('fecha') || todayISO()
          };
          Storage.agregarCompraTarjeta(tarjeta.id, compra).then((creada) => {
            tarjeta.compras = [creada, ...(tarjeta.compras || [])];
            this.render();
          }).catch(err => UI.toast('No se pudo registrar la compra: ' + err.message, 'danger'));
          UI.closeModal();
          UI.toast('Compra registrada');
        };
      }
    });
  },

  eliminarCompra(tarjeta, compraId) {
    UI.confirmAction('¿Eliminar esta compra?', () => {
      Storage.eliminarCompraTarjeta(compraId).then(() => {
        tarjeta.compras = (tarjeta.compras || []).filter(c => String(c.id) !== String(compraId));
        this.render();
        UI.toast('Compra eliminada');
      }).catch(err => UI.toast('No se pudo eliminar: ' + err.message, 'danger'));
    });
  },

  openPagoForm(tarjeta) {
    const cuentas = Storage.get('cuentas');
    const cuentaOpts = cuentas.map(c => ({ value: c.id, label: accountLabel(c) }));
    const total = this.totalPorPagar(tarjeta);

    UI.openModal(`Pagar extracto — ${escapeHtml(tarjeta.nombre)}`, `
      <form id="pago-tarjeta-form">
        <p class="text-dim mt-0">Total a pagar este corte: <strong style="color:var(--text);">${formatMoney(total, tarjeta.moneda)}</strong></p>
        <div class="form-row">
          <label>¿Con qué cuenta pagas?</label>
          ${UI.selectHTML('cuentaId', cuentaOpts, cuentaOpts[0]?.value, { id: 'pt-cuenta' })}
        </div>
        <div class="form-row">
          <label>Fecha</label>
          <input type="date" name="fecha" value="${todayISO()}">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="cancel-btn">Cancelar</button>
          <button type="submit" class="btn">Pagar</button>
        </div>
      </form>
    `, {
      onMount: (root) => {
        UI.initSelects(root);
        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#pago-tarjeta-form').onsubmit = (e) => {
          e.preventDefault();
          if (!UI.guardSubmit(e)) return;
          const fd = new FormData(e.target);
          const cuentaId = fd.get('cuentaId');
          const fecha = fd.get('fecha') || todayISO();

          Storage.pagoTarjeta(tarjeta.id, { cuentaId, fecha }).then(() => {
            Storage.initFromServer().then(() => {
              TransaccionesView.render();
              if (typeof DashboardView !== 'undefined') DashboardView.render();
              CuentasView.render();
              this.render();
            });
          }).catch(err => UI.toast('No se pudo registrar el pago: ' + err.message, 'danger'));

          UI.closeModal();
          UI.toast(`Pago de "${tarjeta.nombre}" registrado`);
        };
      }
    });
  }
};
