'use client';
import { useEffect, useState } from 'react';
import { CalendarDays, Wallet, CalendarClock, AlertCircle, Scale, CheckCircle2, CornerDownRight, Circle, Lock, ChevronRight, UserRound } from 'lucide-react';
import { useApi } from '@/components/api-client';
import { useYear } from '@/components/year-context';
import MonthDetailContent from '@/components/MonthDetailContent';
import { StatCard, Spinner, ErrorBox, EmptyState, Modal, StatusBadge, effectiveStatus, cx } from '@/components/ui';
import { money, fmtDate } from '@/lib/format';
import { MONTHS, monthLabel } from '@/lib/dates';

const ICON = {
  paid: <CheckCircle2 size={18} className="text-st-paid" />,
  current_paid: <CheckCircle2 size={18} className="text-st-cur" />,
  advance_paid: <CornerDownRight size={18} className="text-st-paid" />,
  partial: <Circle size={18} className="text-st-part" />,
  pending: <AlertCircle size={18} className="text-st-pend" />,
  upcoming: <Circle size={18} className="text-slate-300" />,
  na: <Circle size={18} className="text-slate-200" />,
};

export default function ViewerHome() {
  const { year, current } = useYear();
  const overview = useApi(`/api/viewer/overview?year=${year}`);
  const [pid, setPid] = useState(null);
  const [month, setMonth] = useState(null);
  const people = overview.data?.people || [];

  useEffect(() => { if (people.length && !people.some((p) => p.person.id === pid)) setPid(people[0].person.id); }, [people, pid]);
  const detail = useApi(pid ? `/api/viewer/people/${pid}?year=${year}` : null);
  const d = detail.data;

  if (overview.error) return <ErrorBox>{overview.error}</ErrorBox>;
  if (overview.loading && !overview.data) return <Spinner />;
  const v = overview.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Welcome,</p>
          <h1 className="text-[26px] leading-8 font-semibold text-ink">{v.viewer.name}</h1>
        </div>
        <div className="card px-4 py-2.5 flex items-center gap-3">
          <CalendarDays size={18} className="text-st-cur" />
          <div><div className="text-xs text-slate-500">Current month</div><div className="font-semibold">{monthLabel(current.year, current.month)}</div></div>
        </div>
      </div>

      {!people.length ? (
        <div className="card"><EmptyState icon={UserRound} title="No records assigned yet" text="The administrator has not assigned any person to your account. Please contact them." /></div>
      ) : (
        <>
          <section>
            <h2 className="text-sm font-semibold text-slate-600 mb-2">Assigned {people.length > 1 ? 'people' : 'person'}</h2>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {people.map(({ person: p, summary }) => (
                <button key={p.id} onClick={() => setPid(p.id)}
                  className={cx('card px-4 py-3 text-left transition min-w-[200px] shrink-0', pid === p.id ? 'ring-2 ring-navy-700' : 'hover:shadow-pop')}>
                  <div className="font-semibold text-ink">{p.name}</div>
                  <div className="text-xs text-slate-500">s/o {p.father_name} · Sr# {p.sr_no}</div>
                  <div className={cx('mt-1.5 text-xs num', summary.pendingTotal ? 'text-st-pend' : 'text-st-paid')}>{summary.pendingTotal ? `${money(summary.pendingTotal)} pending` : 'Nothing pending'}</div>
                </button>
              ))}
            </div>
          </section>

          {detail.error && <ErrorBox>{detail.error}</ErrorBox>}
          {!d ? <Spinner /> : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Monthly total" value={money(d.person.monthly_amount)} hint={`Annual ${money(d.summary.annualTotal)}`} icon={Wallet} />
                <StatCard label="Advance total" value={money(d.summary.advanceTotal)} tone="violet" hint={d.advanceStatus.hasAdvance ? `Paid ahead through ${MONTHS[d.advanceStatus.through.month - 1]} ${d.advanceStatus.through.year}` : 'Months covered by advance'} icon={CalendarClock} />
                <StatCard label="Pending total" value={money(d.summary.pendingTotal)} tone="red" hint="Due and not yet paid" icon={AlertCircle} />
                <StatCard label="Net total" value={money(d.summary.netTotal)} tone="green" hint="Paid + advance − pending" icon={Scale} />
              </div>

              <section className="card">
                <div className="px-5 pt-4 pb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-[15px] font-semibold">Monthly status — {year}</h2>
                  <span className="text-xs text-slate-500">Tap a month for details</span>
                </div>
                <ul className="divide-y divide-line border-t border-line">
                  {d.months.map((m) => {
                    const st = effectiveStatus(m);
                    return (
                      <li key={m.month}>
                        <button onClick={() => setMonth(m.month)} className={cx('w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50', m.isCurrent && 'bg-st-curbg/40')}>
                          {ICON[st]}
                          <span className="w-28 font-medium text-ink">{MONTHS[m.month - 1]}{m.isCurrent && <span className="ml-1.5 text-[10px] text-st-cur font-semibold align-middle">NOW</span>}</span>
                          <StatusBadge status={st} withAdvance={m.advanceGivenAmount > 0} />
                          <span className="hidden sm:inline text-sm text-slate-500 flex-1 truncate">
                            {m.advanceSources.length ? `Paid in advance on ${fmtDate(m.advanceSources[0].paidOn)}` : m.lastPaymentDate ? `Paid on ${fmtDate(m.lastPaymentDate)}` : m.pending ? `${money(m.pending)} pending` : ''}
                          </span>
                          {m.closed && <Lock size={14} className="text-slate-400 ml-auto sm:ml-0" aria-label="Month closed" />}
                          <ChevronRight size={16} className="text-slate-300 ml-auto sm:ml-0" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {d.advances.length > 0 && (
                <section className="card p-5">
                  <h2 className="text-[15px] font-semibold mb-3">Advances</h2>
                  <ul className="space-y-2">
                    {d.advances.map((a) => (
                      <li key={a.id} className="rounded-lg border border-st-adv/20 bg-st-advbg/40 px-4 py-3 text-sm flex flex-wrap gap-x-4 gap-y-1">
                        <b className="num text-st-adv">{money(a.total_amount)}</b>
                        <span className="text-slate-600">paid on {fmtDate(a.payment_date)}</span>
                        <span>applied to <b>{a.allocations.map((x) => monthLabel(x.year, x.month)).join(' + ')}</b></span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}

      {month && d && (
        <Modal open onClose={() => setMonth(null)} size="lg" title={`${d.person.name} — ${monthLabel(year, month)}`} subtitle="Read-only">
          <MonthDetailContent m={d.months[month - 1]} />
        </Modal>
      )}
    </div>
  );
}
