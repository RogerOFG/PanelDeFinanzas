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

  // Bloquea envíos duplicados de un formulario: deshabilita el botón submit
  // en la primera llamada y devuelve false en cualquier llamada repetida
  // (doble clic, doble Enter) mientras el botón siga deshabilitado.
  guardSubmit(e) {
    const btn = e.target.querySelector('[type=submit]');
    if (btn && btn.disabled) return false;
    if (btn) btn.disabled = true;
    return true;
  },

  toast(message, type = 'info') {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = `toast ${type === 'info' ? '' : type}`;
    el.innerHTML = `
      <span class="toast-msg"></span>
      <button class="toast-close" aria-label="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `;
    el.querySelector('.toast-msg').textContent = message;
    root.appendChild(el);

    const timer = setTimeout(() => dismiss(), 4500);
    const dismiss = () => {
      clearTimeout(timer);
      el.classList.add('toast-leaving');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 300); // por si el navegador no dispara transitionend
    };
    el.querySelector('.toast-close').onclick = dismiss;

    // Deslizar a cualquier lado para descartar.
    let startX = null, dx = 0, dragging = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.toast-close')) return; // no capturar el puntero del botón de cerrar
      startX = e.clientX;
      dragging = true;
      el.setPointerCapture(e.pointerId);
      el.style.transition = 'none';
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(Math.max(0.15, 1 - Math.abs(dx) / 120));
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      el.style.transition = '';
      if (Math.abs(dx) > 80) {
        el.style.transform = `translateX(${dx > 0 ? '120%' : '-120%'})`;
        el.style.opacity = '0';
        dismiss();
      } else {
        el.style.transform = '';
        el.style.opacity = '';
      }
      dx = 0;
    };
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
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
    document.addEventListener('scroll', (e) => {
      // No cerrar si el scroll ocurre dentro del propio menú de opciones (lista larga).
      if (e.target.closest && e.target.closest('.custom-select-menu')) return;
      UI._closeAllSelects();
    }, true);
  },

  // Campo de monto: muestra separadores de miles mientras se escribe y agrega
  // chips para sumar cantidades comunes de un toque. El valor real (numérico,
  // sin separadores) queda en un <input type="hidden"> con el mismo `name`,
  // así que FormData/fd.get(...) sigue funcionando igual que con un <input number>.
  moneyInputHTML(name, value, opts = {}) {
    const chips = opts.chips || [10000, 50000, 100000, 500000];
    const display = formatMoneyDisplay(value);
    return `
      <div class="money-input">
        <div class="money-input-field">
          <span class="money-input-symbol">$</span>
          <input type="text" inputmode="decimal" class="money-display" placeholder="${opts.placeholder || '0'}" value="${escapeHtml(display)}" ${opts.required ? 'required' : ''}>
        </div>
        <input type="hidden" name="${escapeHtml(name)}" ${opts.id ? `id="${escapeHtml(opts.id)}"` : ''} value="${value ?? ''}">
        <div class="money-chips">
          ${chips.map(c => `<button type="button" class="money-chip" data-add="${c}">+${chipLabel(c)}</button>`).join('')}
          <button type="button" class="money-chip money-chip-clear" data-clear title="Vaciar">0</button>
        </div>
      </div>`;
  },

  // Activa el formato en vivo y los chips de todos los .money-input dentro de `root`.
  initMoneyInputs(root) {
    root.querySelectorAll('.money-input').forEach(wrap => {
      const display = wrap.querySelector('.money-display');
      const hidden = wrap.querySelector('input[type=hidden]');

      display.addEventListener('input', () => {
        const { display: formatted, numeric } = parseMoneyTyped(display.value);
        display.value = formatted;
        hidden.value = numeric || '';
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      });

      wrap.querySelectorAll('[data-add]').forEach(btn => {
        btn.onclick = () => {
          const actual = parseFloat(hidden.value) || 0;
          const nuevo = actual + parseFloat(btn.dataset.add);
          hidden.value = nuevo;
          display.value = formatMoneyDisplay(nuevo);
          hidden.dispatchEvent(new Event('change', { bubbles: true }));
        };
      });

      const clearBtn = wrap.querySelector('[data-clear]');
      if (clearBtn) {
        clearBtn.onclick = () => {
          hidden.value = '';
          display.value = '';
          display.focus();
          hidden.dispatchEvent(new Event('change', { bubbles: true }));
        };
      }
    });
  }
};
