'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil, Banknote, CalendarClock, CornerDownRight, Lock, Printer, ArrowUpRight } from 'lucide-react';
import { useApi } from '@/components/api-client';
import { useYear } from '@/components/year-context';
import { useActions } from '@/components/AdminShell';
import PersonFormModal from '@/components/PersonFormModal';
import { Card, Button, Spinner, ErrorBox, StatusBadge, effectiveStatus, StatCard, Money, cx } from '@/components/ui';
import { money, fmtDate } from '@/lib/format';
import { MONTHS_SHORT, shortLabel } from '@/lib/dates';

function Info({ label, value }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="text-sm font-medium text-ink mt-0.5 break-words">{value || '—'}</dd></div>;
}

export default function PersonPage({ params }) {
  const id = Number(params.id);
  const { year } = useYear();
  const actions = useActions();
  const { data: d, error, loading } = useApi(`/api/admin/people/${id}/ledger?year=${year}`, [actions.version]);
  const [editing, setEditing] = useState(false);

  if (error) return <div className="space-y-4"><Link href="/admin/people" className="link text-sm inline-flex items-center gap-1"><ArrowLeft size={15} />People</Link><ErrorBox>{error}</ErrorBox></div>;
  if (loading && !d) return <Spinner />;
  const p = d.person;
  const s = d.summary;
  const open = (month) => actions.openMonth({ personId: id, year, month });

  return (
    <div className="space-y-6">
      <div className="no-print"><Link href="/admin/people" className="link text-sm inline-flex items-center gap-1"><ArrowLeft size={15} />All people</Link></div>

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-14 w-14 shrink-0 rounded-xl bg-navy-900 text-white grid place-items-center text-lg font-semibold">{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-ink truncate">{p.name}</h1>
              <p className="text-sm text-slate-500">s/o {p.father_name} · Sr# <span className="num">{p.sr_no}</span></p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>Print / PDF</Button>
            <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="secondary" size="sm" icon={CalendarClock} onClick={() => actions.openAdvance({ personId: id })}>Add advance</Button>
            <Button size="sm" icon={Banknote} onClick={() => actions.openPayment({ personId: id, year })}>Add payment</Button>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          <Info label="Father name" value={p.father_name} />
          <Info label="Status" value={p.status === 'active' ? 'Active' : 'Inactive'} />
          <Info label="Marital status" value={p.marital_status === 'married' ? 'Married' : 'Unmarried'} />
          <Info label="Monthly amount" value={money(p.monthly_amount)} />
          <Info label="Split cash" value={money(p.split_cash)} />
          <Info label="Account" value={p.account} />
          <Info label="Joining date" value={p.joining_date ? fmtDate(p.joining_date) : ''} />
          <Info label="Advance status" value={d.advanceStatus.hasAdvance ? `Paid through ${shortLabel(d.advanceStatus.through.year, d.advanceStatus.through.month)}` : 'No advance'} />
        </dl>
        {p.notes && <p className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-lg px-3.5 py-2.5">{p.notes}</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Annual total" value={money(s.annualTotal)} />
        <StatCard label="Paid total" value={money(s.paidTotal)} tone="green" />
        <StatCard label="Advance total" value={money(s.advanceTotal)} tone="violet" hint="Months covered by advance" />
        <StatCard label="Pending total" value={money(s.pendingTotal)} tone="red" hint={s.upcomingTotal ? `${money(s.upcomingTotal)} not yet due` : 'Due and unpaid'} />
        <StatCard label="Net total" value={money(s.netTotal)} hint="Paid + advance − pending" />
      </div>

      <Card title={`${year} ledger`} subtitle="Click any month for full details" bodyClass="px-0 pb-0" className="print-full">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              <th className="th pl-5">Month</th><th className="th text-right">Monthly amount</th><th className="th text-right">Paid</th><th className="th">Payment date</th>
              <th className="th">Advance</th><th className="th">Advance for</th><th className="th text-right">Pending</th><th className="th">Status</th><th className="th pr-5"></th>
            </tr></thead>
            <tbody>
              {d.months.map((m) => {
                const st = effectiveStatus(m);
                return (
                  <tr key={m.month} className={cx('cursor-pointer hover:bg-slate-50/70', m.isCurrent && 'bg-st-curbg/40')} onClick={() => open(m.month)}>
                    <td className="td pl-5 font-medium">{MONTHS_SHORT[m.month - 1]}{m.isCurrent && <span className="ml-2 text-[11px] text-st-cur font-semibold">NOW</span>}</td>
                    <td className="td text-right">{m.applicable ? <Money v={m.required} /> : <span className="text-slate-300">—</span>}</td>
                    <td className="td text-right">{m.paid ? <Money v={m.paid} /> : <span className="text-slate-300">—</span>}</td>
                    <td className="td text-slate-500">{m.lastPaymentDate ? fmtDate(m.lastPaymentDate) : '—'}</td>
                    <td className="td">
                      {m.advanceGivenAmount > 0 ? <span className="num font-medium text-st-adv">{money(m.advanceGivenAmount)}</span>
                        : m.advanceCovered > 0 ? <span className="inline-flex items-center gap-1 text-st-paid text-sm"><CornerDownRight size={13} />Already paid</span>
                          : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="td text-slate-600">{m.advanceGivenFor.length ? m.advanceGivenFor.map((x) => MONTHS_SHORT[x.month - 1] + (x.year !== year ? ` ${x.year}` : '')).join(' + ') : '—'}</td>
                    <td className={cx('td text-right', m.pending > 0 ? 'text-st-pend font-medium' : 'text-slate-400')}><Money v={m.pending} /></td>
                    <td className="td"><span className="inline-flex items-center gap-1.5">
                      <StatusBadge status={st} withAdvance={m.advanceGivenAmount > 0} />
                      {m.closed && <Lock size={13} className="text-slate-400" aria-label="Month closed" />}
                    </span></td>
                    <td className="td pr-5 text-right text-slate-400"><ArrowUpRight size={15} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="td pl-5">Total</td><td className="td text-right"><Money v={s.annualTotal} /></td><td className="td text-right"><Money v={s.paidTotal} /></td><td className="td"></td>
                <td className="td text-st-adv"><Money v={s.advanceGivenTotal} /></td><td className="td text-xs font-normal text-slate-500">Covered by advance: {money(s.advanceTotal)}</td>
                <td className="td text-right text-st-pend"><Money v={s.pendingTotal} /></td><td className="td" colSpan={2}>Net <Money v={s.netTotal} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card title="Advances" subtitle="Each advance stays linked to the exact months it pays for">
        {d.advances.length ? (
          <ul className="divide-y divide-line -mx-2">
            {d.advances.map((a) => (
              <li key={a.id}>
                <button onClick={() => actions.openAdvanceDetail(a.id)} className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-3 text-left text-sm hover:bg-slate-50 rounded-lg">
                  <span className="num font-semibold text-st-adv w-28">{money(a.total_amount)}</span>
                  <span className="text-slate-500 w-36">Paid {fmtDate(a.payment_date)}</span>
                  <span className="flex-1 min-w-[160px]">Applied to <b className="text-ink">{a.appliedTo}</b></span>
                  <span className={cx('rounded-full px-2 py-0.5 text-xs font-medium', a.status === 'active' ? 'bg-st-paidbg text-st-paid' : 'bg-slate-100 text-slate-500 line-through')}>{a.status === 'active' ? 'Active' : 'Cancelled'}</span>
                  <ArrowUpRight size={15} className="text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">No advances recorded for this person.</p>}
      </Card>

      {editing && <PersonFormModal person={p} onClose={() => setEditing(false)} onSaved={actions.changed} />}
    </div>
  );
}
