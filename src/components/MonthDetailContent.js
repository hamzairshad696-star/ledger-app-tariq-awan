'use client';
import { Lock, Unlock, CornerDownRight, ArrowUpRight, Trash2 } from 'lucide-react';
import { money, fmtDate } from '@/lib/format';
import { monthLabel } from '@/lib/dates';
import { StatusBadge, effectiveStatus, Button, cx } from './ui';

function Fact({ label, value, tone }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3.5 py-2.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cx('num font-semibold mt-0.5', tone)}>{value}</div>
    </div>
  );
}

/** Shared by Admin (with actions) and Viewer (read-only). */
export default function MonthDetailContent({ m, onAdvance, onDeletePayment, deleting }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={effectiveStatus(m)} withAdvance={m.advanceGivenAmount > 0} />
        {m.closed
          ? <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"><Lock size={12} />Month closed</span>
          : <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500"><Unlock size={12} />Open</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Fact label="Monthly amount" value={money(m.required || m.baseRequired || 0)} />
        <Fact label="Paid" value={money(m.paid)} />
        <Fact label="Covered by advance" value={money(m.advanceCovered)} tone={m.advanceCovered ? 'text-st-paid' : ''} />
        <Fact label={m.isFuture ? 'Not yet due' : 'Pending'} value={money(m.isFuture ? m.upcoming : m.pending)} tone={m.pending > 0 ? 'text-st-pend' : ''} />
      </div>

      <section>
        <h4 className="text-sm font-semibold text-ink mb-2">Payments</h4>
        {m.payments?.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {m.payments.map((p, i) => (
              <li key={p.id || i} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                <span className="num font-medium">{money(p.amount)}</span>
                <span className="text-slate-500">{fmtDate(p.payment_date)}</span>
                <span className="text-slate-400 capitalize">{p.method}</span>
                {p.reference && <span className="text-slate-400 truncate">Ref {p.reference}</span>}
                {onDeletePayment && !m.closed && (
                  <button onClick={() => onDeletePayment(p)} disabled={deleting} className="ml-auto p-1.5 rounded-md text-slate-400 hover:text-st-pend hover:bg-st-pendbg" aria-label="Delete payment" title="Delete payment"><Trash2 size={15} /></button>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">{m.lastPaymentDate ? `Last payment ${fmtDate(m.lastPaymentDate)}` : 'No payment recorded for this month.'}</p>}
      </section>

      {m.advanceSources?.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-ink mb-2">Already paid in advance</h4>
          <ul className="space-y-1.5">
            {m.advanceSources.map((s, i) => (
              <li key={i}>
                <button disabled={!onAdvance} onClick={() => onAdvance?.(s.advanceId)} className={cx('w-full flex items-center gap-2 rounded-lg border border-st-paid/20 bg-st-paidbg/60 px-3.5 py-2.5 text-sm text-left', onAdvance && 'hover:border-st-paid/50')}>
                  <CornerDownRight size={15} className="text-st-paid" />
                  <span><b className="num">{money(s.amount)}</b> from the advance paid on <b>{fmtDate(s.paidOn)}</b></span>
                  {onAdvance && <ArrowUpRight size={15} className="ml-auto text-slate-400" />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {m.advanceGivenAmount > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-ink mb-2">Advance received this month</h4>
          <div className="rounded-lg border border-st-adv/25 bg-st-advbg/60 px-3.5 py-3 text-sm">
            <div className="flex items-baseline justify-between"><span className="text-slate-600">Total advance</span><b className="num text-st-adv">{money(m.advanceGivenAmount)}</b></div>
            <ul className="mt-2 space-y-1">
              {m.advanceGivenFor.map((a, i) => (
                <li key={i} className="flex items-center justify-between">
                  <button disabled={!onAdvance} onClick={() => onAdvance?.(a.advanceId)} className={cx('text-left', onAdvance && 'link')}>Applied to {monthLabel(a.year, a.month)}</button>
                  <span className="num">{money(a.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
