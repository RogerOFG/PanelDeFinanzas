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

// Convierte un objeto Date a 'YYYY-MM-DD' usando la fecha LOCAL del navegador
// (no UTC) — toISOString() se adelanta un día para husos negativos como
// Colombia (UTC-5) cuando ya es de noche.
function dateToISOLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayISO() {
  return dateToISOLocal(new Date());
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

// Limpia lo que el usuario escribe en un campo de monto y devuelve tanto el
// texto ya separado por miles (para mostrar) como el número real (para guardar).
function parseMoneyTyped(strRaw) {
  let s = String(strRaw || '').replace(/[^\d,]/g, '');
  const primeraComa = s.indexOf(',');
  if (primeraComa !== -1) {
    s = s.slice(0, primeraComa + 1) + s.slice(primeraComa + 1).replace(/,/g, '');
  }
  const [intRaw, decRaw] = s.split(',');
  const intPart = (intRaw || '').replace(/^0+(?=\d)/, '');
  const decPart = decRaw !== undefined ? decRaw.slice(0, 2) : undefined;
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const display = decPart !== undefined ? `${grouped},${decPart}` : grouped;
  const numeric = (intPart || decPart !== undefined) ? parseFloat(`${intPart || '0'}.${decPart ?? '0'}`) : 0;
  return { display, numeric };
}

// Formatea un número ya conocido (ej: al abrir un formulario de edición) al
// mismo estilo "1.234.567,89" que usa parseMoneyTyped mientras se escribe.
function formatMoneyDisplay(n) {
  if (n === '' || n === null || n === undefined || isNaN(n)) return '';
  const num = Number(n);
  const hasDecimals = Math.round(num * 100) % 100 !== 0;
  return num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: hasDecimals ? 2 : 0 });
}

// Etiqueta corta para los chips de suma rápida (100000 -> "100k", 1000000 -> "1M").
function chipLabel(n) {
  if (n >= 1000000) return `${n / 1000000}M`;
  if (n >= 1000) return `${n / 1000}k`;
  return String(n);
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

const CATEGORIA_LABELS = {
  comida: 'Comida',
  transporte: 'Transporte',
  renta: 'Renta',
  servicios: 'Servicios',
  entretenimiento: 'Entretenimiento',
  salud: 'Salud',
  educacion: 'Educación',
  ropa: 'Ropa',
  tecnologia: 'Tecnología',
  hogar: 'Hogar',
  juegos: 'Juegos',
  regalo: 'Regalo',
  regalos: 'Regalos',
  prestamo_otorgado: 'Préstamo otorgado',
  salario: 'Salario',
  freelance: 'Freelance',
  inversiones: 'Inversiones',
  ventas: 'Ventas',
  prestamo_recibido: 'Préstamo recibido',
  devolucion_prestamo: 'Devolución préstamo',
  otros: 'Otros'
};

function formatCategoria(cat) {
  if (!cat) return '';
  if (CATEGORIA_LABELS[cat]) return CATEGORIA_LABELS[cat];
  const cleaned = String(cat).replace(/[_-]+/g, ' ').trim();
  return cleaned ? cleaned[0].toUpperCase() + cleaned.slice(1) : '';
}

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

const ICON_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
const ICON_CALENDAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
const ICON_USERS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M2 20v-1a5 5 0 015-5h1"/><circle cy="8" cx="17" r="2.5"/><path d="M15.5 13.2A4 4 0 0122 17v1"/></svg>';
const ICON_STATUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
const ICON_NOTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>';
const ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>';

const CATEGORIAS_SUSCRIPCION = {
  streaming: {
    label: 'Streaming',
    color: 'var(--accent-2)',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'
  },
  movil: {
    label: 'Móvil',
    color: 'var(--warning)',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>'
  },
  musica: {
    label: 'Música',
    color: 'var(--accent)',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
  },
  almacenamiento: {
    label: 'Almacenamiento',
    color: 'var(--accent-3)',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12H2M5.5 5h13l3.5 7v7a1 1 0 01-1 1H4a1 1 0 01-1-1v-7z"/></svg>'
  },
  servicios: {
    label: 'Servicios',
    color: 'var(--danger)',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>'
  },
  otros: {
    label: 'Otros',
    color: 'var(--accent-2)',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>'
  }
};
const ICON_DEUDA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 8l10 4 10-4-10-6z"/><path d="M4 10v6c0 1.5 3.6 3 8 3s8-1.5 8-3v-6"/></svg>';
const ICON_CARD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>';
const ICON_DOTS = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cy="12" cx="19" r="1.8"/></svg>';

// Ícono por categoría de transacción — usado en Historial (top categorías) y
// puede reutilizarse en cualquier lista que muestre `categoria`.
const ICON_CATEGORIA = {
  comida: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 2v6a2 2 0 004 0V2M9 8v14M17 2c-2 2-2 5-2 7a2 2 0 004 0c0-2 0-5-2-7zM17 12v10"/></svg>',
  transporte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="11" rx="2"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/><path d="M3 11h18"/></svg>',
  renta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9"/></svg>',
  servicios: CATEGORIAS_SUSCRIPCION.servicios.icon,
  entretenimiento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>',
  salud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/></svg>',
  educacion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 9l10-5 10 5-10 5-10-5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/></svg>',
  ropa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2l4 2 4-2 4 4-3 3v11H7V9L4 6z"/></svg>',
  tecnologia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></svg>',
  hogar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9"/><path d="M9 20v-6h6v6"/></svg>',
  juegos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="10" rx="4"/><path d="M7 10v4M5 12h4"/><circle cx="16" cy="10.5" r="1"/><circle cx="18.5" cy="13" r="1"/></svg>',
  regalo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18"/><path d="M12 8C9 8 8 6.5 8 5a2 2 0 014 0c0-1.5-1-3-4-3M12 8c3 0 4-1.5 4-3a2 2 0 00-4 0c0-1.5 1-3 4-3"/></svg>',
  prestamo_otorgado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8l4 4-4 4M7 8l-4 4 4 4"/><path d="M3 12h18"/></svg>',
  prestamo_recibido: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8l4 4-4 4M7 8l-4 4 4 4"/><path d="M3 12h18"/></svg>',
  devolucion_prestamo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8l4 4-4 4M7 8l-4 4 4 4"/><path d="M3 12h18"/></svg>',
  salario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
  freelance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
  inversiones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  regalos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18"/><path d="M12 8C9 8 8 6.5 8 5a2 2 0 014 0c0-1.5-1-3-4-3M12 8c3 0 4-1.5 4-3a2 2 0 00-4 0c0-1.5 1-3 4-3"/></svg>',
  ventas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.6 12.6L12 21.2 2.8 12 11.4 3.4 20.6 12.6z"/><circle cx="8" cy="8" r="1.5"/></svg>',
  otros: ICON_DOTS
};

// Anima de 0 al valor real cualquier elemento con [data-count] dentro de `root`.
// Úsalo tras insertar el HTML de una vista: animateCounters(container).
const PREFERS_REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animateCounters(root, duration = 800) {
  root.querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count);
    if (Number.isNaN(target)) return;
    const moneda = el.dataset.countCurrency || 'COP';
    const prefix = el.dataset.countPrefix || '';

    if (PREFERS_REDUCED_MOTION) {
      el.textContent = prefix + formatMoney(target, moneda);
      return;
    }

    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = prefix + formatMoney(target * eased, moneda);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
