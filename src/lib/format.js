import { MONTHS } from './dates.js';

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const num = (n) => nf.format(Number(n || 0));
export const money = (n) => `Rs. ${nf.format(Number(n || 0))}`;

export function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const STATUS_LABELS = {
  paid: 'Paid',
  current_paid: 'Paid',
  advance_paid: 'Advance Paid',
  partial: 'Partially Paid',
  pending: 'Pending',
  upcoming: 'Not Started',
  na: 'N/A',
};

/** Search used by the People and Ledger screens: name, father name, account or exact Sr#. */
export function matchesSearch(p, q) {
  if (!q || !q.trim()) return true;
  const s = q.trim().toLowerCase();
  return String(p.sr_no) === s || p.name.toLowerCase().includes(s) || p.father_name.toLowerCase().includes(s) || String(p.account || '').toLowerCase().includes(s);
}
