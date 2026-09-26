// Shared date/period helpers (safe on client and server).
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

/** Absolute month index: comparable across years. */
export const pIndex = (year, month) => year * 12 + (month - 1);
export const fromIndex = (i) => ({ year: Math.floor(i / 12), month: (i % 12) + 1 });
export const monthLabel = (year, month) => `${MONTHS[month - 1]} ${year}`;
export const shortLabel = (year, month) => `${MONTHS_SHORT[month - 1]} ${year}`;

export function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 2000 && y <= 2100;
}

export function periodOfDate(iso) {
  const [y, m] = iso.split('-').map(Number);
  return { year: y, month: m };
}

export function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthEndISO(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`;
}

/** Server "today" in the app timezone (APP_TODAY overrides for testing). */
export function todayISO() {
  const override = typeof process !== 'undefined' ? process.env.APP_TODAY : '';
  if (override && isValidISODate(override)) return override;
  const tz = (typeof process !== 'undefined' && process.env.APP_TIMEZONE) || 'Asia/Karachi';
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function currentPeriod(today = todayISO()) {
  return periodOfDate(today);
}
