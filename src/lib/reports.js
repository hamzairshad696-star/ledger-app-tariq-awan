/**
 * Report builder. Screens and exports both call buildReport(), so an exported
 * file always matches what the Admin saw on screen.
 */
import { buildYearGrid, getPersonLedger, listAdvances, closingOverview } from './ledger-service.js';
import { summarize, summarizeMonthGroup, r2 } from './ledger-calc.js';
import { MONTHS, monthLabel, shortLabel } from './dates.js';
import { badRequest } from './errors.js';
import { yearParam } from './validators.js';

const STATUS_TEXT = { paid: 'Paid', advance_paid: 'Advance Paid', partial: 'Partially Paid', pending: 'Pending', upcoming: 'Not Started', na: 'N/A' };
export const statusText = (s) => STATUS_TEXT[s] || s;

const col = (key, label, type = 'text') => ({ key, label, type });

function filterPeople(rows, f) {
  return rows.filter((r) => {
    if (f.personId && r.person.id !== Number(f.personId)) return false;
    if (f.personStatus && r.person.status !== f.personStatus) return false;
    if (f.marital && r.person.marital_status !== f.marital) return false;
    return true;
  });
}

export const REPORT_TYPES = {
  monthly: 'Monthly report',
  annual: 'Annual report',
  person: 'Person-wise report',
  advance: 'Advance report',
  pending: 'Pending report',
  closing: 'Closing report',
};

