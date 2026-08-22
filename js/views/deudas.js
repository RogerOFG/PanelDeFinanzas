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
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            ${d.activa ? (pagadoEsteCiclo
              ? `<button class="${pagoBtnClass}" disabled>Ya pagado este mes</button>`
              : `<button class="${pagoBtnClass}" data-pagar="${d.id}">Marcar pago de este mes</button>`
            ) : ''}
            <button class="btn small secondary" data-miembros="${d.id}">👥 Miembros (${this.miembrosDe(d.id).length})${this.miembrosConDeuda(d).length ? ` · ${this.miembrosConDeuda(d).length} debe(n)` : ''}</button>
          </div>
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
    container.querySelectorAll('[data-miembros]').forEach(b => b.onclick = () => this.openMiembros(b.dataset.miembros));
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
          ${UI.moneyInputHTML('monto', deuda.monto ?? '', { required: true })}
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
