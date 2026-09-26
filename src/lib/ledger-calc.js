/**
 * ============================================================
 *  CENTRAL CALCULATION LAYER — the ONLY place ledger math lives.
 *  Used by the Admin dashboard, Viewer dashboard, reports,
 *  exports and closings, so every screen shows the same numbers.
 * ============================================================
 *
 * Definitions (per person, per month):
 *   required        amount due for that month (from monthly_ledger)
 *   paid            sum of regular payments recorded for that month
 *   advanceCovered  sum of ACTIVE advance allocations targeting that month
 *   covered         paid + advanceCovered
 *   pending         required - covered, only for months that are due
 *                   (month <= current month). Future months are "upcoming".
 *
 * Totals (per person or group, for a year):
 *   annualTotal   = Σ required over applicable months
 *   paidTotal     = Σ paid
 *   advanceTotal  = Σ advanceCovered   (sum of active allocations INTO the year)
 *   pendingTotal  = Σ pending          (due but not covered)
 *   upcomingTotal = Σ not-yet-due, not-yet-covered amounts
 *   netTotal      = paidTotal + advanceTotal − pendingTotal
 */
import { pIndex, monthEndISO } from './dates.js';

export const STATUS = {
  PAID: 'paid',
  ADVANCE_PAID: 'advance_paid',
  PARTIAL: 'partial',
  PENDING: 'pending',
  UPCOMING: 'upcoming',
  NA: 'na',
};

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const sum = (arr, f = (x) => x) => r2(arr.reduce((a, x) => a + Number(f(x) || 0), 0));

/**
 * Compute one person-month cell.
 * @param {object} p
 *  person        {status, joining_date, monthly_amount}
 *  year, month
 *  required      number | undefined (falls back to person.monthly_amount)
 *  payments      [{amount, payment_date, ...}]
 *  allocations   [{amount, advance_id, advance_payment_date}]  (active only)
 *  advancesGiven [{id, total_amount, allocations:[{year,month,amount}]}] advances PAID IN this month (active)
 *  current       {year, month}
 *  closed        boolean
 */
export function computeMonth(p) {
  const { person, year, month, payments = [], allocations = [], advancesGiven = [], current, closed = false } = p;
  const required = r2(p.required ?? person.monthly_amount);
  const paid = sum(payments, (x) => x.amount);
  const advanceCovered = sum(allocations, (x) => x.amount);
  const covered = r2(paid + advanceCovered);

  const idx = pIndex(year, month);
  const curIdx = pIndex(current.year, current.month);
  const isFuture = idx > curIdx;
  const isCurrent = idx === curIdx;

  const afterJoin = !person.joining_date || person.joining_date <= monthEndISO(year, month);
  // Inactive people stop accruing new dues, but anything recorded still shows.
  const applicable = afterJoin && (person.status === 'active' || covered > 0);

  let status;
  if (!applicable) status = STATUS.NA;
  else if (required <= 0) status = covered > 0 ? STATUS.PAID : STATUS.NA;
  else if (covered >= required) status = paid === 0 && advanceCovered > 0 ? STATUS.ADVANCE_PAID : STATUS.PAID;
  else if (covered > 0) status = STATUS.PARTIAL;
  else status = isFuture ? STATUS.UPCOMING : STATUS.PENDING;

  const counts = applicable && required > 0;
  const remaining = counts ? r2(Math.max(required - covered, 0)) : 0;
  const advanceGivenAmount = sum(advancesGiven, (a) => a.total_amount);

  return {
    year,
    month,
    required: applicable ? required : 0,
    baseRequired: required,
    paid,
    advanceCovered,
    covered,
    remaining,
    pending: isFuture ? 0 : remaining,
    upcoming: isFuture ? remaining : 0,
    overpaid: counts ? r2(Math.max(covered - required, 0)) : 0,
    status,
    applicable,
    isFuture,
    isCurrent,
    closed,
    advanceGivenAmount,
    advanceGivenFor: advancesGiven.flatMap((a) =>
      (a.allocations || []).map((al) => ({ advanceId: a.id, year: al.year, month: al.month, amount: r2(al.amount) }))
    ),
    advanceSources: allocations.map((a) => ({ advanceId: a.advance_id, paidOn: a.advance_payment_date, amount: r2(a.amount) })),
    lastPaymentDate: payments.length ? payments.map((x) => x.payment_date).sort().at(-1) : null,
  };
}

/** Totals over a list of computed months (one person's year, or all people). */
export function summarize(months) {
  const paidTotal = sum(months, (m) => m.paid);
  const advanceTotal = sum(months, (m) => m.advanceCovered);
  const pendingTotal = sum(months, (m) => m.pending);
  return {
    annualTotal: sum(months, (m) => m.required),
    paidTotal,
    advanceTotal,
    coveredTotal: r2(paidTotal + advanceTotal),
    pendingTotal,
    upcomingTotal: sum(months, (m) => m.upcoming),
    advanceGivenTotal: sum(months, (m) => m.advanceGivenAmount),
    netTotal: r2(paidTotal + advanceTotal - pendingTotal),
  };
}

/** Status of a single month across a group of people (used by closings & dashboard). */
export function summarizeMonthGroup(cells) {
  const applicable = cells.filter((c) => c.applicable && c.required > 0);
  const fully = applicable.filter((c) => c.status === STATUS.PAID || c.status === STATUS.ADVANCE_PAID);
  return {
    people: applicable.length,
    paidCount: fully.length,
    paidDirectCount: applicable.filter((c) => c.status === STATUS.PAID).length,
    advancePaidCount: applicable.filter((c) => c.status === STATUS.ADVANCE_PAID).length,
    partialCount: applicable.filter((c) => c.status === STATUS.PARTIAL).length,
    pendingCount: applicable.filter((c) => c.status === STATUS.PENDING).length,
    upcomingCount: applicable.filter((c) => c.status === STATUS.UPCOMING).length,
    required: sum(applicable, (c) => c.required),
    paid: sum(cells, (c) => c.paid),
    advanceCovered: sum(cells, (c) => c.advanceCovered),
    pending: sum(cells, (c) => c.pending),
    remaining: sum(cells, (c) => c.remaining),
    advanceGiven: sum(cells, (c) => c.advanceGivenAmount),
    // Cash actually received in this month = payments for the month + advances handed over in it
    collected: r2(sum(cells, (c) => c.paid) + sum(cells, (c) => c.advanceGivenAmount)),
  };
}

/**
 * Split an advance amount across target months in order, filling each month's
 * remaining due. Throws if the amount is larger than the selected months can absorb.
 * @param {number} total
 * @param {{year:number, month:number, remaining:number}[]} months (sorted)
 */
export function autoAllocate(total, months) {
  let left = r2(total);
  const out = [];
  for (const m of months) {
    if (left <= 0) break;
    const take = r2(Math.min(left, m.remaining));
    if (take > 0) {
      out.push({ year: m.year, month: m.month, amount: take });
      left = r2(left - take);
    }
  }
  return { allocations: out, unallocated: left };
}

/** e.g. "Covered through May 2026" — derived from future active allocations. */
export function advanceStatusFrom(futureAllocations) {
  if (!futureAllocations.length) return { hasAdvance: false, amount: 0, through: null, months: 0 };
  const sorted = [...futureAllocations].sort((a, b) => pIndex(a.year, a.month) - pIndex(b.year, b.month));
  const last = sorted.at(-1);
  const months = new Set(sorted.map((a) => pIndex(a.year, a.month))).size;
  return { hasAdvance: true, amount: sum(sorted, (a) => a.amount), through: { year: last.year, month: last.month }, months };
}

export { r2 };
