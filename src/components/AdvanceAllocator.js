'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { api } from './api-client';
import { autoAllocate } from '@/lib/ledger-calc';
import { pIndex, periodOfDate, isValidISODate, monthLabel } from '@/lib/dates';
import { money } from '@/lib/format';
import { Field, Input, Button, cx, STATUS_STYLE } from './ui';

/**
 * Pick the exact future months an advance covers.
 * afterPeriod: months shown start AFTER this {year, month} (payment month or the month paid for).
 * Reports { total, allocations, error } through onChange.
 */
export default function AdvanceAllocator({ personId, paymentDate, afterPeriod, onChange }) {
  const base = useMemo(() => {
    if (!isValidISODate(paymentDate)) return null;
    const paid = periodOfDate(paymentDate);
    if (afterPeriod && pIndex(afterPeriod.year, afterPeriod.month) > pIndex(paid.year, paid.month)) return afterPeriod;
    return paid;
  }, [paymentDate, afterPeriod?.year, afterPeriod?.month]); // eslint-disable-line react-hooks/exhaustive-deps

  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState([]); // array of pIndex
  const [total, setTotal] = useState('');
  const [totalTouched, setTotalTouched] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualAmounts, setManualAmounts] = useState({});
  const [nMonths, setNMonths] = useState('');

  useEffect(() => {
    if (!personId || !base) { setMonths([]); return; }
    setLoading(true);
    setLoadError('');
    api(`/api/admin/people/${personId}/coverage?year=${base.year}&month=${base.month}&count=12`)
      .then((d) => { setMonths(d.months); setSelected([]); setManualAmounts({}); setTotalTouched(false); setTotal(''); })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [personId, base?.year, base?.month]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectable = (m) => m.remaining > 0 && !m.closed;
  const selMonths = months.filter((m) => selected.includes(pIndex(m.year, m.month)));
  const sumRemaining = selMonths.reduce((s, m) => s + m.remaining, 0);
  const effectiveTotal = totalTouched ? Number(total || 0) : sumRemaining;

  const result = useMemo(() => {
    if (!selMonths.length) return { allocations: [], error: 'Select at least one future month.' };
    if (manual) {
      const allocations = selMonths.map((m) => ({ year: m.year, month: m.month, amount: Number(manualAmounts[pIndex(m.year, m.month)] ?? m.remaining) }));
      const bad = allocations.find((a, i) => !(a.amount > 0) || a.amount > selMonths[i].remaining);
      if (bad) return { allocations, error: `${monthLabel(bad.year, bad.month)}: amount must be between 1 and ${money(selMonths[allocations.indexOf(bad)].remaining)}.` };
      const sum = allocations.reduce((s, a) => s + a.amount, 0);
      if (Math.abs(sum - effectiveTotal) > 0.005) {
        return { allocations, error: sum > effectiveTotal ? `Allocated ${money(sum)} is more than the advance amount ${money(effectiveTotal)}.` : `${money(effectiveTotal - sum)} of the advance is not assigned to a month.` };
      }
      return { allocations, error: null };
    }
    if (!(effectiveTotal > 0)) return { allocations: [], error: 'Enter the advance amount.' };
    const r = autoAllocate(effectiveTotal, selMonths);
    if (r.unallocated > 0) return { allocations: r.allocations, error: `${money(r.unallocated)} is more than the selected months need. Select another month or lower the amount.` };
    const unused = selMonths.filter((m) => !r.allocations.find((a) => a.year === m.year && a.month === m.month));
    if (unused.length) return { allocations: r.allocations, error: `The amount does not reach ${unused.map((m) => m.label).join(', ')}. Unselect it or raise the amount.` };
    return { allocations: r.allocations, error: null };
  }, [selMonths.map((m) => pIndex(m.year, m.month)).join(','), manual, JSON.stringify(manualAmounts), effectiveTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onChange?.({ total: effectiveTotal, allocations: result.allocations, error: result.error }); }, [effectiveTotal, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (m) => {
    const i = pIndex(m.year, m.month);
    setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i].sort((a, b) => a - b)));
  };
  const applyNext = () => {
    const n = Math.max(0, Math.min(12, Number(nMonths) || 0));
    setSelected(months.filter(selectable).slice(0, n).map((m) => pIndex(m.year, m.month)));
    setTotalTouched(false);
  };

  if (!personId) return <p className="text-sm text-slate-500">Select a person first.</p>;
  if (!base) return <p className="text-sm text-slate-500">Enter a valid payment date first.</p>;
  if (loadError) return <p className="text-sm text-st-pend">{loadError}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Quick select" hint="Picks the next months that still need payment" className="w-44">
          <div className="flex gap-2">
            <Input type="number" min="1" max="12" placeholder="Months" value={nMonths} onChange={(e) => setNMonths(e.target.value)} />
            <Button type="button" variant="secondary" onClick={applyNext} disabled={!nMonths}>Apply</Button>
          </div>
        </Field>
        <Field label="Advance amount (Rs.)" hint={totalTouched ? <button type="button" className="link" onClick={() => setTotalTouched(false)}>Use total of selected months</button> : 'Fills automatically from the selected months'} className="w-56">
          <Input type="number" min="1" step="any" inputMode="decimal" value={totalTouched ? total : sumRemaining || ''} onChange={(e) => { setTotal(e.target.value); setTotalTouched(true); }} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600 pb-6">
          <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} className="h-4 w-4 accent-navy-800" />
          Set amount per month manually
        </label>
      </div>

      <div>
        <p className="label">Apply advance to</p>
        {loading ? <p className="text-sm text-slate-500 py-3">Loading months…</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {months.map((m) => {
              const i = pIndex(m.year, m.month);
              const on = selected.includes(i);
              const can = selectable(m);
              const alloc = result.allocations.find((a) => a.year === m.year && a.month === m.month);
              return (
                <div key={i} className={cx('flex items-center gap-3 rounded-lg border px-3 py-2.5 transition', on ? 'border-st-adv/40 bg-st-advbg/60' : 'border-line', !can && 'opacity-60')}>
                  <button type="button" disabled={!can} onClick={() => toggle(m)} aria-pressed={on}
                    className={cx('h-5 w-5 rounded border grid place-items-center shrink-0', on ? 'bg-st-adv border-st-adv text-white' : 'border-slate-300 bg-white')}>
                    {on && <Check size={14} />}
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => can && toggle(m)}>
                    <div className="text-sm font-medium text-ink">{m.label}</div>
                    <div className="text-xs text-slate-500">
                      {m.closed ? <span className="inline-flex items-center gap-1"><Lock size={11} />Closed</span>
                        : m.remaining <= 0 ? (STATUS_STYLE[m.status]?.label || 'Covered')
                        : m.covered > 0 ? `${money(m.remaining)} left of ${money(m.required)}` : `Due ${money(m.remaining)}`}
                    </div>
                  </div>
                  {on && (manual ? (
                    <Input type="number" min="1" step="any" className="w-28 h-8 py-1 text-right num" value={manualAmounts[i] ?? m.remaining}
                      onChange={(e) => setManualAmounts((a) => ({ ...a, [i]: e.target.value }))} aria-label={`Amount for ${m.label}`} />
                  ) : (
                    <span className="num text-sm font-medium text-st-adv">{alloc ? money(alloc.amount) : '—'}</span>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {result.allocations.length > 0 && !result.error && (
        <div className="rounded-lg bg-slate-50 border border-line px-4 py-3 text-sm">
          <span className="text-slate-500">Applied to: </span>
          <span className="font-medium text-ink">{result.allocations.map((a) => `${monthLabel(a.year, a.month)} — ${money(a.amount)}`).join(', ')}</span>
        </div>
      )}
      {result.error && selMonths.length > 0 && <p className="text-sm text-st-part">{result.error}</p>}
    </div>
  );
}
