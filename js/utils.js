// Utilidades de formato y cálculo compartidas entre vistas.

function formatMoney(monto, moneda) {
  const n = Number(monto || 0);
  const symbol = moneda === 'USD' ? 'US$' : '$';
  const sign = n < 0 ? '-' : '';
  const maxDecimals = moneda === 'USD' ? 2 : 0; // el peso colombiano no se muestra con centavos
  const formatted = Math.abs(n).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals });
  return `${sign}${symbol}${formatted}`;
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

const ICON_ACCOUNT_TIPO = {
  banco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  efectivo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M8.5 9.5c0-1.4 1.5-2.5 3.5-2.5s3.5 1.1 3.5 2.5-1.5 2-3.5 2.5-3.5 1.1-3.5 2.5S10.6 17 12.5 17s3.5-1.1 3.5-2.5"/></svg>',
  inversion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  terceros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0116 0v1"/></svg>'
};
const ACCOUNT_TIPO_COLOR = { banco: 'var(--accent)', efectivo: 'var(--warning)', inversion: 'var(--accent-2)', terceros: 'var(--text-dim)' };
