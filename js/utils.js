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