export async function buildReport(client, type, f) {
  const year = Number(f.year);
  const month = Number(f.month) || null;

  if (type === 'monthly') {
    if (!month) throw badRequest('Choose a month for the monthly report.');
    const grid = await buildYearGrid(client, year);
    let rows = filterPeople(grid.rows, f).map((r) => ({ r, c: r.months[month - 1] }));
    if (f.status) rows = rows.filter(({ c }) => c.status === f.status);
    const cells = rows.map((x) => x.c);
    const s = summarizeMonthGroup(cells);
    return {
      title: `Monthly report — ${monthLabel(year, month)}`,
      columns: [col('sr_no', 'Sr#'), col('name', 'Name'), col('father_name', 'Father Name'), col('required', 'Amount Due', 'money'), col('paid', 'Paid', 'money'), col('advanceCovered', 'Covered by Advance', 'money'), col('pending', 'Pending', 'money'), col('status', 'Status', 'status'), col('lastPaymentDate', 'Payment Date', 'date'), col('advanceGiven', 'Advance Received', 'money'), col('advanceFor', 'Advance For')],
      rows: rows.map(({ r, c }) => ({
        person_id: r.person.id, sr_no: r.person.sr_no, name: r.person.name, father_name: r.person.father_name,
        required: c.required, paid: c.paid, advanceCovered: c.advanceCovered, pending: c.pending, status: c.status,
        lastPaymentDate: c.lastPaymentDate, advanceGiven: c.advanceGivenAmount,
        advanceFor: c.advanceGivenFor.map((x) => shortLabel(x.year, x.month)).join(' + '),
      })),
      totals: { required: s.required, paid: s.paid, advanceCovered: s.advanceCovered, pending: s.pending, advanceGiven: s.advanceGiven },
      summary: s,
    };
  }

  if (type === 'annual') {
    const grid = await buildYearGrid(client, year);
    const rows = filterPeople(grid.rows, f);
    const t = summarize(rows.flatMap((r) => r.months));
    return {
      title: `Annual report — ${year}`,
      columns: [col('sr_no', 'Sr#'), col('name', 'Name'), col('father_name', 'Father Name'), col('marital_status', 'Marital Status'), col('person_status', 'Status'), col('monthly_amount', 'Monthly Amount', 'money'), col('annualTotal', 'Annual Total', 'money'), col('paidTotal', 'Paid', 'money'), col('advanceTotal', 'Advance', 'money'), col('pendingTotal', 'Pending', 'money'), col('upcomingTotal', 'Not Yet Due', 'money'), col('netTotal', 'Net Total', 'money')],
      rows: rows.map((r) => ({
        person_id: r.person.id, sr_no: r.person.sr_no, name: r.person.name, father_name: r.person.father_name,
        marital_status: r.person.marital_status === 'married' ? 'Married' : 'Unmarried',
        person_status: r.person.status === 'active' ? 'Active' : 'Inactive',
        monthly_amount: r.person.monthly_amount, ...r.summary,
      })),
      totals: { annualTotal: t.annualTotal, paidTotal: t.paidTotal, advanceTotal: t.advanceTotal, pendingTotal: t.pendingTotal, upcomingTotal: t.upcomingTotal, netTotal: t.netTotal },
    };
  }

  if (type === 'person') {
    if (!f.personId) throw badRequest('Choose a person for the person-wise report.');
    const l = await getPersonLedger(client, Number(f.personId), year);
    return {
      title: `${l.person.name} s/o ${l.person.father_name} — ${year} ledger`,
      columns: [col('month', 'Month'), col('required', 'Monthly Amount', 'money'), col('paid', 'Paid', 'money'), col('payment_date', 'Payment Date', 'date'), col('advanceCovered', 'Covered by Advance', 'money'), col('advanceGiven', 'Advance Received', 'money'), col('advanceFor', 'Advance For'), col('pending', 'Pending', 'money'), col('status', 'Status', 'status'), col('closed', 'Month Closing')],
      rows: l.months.map((m) => ({
        month: MONTHS[m.month - 1], required: m.required, paid: m.paid, payment_date: m.lastPaymentDate,
        advanceCovered: m.advanceCovered, advanceGiven: m.advanceGivenAmount,
        advanceFor: m.advanceGivenFor.map((x) => shortLabel(x.year, x.month)).join(' + '),
        pending: m.pending, status: m.status, closed: m.closed ? 'Closed' : 'Open',
      })),
      totals: { required: l.summary.annualTotal, paid: l.summary.paidTotal, advanceCovered: l.summary.advanceTotal, advanceGiven: l.summary.advanceGivenTotal, pending: l.summary.pendingTotal },
      summary: l.summary,
    };
  }

  if (type === 'advance') {
    let list = await listAdvances(client, year);
    if (f.personId) list = list.filter((a) => a.person_id === Number(f.personId));
    if (month) list = list.filter((a) => (a.paid_in_year === year && a.paid_in_month === month) || a.allocations.some((x) => x.year === year && x.month === month));
    if (f.advStatus) list = list.filter((a) => a.status === f.advStatus);
    const active = list.filter((a) => a.status === 'active');
    return {
      title: `Advance report — ${month ? monthLabel(year, month) : year}`,
      columns: [col('id', 'Advance #'), col('payment_date', 'Paid On', 'date'), col('sr_no', 'Sr#'), col('person_name', 'Name'), col('total_amount', 'Advance Amount', 'money'), col('appliedTo', 'Applied To'), col('months', 'Months'), col('adv_status', 'Status')],
      rows: list.map((a) => ({ id: a.id, advance_id: a.id, person_id: a.person_id, payment_date: a.payment_date, sr_no: a.sr_no, person_name: a.person_name, total_amount: a.total_amount, appliedTo: a.appliedTo, months: a.allocations.length, adv_status: a.status === 'active' ? 'Active' : 'Cancelled' })),
      totals: { total_amount: r2(active.reduce((s, a) => s + a.total_amount, 0)) },
      note: 'Totals include active advances only.',
    };
  }

  if (type === 'pending') {
    const grid = await buildYearGrid(client, year);
    const upTo = month || 12;
    const rows = [];
    for (const r of filterPeople(grid.rows, f)) {
      for (const c of r.months.slice(0, upTo)) {
        if (c.pending > 0) {
          rows.push({ person_id: r.person.id, sr_no: r.person.sr_no, name: r.person.name, father_name: r.person.father_name, month: c.month, month_label: monthLabel(year, c.month), required: c.required, covered: c.covered, pending: c.pending, status: c.status, closed: c.closed ? 'Closed' : 'Open' });
        }
      }
    }
    return {
      title: `Pending report — ${year}${month ? ` (up to ${MONTHS[month - 1]})` : ''}`,
      columns: [col('sr_no', 'Sr#'), col('name', 'Name'), col('father_name', 'Father Name'), col('month_label', 'Month'), col('required', 'Amount Due', 'money'), col('covered', 'Received', 'money'), col('pending', 'Pending', 'money'), col('status', 'Status', 'status'), col('closed', 'Month Closing')],
      rows,
      totals: { required: r2(rows.reduce((s, x) => s + x.required, 0)), covered: r2(rows.reduce((s, x) => s + x.covered, 0)), pending: r2(rows.reduce((s, x) => s + x.pending, 0)) },
    };
  }

  if (type === 'closing') {
    const o = await closingOverview(client, year);
    const rows = o.months.filter((m) => !month || m.month === month).map((m) => ({
      month: m.label, state: m.state === 'closed' ? 'Closed' : m.state === 'future' ? 'Not started' : 'Open',
      closed_at: m.closed_at, closed_by: m.closed_by_name || '', people: m.summary.people, paidCount: m.summary.paidCount,
      pendingCount: m.summary.pendingCount, partialCount: m.summary.partialCount, advanceGiven: m.summary.advanceGiven,
      collected: m.summary.collected, pending: m.summary.pending, reopened: m.reopen_reason ? `Reopened: ${m.reopen_reason}` : '',
    }));
    return {
      title: `Closing report — ${year}`,
      columns: [col('month', 'Month'), col('state', 'State'), col('closed_at', 'Closed At', 'datetime'), col('closed_by', 'Closed By'), col('people', 'People'), col('paidCount', 'Paid'), col('partialCount', 'Partial'), col('pendingCount', 'Pending'), col('advanceGiven', 'Advance Received', 'money'), col('collected', 'Total Collected', 'money'), col('pending', 'Pending Amount', 'money'), col('reopened', 'Notes')],
      rows,
      totals: { advanceGiven: r2(rows.reduce((s, x) => s + x.advanceGiven, 0)), collected: r2(rows.reduce((s, x) => s + x.collected, 0)), pending: r2(rows.reduce((s, x) => s + x.pending, 0)) },
    };
  }

  throw badRequest('Unknown report type.');
}

export function reportFilters(sp) {
  return {
    year: yearParam.parse(sp.get('year') || 2026),
    month: sp.get('month') || null,
    personId: sp.get('personId') || null,
    status: sp.get('status') || null,
    personStatus: sp.get('personStatus') || null,
    marital: sp.get('marital') || null,
    advStatus: sp.get('advStatus') || null,
  };
}
