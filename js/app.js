const App = {
  currentView: 'dashboard',
  moreViews: ['prestamos', 'deudas', 'tarjetas', 'historial', 'ajustes'],

  views: {
    dashboard: { title: 'Resumen', renderer: () => DashboardView.render(), skeleton: () => DashboardView.renderSkeleton() },
    cuentas: { title: 'Cuentas', renderer: () => CuentasView.render(), skeleton: () => CuentasView.renderSkeleton() },
    transacciones: { title: 'Transacciones', renderer: () => TransaccionesView.render(), skeleton: () => TransaccionesView.renderSkeleton() },
    metas: { title: 'Metas de Ahorro', renderer: () => MetasView.render(), skeleton: () => MetasView.renderSkeleton() },
    prestamos: { title: 'Préstamos', renderer: () => PrestamosView.render(), skeleton: () => PrestamosView.renderSkeleton() },
    deudas: { title: 'Deudas y Suscripciones', renderer: () => DeudasView.render(), skeleton: () => DeudasView.renderSkeleton() },
    tarjetas: { title: 'Tarjetas de Crédito', renderer: () => TarjetasView.render(), skeleton: () => TarjetasView.renderSkeleton() },
    historial: { title: 'Historial mensual', renderer: () => HistorialView.render(), skeleton: () => HistorialView.renderSkeleton() },
    ajustes: { title: 'Ajustes', renderer: () => AjustesView.render(), skeleton: () => AjustesView.renderSkeleton() }
  },

  async init() {
    const savedView = localStorage.getItem('finbot_last_view');
    this.currentView = (savedView && this.views[savedView]) ? savedView : 'dashboard';
    this.activateView(this.currentView);
    this.views[this.currentView].skeleton();

    try {
      await Storage.initFromServer();
    } catch (e) {
      UI.toast('No se pudo conectar con el servidor: ' + e.message, 'danger');
      return;
    }
    document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.view));
    });
    document.getElementById('nav-more-btn').addEventListener('click', () => this.openMore());
    document.getElementById('notif-btn').addEventListener('click', () => this.openNotifications());

    this.renderCurrentView();
    this.updateNotifDot();
    setTimeout(() => DeudasView.checkReminders(), 600);
    ExchangeRate.refreshIfNeeded();
  },

  pendingReminders() {
    const deudas = Storage.get('deudas').filter(d => d.activa && !DeudasView.pagadoEsteCiclo(d));
    const hoy = todayISO();
    return deudas.map(d => {
      const inicio = DeudasView.cicloInicio(d.diaPago);
      const vencido = inicio < hoy;
      if (vencido) return { ...d, prox: inicio, dias: daysUntil(inicio), vencido: true };
      const prox = DeudasView.proximoPago(d.diaPago);
      return { ...d, prox, dias: daysUntil(prox), vencido: false };
    })
      .filter(d => d.vencido || (d.dias !== null && d.dias >= 0 && d.dias <= (d.recordatorioDias ?? 3)))
      .sort((a, b) => a.dias - b.dias);
  },

  updateNotifDot() {
    const dot = document.getElementById('notif-dot');
    const hayMiembros = DeudasView.pendingMemberReminders().length > 0;
    dot.hidden = this.pendingReminders().length === 0 && !hayMiembros;
  },

  openNotifications() {
    const pendientes = this.pendingReminders();
    const miembrosPendientes = DeudasView.pendingMemberReminders();
    UI.openModal('Notificaciones', `
      <div class="more-menu">
        ${pendientes.map(d => `
          <div class="notif-item" data-ir-deuda="${d.id}" style="cursor:pointer;">
            <span class="notif-icon ${d.vencido || d.dias === 0 ? 'danger' : 'warn'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>
            </span>
            <div>
              <div class="notif-title">${d.vencido ? `${escapeHtml(d.nombre)} — atrasado ${Math.abs(d.dias)} día(s)` : `${escapeHtml(d.nombre)} vence ${d.dias === 0 ? 'hoy' : `en ${d.dias} día(s)`}`}</div>
              <div class="notif-sub">${formatMoney(d.monto, d.moneda)} · ${formatDate(d.prox)}</div>
            </div>
          </div>
        `).join('')}
        ${miembrosPendientes.map(r => `
          <div class="notif-item" data-ir-miembro="${r.miembro.id}" data-ir-deuda="${r.deuda.id}" style="cursor:pointer;">
            <span class="notif-icon ${r.vencido || r.dias <= 0 ? 'danger' : 'warn'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0116 0v1"/></svg>
            </span>
            <div>
              <div class="notif-title">Falta marcar el pago de ${escapeHtml(r.miembro.nombre)}${r.vencido ? ' (atrasado)' : ''}</div>
              <div class="notif-sub">${escapeHtml(r.deuda.nombre)} · ${formatMoney(r.miembro.montoMensual, r.deuda.moneda)}</div>
            </div>
          </div>
        `).join('')}
        ${(pendientes.length === 0 && miembrosPendientes.length === 0) ? '<div class="empty-state">No tienes notificaciones pendientes.</div>' : ''}
      </div>
    `, {
      onMount: (root) => {
        const irADeuda = (deudaId) => {
          UI.closeModal();
          this.currentView = 'deudas';
          localStorage.setItem('finbot_last_view', 'deudas');
          DeudasView.detalleId = deudaId;
          this.activateView('deudas');
          this.renderCurrentView();
        };
        root.querySelectorAll('[data-ir-miembro]').forEach(el => {
          el.onclick = () => {
            irADeuda(el.dataset.irDeuda);
            DeudasView.openPagoMiembro(el.dataset.irMiembro);
          };
        });
        root.querySelectorAll('[data-ir-deuda]:not([data-ir-miembro])').forEach(el => {
          el.onclick = () => irADeuda(el.dataset.irDeuda);
        });
      }
    });
  },

  navigate(view) {
    this.currentView = view;
    localStorage.setItem('finbot_last_view', view);
    if (view === 'deudas' && typeof DeudasView !== 'undefined') DeudasView.detalleId = null;
    if (view === 'historial' && typeof HistorialView !== 'undefined') HistorialView.detalleYm = null;
    this.activateView(view);
    this.renderCurrentView();
  },

  activateView(view) {
    document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.getElementById('nav-more-btn').classList.toggle('active', this.moreViews.includes(view));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    document.getElementById('view-title').textContent = this.views[view].title;
  },

  openMore() {
    const icons = {
      prestamos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8l4 4-4 4M7 8l-4 4 4 4"/><path d="M3 12h18"/></svg>',
      deudas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg>',
      tarjetas: ICON_CARD,
      historial: ICON_CALENDAR,
      ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.13.31.2.65.2 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>'
    };
    UI.openModal('Más opciones', `
      <div class="more-menu">
        ${this.moreViews.map(v => `
          <button class="more-menu-item" data-view="${v}">
            <span class="more-menu-icon">${icons[v]}</span>
            <span>${this.views[v].title}</span>
          </button>
        `).join('')}
      </div>
    `, {
      onMount: (root) => {
        root.querySelectorAll('.more-menu-item').forEach(btn => {
          btn.addEventListener('click', () => {
            this.navigate(btn.dataset.view);
            UI.closeModal();
          });
        });
      }
    });
  },

  renderCurrentView() {
    this.views[this.currentView].renderer();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Auth.init(() => App.init());
});
