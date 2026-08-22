// Mantiene la tasa USD -> COP actualizada automáticamente contra la TRM oficial
// (Superintendencia Financiera de Colombia, vía datos.gov.co), cacheando el
// resultado en Storage para no requerir conexión en cada carga.
const ExchangeRate = {
  API_URL: 'https://www.datos.gov.co/resource/mcec-87by.json?$order=vigenciadesde%20DESC&$limit=1',

  async refreshIfNeeded(force = false) {
    const config = Storage.get('config');
    if (!config.tasaCambioAuto && !force) return;

    const lastUpdate = config.tasaCambioActualizada;
    const staleMs = 12 * 60 * 60 * 1000; // refresca cada 12 horas
    if (!force && lastUpdate && (Date.now() - new Date(lastUpdate).getTime()) < staleMs) {
      return;
    }

    try {
      const res = await fetch(this.API_URL);
      if (!res.ok) throw new Error('Respuesta no OK: ' + res.status);
      const data = await res.json();
      const cop = parseFloat(data?.[0]?.valor);
      if (!cop || isNaN(cop)) throw new Error('TRM no encontrada en la respuesta');

      Storage.setConfig({ tasaCambio: cop, tasaCambioActualizada: new Date().toISOString() });
      if (typeof DashboardView !== 'undefined') DashboardView.render();
      if (typeof AjustesView !== 'undefined' && App.currentView === 'ajustes') AjustesView.render();
      return cop;
    } catch (e) {
      console.warn('No se pudo actualizar la tasa de cambio automáticamente:', e);
      if (force) UI.toast('No se pudo obtener la tasa en línea. Se mantiene la última conocida.', 'warn');
      return null;
    }
  }
};
