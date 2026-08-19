const App = {
  currentView: 'dashboard',

  views: {
    dashboard: { title: 'Resumen', renderer: () => DashboardView.render() },
    cuentas: { title: 'Cuentas', renderer: () => CuentasView.render() },
    transacciones: { title: 'Transacciones', renderer: () => TransaccionesView.render() },
    metas: { title: 'Metas de Ahorro', renderer: () => MetasView.render() },
    prestamos: { title: 'Préstamos', renderer: () => PrestamosView.render() },
    deudas: { title: 'Deudas y Suscripciones', renderer: () => DeudasView.render() },
    ajustes: { title: 'Ajustes', renderer: () => AjustesView.render() }
  },

  init() {
    Storage.load();
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.view));
    });
    this.renderCurrentView();
    setTimeout(() => DeudasView.checkReminders(), 600);
    ExchangeRate.refreshIfNeeded();
  },

  navigate(view) {
    this.currentView = view;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    document.getElementById('view-title').textContent = this.views[view].title;
    this.renderCurrentView();
  },

  renderCurrentView() {
    this.views[this.currentView].renderer();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
