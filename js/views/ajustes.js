const AjustesView = {
  renderSkeleton() {
    const container = document.getElementById('view-ajustes');
    container.innerHTML = `
      <div class="grid cols-1">
        <div class="card">
          <div class="skeleton skeleton-line" style="width:190px;margin-bottom:16px;"></div>
          <div class="skeleton" style="height:20px;width:70%;margin-bottom:16px;"></div>
          <div class="skeleton" style="height:44px;border-radius:10px;margin-bottom:16px;"></div>
          <div class="skeleton skeleton-line" style="width:60%;margin-bottom:16px;"></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <div class="skeleton" style="width:150px;height:40px;border-radius:10px;"></div>
            <div class="skeleton" style="width:180px;height:40px;border-radius:10px;"></div>
          </div>
        </div>
        <div class="card">
          <div class="skeleton skeleton-line" style="width:60px;margin-bottom:10px;"></div>
          <div class="skeleton skeleton-line" style="width:92%;margin-bottom:6px;"></div>
          <div class="skeleton skeleton-line" style="width:70%;margin-bottom:16px;"></div>
          <div class="skeleton" style="width:180px;height:40px;border-radius:10px;"></div>
        </div>
      </div>
    `;
  },

  render() {
    const container = document.getElementById('view-ajustes');
    const config = Storage.get('config');

    container.innerHTML = `
      <div class="grid cols-1">
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
            <button class="btn secondary" id="refresh-tasa" style="display:flex;align-items:center;gap:7px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>
              Actualizar ahora
            </button>
            <button class="btn" id="save-tasa" ${config.tasaCambioAuto ? 'disabled' : ''}>Guardar tasa manual</button>
          </div>
        </div>
        <div class="card">
          <p class="card-title">Datos</p>
          <p class="text-dim" style="font-size:13px;">Tus datos viven en una base de datos en la nube (no en este navegador), así que puedes entrar desde cualquier dispositivo con tu cuenta de Google.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
            <button class="btn secondary" id="export-btn">Descargar copia (JSON)</button>
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
  }
};
