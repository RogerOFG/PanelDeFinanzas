const AjustesView = {
  render() {
    const container = document.getElementById('view-ajustes');
    const config = Storage.get('config');

    container.innerHTML = `
      <div class="grid cols-2">
        <div class="card">
          <p class="card-title">Tasa de cambio USD → COP</p>
          <div class="form-row checkbox-row">
            <input type="checkbox" id="chk-auto" ${config.tasaCambioAuto ? 'checked' : ''}>
            <label for="chk-auto" style="margin:0;">Actualizar automáticamente en línea</label>
          </div>
          <div class="form-row">
            <label>1 USD equivale a (COP)</label>
            <input type="number" id="tasa-cambio" value="${config.tasaCambio}" step="1" ${config.tasaCambioAuto ? 'disabled' : ''}>
          </div>
          <p class="text-dim" style="font-size:12px;margin:0 0 10px;">
            ${config.tasaCambioAuto
              ? (config.tasaCambioActualizada
                  ? `Última actualización automática: ${new Date(config.tasaCambioActualizada).toLocaleString('es-CO')}`
                  : 'Aún no se ha sincronizado. Se hará al conectar a internet.')
              : 'Modo manual: ingresa tú la tasa.'}
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn secondary" id="refresh-tasa">🔄 Actualizar ahora</button>
            <button class="btn" id="save-tasa" ${config.tasaCambioAuto ? 'disabled' : ''}>Guardar tasa manual</button>
          </div>
        </div>
        <div class="card">
          <p class="card-title">Datos</p>
          <p class="text-dim" style="font-size:13px;">Tus datos se guardan localmente en este navegador (localStorage). Exporta un respaldo periódicamente.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
            <button class="btn secondary" id="export-btn">Exportar respaldo (JSON)</button>
            <button class="btn secondary" id="import-btn">Importar respaldo</button>
            <input type="file" id="import-file" accept="application/json" style="display:none;">
            <button class="btn danger" id="reset-btn">Borrar todos los datos</button>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#save-tasa').onclick = () => {
      const tasa = parseFloat(container.querySelector('#tasa-cambio').value) || config.tasaCambio;
      Storage.setConfig({ tasaCambio: tasa });
      UI.toast('Tasa de cambio actualizada');
      if (typeof DashboardView !== 'undefined') DashboardView.render();
    };

    container.querySelector('#chk-auto').onchange = (e) => {
      Storage.setConfig({ tasaCambioAuto: e.target.checked });
      if (e.target.checked) ExchangeRate.refreshIfNeeded(true);
      this.render();
    };

    container.querySelector('#refresh-tasa').onclick = async () => {
      const btn = container.querySelector('#refresh-tasa');
      btn.disabled = true;
      btn.textContent = 'Actualizando…';
      const rate = await ExchangeRate.refreshIfNeeded(true);
      if (rate) UI.toast(`Tasa actualizada: 1 USD = ${formatMoney(rate, 'COP')}`);
      this.render();
    };

    container.querySelector('#export-btn').onclick = () => {
      const blob = new Blob([Storage.exportJSON()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finbot-backup-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      UI.toast('Respaldo descargado');
    };

    const fileInput = container.querySelector('#import-file');
    container.querySelector('#import-btn').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Storage.importJSON(reader.result);
          UI.toast('Datos importados correctamente');
          App.renderCurrentView();
        } catch (err) {
          UI.toast('Archivo inválido', 'danger');
        }
      };
      reader.readAsText(file);
    };

    container.querySelector('#reset-btn').onclick = () => {
      UI.confirmAction('Esto borrará TODOS tus datos (cuentas, transacciones, metas, préstamos, deudas). ¿Continuar?', () => {
        Storage.resetAll();
        UI.toast('Datos borrados');
        App.renderCurrentView();
      });
    };
  }
};
