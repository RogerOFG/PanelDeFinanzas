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
  }
};
