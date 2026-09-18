// Display formatting for the Hub dashboard.
//
// Rates are configurable rather than frozen in at module load: the widget shows
// costs in the operator's currency using live exchange rates, so a hardcoded copy
// here meant the same USD figure rendered as different CNY/TWD/HKD numbers in the
// two clients. The Hub publishes its fetched rates on /api/rates and the app calls
// configureRates() with them. These defaults match src/shared/currency.js
// CURRENCY_RATES so the clients agree before the fetch resolves (and if the Hub has
// no live rates yet).
const DEFAULT_RATES = {
  USD: { symbol: '$', rate: 1 },
  CNY: { symbol: '¥', rate: 6.8 },
  TWD: { symbol: 'NT$', rate: 31.5 },
  HKD: { symbol: 'HK$', rate: 7.8 }
};

let rates = { ...DEFAULT_RATES };
let ratesSource = 'built-in';
let ratesDate = null;

/**
 * Replace the rate table. Values are "units of this currency per 1 USD".
 * Unknown or non-positive entries are ignored so a partial payload cannot blank a
 * currency, and USD is always pinned to 1.
 */
export function configureRates(next, meta = {}) {
  if (!next || typeof next !== 'object') return rates;
  const merged = { ...rates };
  for (const [code, value] of Object.entries(next)) {
    const fallback = DEFAULT_RATES[code];
    if (!fallback) continue;
    if (code === 'USD') { merged.USD = { ...fallback, rate: 1 }; continue; }
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    merged[code] = { ...fallback, rate };
  }
  rates = merged;
  ratesSource = typeof meta.source === 'string' && meta.source ? meta.source : 'hub';
  ratesDate = typeof meta.date === 'string' && meta.date ? meta.date : null;
  return rates;
}

export function currentRates() {
  return { rates, source: ratesSource, date: ratesDate };
}

export function formatNumber(value) {
  return Math.round(Number(value || 0)).toLocaleString('en-US');
}

export function formatCompact(value) {
  const n = Math.round(Number(value || 0));
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return formatNumber(n);
}

export function formatCost(value, currency = 'USD') {
  const entry = rates[currency] || rates.USD;
  const amount = Number(value || 0) * entry.rate;
  const digits = Math.abs(amount) >= 1 ? 2 : 4;
  return `${entry.symbol}${amount.toFixed(digits)}`;
}

export function formatRelative(iso, locale = 'en') {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '—';
  const delta = Date.now() - ts;
  const abs = Math.abs(delta);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 60_000) return rtf.format(-Math.round(delta / 1000), 'second');
  if (abs < 3_600_000) return rtf.format(-Math.round(delta / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(-Math.round(delta / 3_600_000), 'hour');
  return rtf.format(-Math.round(delta / 86_400_000), 'day');
}

export function formatReset(iso, locale = 'en') {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function toDatetimeLocalValue(date = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
