// Helpers de UI: modales y toasts, reutilizables desde cualquier vista.

const UI = {
  openModal(titleHtml, bodyHtml, { onMount } = {}) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal">
          <h2>${titleHtml}</h2>
          ${bodyHtml}
        </div>
      </div>
    `;
    document.getElementById('modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') UI.closeModal();
    });
    if (onMount) onMount(root);
  },

  closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  },

  toast(message, type = 'info') {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast ${type === 'info' ? '' : type}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  },

  confirmAction(message, onConfirm) {
    UI.openModal('Confirmar', `
      <p>${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button class="btn secondary" id="cancel-btn">Cancelar</button>
        <button class="btn danger" id="confirm-btn">Eliminar</button>
      </div>
    `, {
      onMount: (root) => {
        root.querySelector('#cancel-btn').onclick = () => UI.closeModal();
        root.querySelector('#confirm-btn').onclick = () => {
          onConfirm();
          UI.closeModal();
        };
      }
    });
  },

  // Select personalizado (reemplaza <select> nativo) — genera un <input type="hidden">
  // con el mismo `name`/`id` que tendría un <select>, así el resto del código
  // (FormData, .value, .onchange) sigue funcionando sin cambios.
  selectHTML(name, options, selected, { id } = {}) {
    const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
    const current = opts.find(o => String(o.value) === String(selected)) || opts[0] || { value: '', label: '' };
    return `
      <div class="custom-select" data-name="${escapeHtml(name)}">
        <input type="hidden" name="${escapeHtml(name)}" ${id ? `id="${escapeHtml(id)}"` : ''} value="${escapeHtml(current.value)}">
        <button type="button" class="custom-select-trigger">
          <span class="custom-select-label">${escapeHtml(current.label)}</span>
          <svg class="custom-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="custom-select-menu">
          ${opts.map(o => `<div class="custom-select-option${String(o.value) === String(current.value) ? ' selected' : ''}" data-value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</div>`).join('')}
        </div>
      </div>`;
  },

  // Actualiza las opciones de un select personalizado ya montado (ej: categorías que dependen del tipo).
  setSelectOptions(wrap, options, selected) {
    const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
    const current = opts.find(o => String(o.value) === String(selected)) || opts[0] || { value: '', label: '' };
    const hidden = wrap.querySelector('input[type=hidden]');
    const label = wrap.querySelector('.custom-select-label');
    const menu = wrap.querySelector('.custom-select-menu');
    hidden.value = current.value;
    label.textContent = current.label;
    menu.innerHTML = opts.map(o => `<div class="custom-select-option${String(o.value) === String(current.value) ? ' selected' : ''}" data-value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</div>`).join('');
    UI._wireSelectOptions(wrap);
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  },

  // Activa el comportamiento (abrir/cerrar, elegir opción) de todos los .custom-select dentro de `root`.
  initSelects(root) {
    root.querySelectorAll('.custom-select').forEach(wrap => {
      const trigger = wrap.querySelector('.custom-select-trigger');
      trigger.onclick = (e) => {
        e.stopPropagation();
        const wasOpen = wrap.classList.contains('open');
        UI._closeAllSelects();
        if (!wasOpen) {
          UI._positionSelectMenu(wrap);
          wrap.classList.add('open');
        }
      };
      UI._wireSelectOptions(wrap);
    });
    UI._ensureOutsideClickHandler();
  },

  // El menú se posiciona con "position: fixed" calculado desde el botón, para que nunca
  // quede recortado por un contenedor con overflow (el modal, la barra de filtros, etc.).
  _positionSelectMenu(wrap) {
    const trigger = wrap.querySelector('.custom-select-trigger');
    const menu = wrap.querySelector('.custom-select-menu');
    const rect = trigger.getBoundingClientRect();
    const menuMaxHeight = 260;
    const spaceBelow = window.innerHeight - rect.bottom;

    menu.style.position = 'fixed';
    menu.style.left = rect.left + 'px';
    menu.style.width = rect.width + 'px';

    if (spaceBelow < menuMaxHeight && rect.top > spaceBelow) {
      menu.style.top = 'auto';
      menu.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
    } else {
      menu.style.bottom = 'auto';
      menu.style.top = (rect.bottom + 6) + 'px';
    }
  },

  _closeAllSelects() {
    document.querySelectorAll('.custom-select.open').forEach(w => w.classList.remove('open'));
  },

  _wireSelectOptions(wrap) {
    const hidden = wrap.querySelector('input[type=hidden]');
    const label = wrap.querySelector('.custom-select-label');
    wrap.querySelectorAll('.custom-select-option').forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        hidden.value = opt.dataset.value;
        label.textContent = opt.textContent;
        wrap.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        wrap.classList.remove('open');
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      };
    });
  },

  _ensureOutsideClickHandler() {
    if (UI._outsideClickBound) return;
    UI._outsideClickBound = true;
    document.addEventListener('click', () => UI._closeAllSelects());
    window.addEventListener('resize', () => UI._closeAllSelects());
    document.addEventListener('scroll', () => UI._closeAllSelects(), true);
  }
};
