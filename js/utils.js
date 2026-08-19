// Utilidades de formato y cálculo compartidas entre vistas.

function formatMoney(monto, moneda) {
  const n = Number(monto || 0);
  const symbol = moneda === 'USD' ? 'US$' : '$';
  const formatted = n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${symbol}${formatted}`;
}

function toBaseCurrency(monto, moneda) {
  const { tasaCambio } = Storage.get('config') || {};
  const rate = Storage.load().config.tasaCambio || 4000;
  if (moneda === 'USD') return Number(monto || 0) * rate;
  return Number(monto || 0);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(iso) {
  if (!iso) return null;
  const target = new Date(iso + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function accountLabel(cuenta) {
  if (!cuenta) return '—';
  return `${cuenta.nombre} (${cuenta.moneda})`;
}

const TIPO_CUENTA_LABELS = {
  efectivo: 'Efectivo',
  banco: 'Cuenta bancaria',
  inversion: 'Inversión',
  terceros: 'Cuenta de terceros'
};

const TIPO_MOVIMIENTO_LABELS = {
  ingreso: 'Ingreso',
  gasto: 'Gasto',
  transferencia: 'Transferencia'
};

const ICON_EDIT = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
const ICON_TRASH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>';
const ICON_CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>';
