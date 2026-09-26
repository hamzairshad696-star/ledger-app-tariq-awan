'use client';
import { useEffect, useState } from 'react';
import { api } from './api-client';
import { useToast } from './toast';
import { useYear } from './year-context';
import { MONTHS, monthLabel } from '@/lib/dates';
import { money } from '@/lib/format';
import { Modal, Field, Input, Select, Textarea, Button, ErrorBox, StatusBadge, effectiveStatus } from './ui';
import PersonPicker from './PersonPicker';
import AdvanceAllocator from './AdvanceAllocator';

export default function PaymentModal({ personId: p0, year: y0, month: m0, onClose, onSaved }) {
  const { today, current, year: selYear, years } = useYear();
  const toast = useToast();
  const [personId, setPersonId] = useState(p0 || '');
  const [year, setYear] = useState(y0 || selYear);
  const [month, setMonth] = useState(m0 || (selYear === current.year ? current.month : 1));
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [withAdvance, setWithAdvance] = useState(false);
  const [alloc, setAlloc] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!personId) { setLedger(null); return; }
    let live = true;
    api(`/api/admin/people/${personId}/ledger?year=${year}`).then((d) => live && setLedger(d)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [personId, year]);

  const cell = ledger?.months?.[month - 1];
  useEffect(() => { if (cell) setAmount(cell.remaining > 0 ? String(cell.remaining) : ''); }, [cell?.remaining, personId, year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocked = cell && (cell.closed || cell.remaining <= 0);
  const save = async () => {
    setError('');
    if (!personId) return setError('Select a person.');
    if (withAdvance && alloc?.error) return setError(`Advance: ${alloc.error}`);
    setSaving(true);
    try {
      await api('/api/admin/payments', {
        method: 'POST',
        body: {
          person_id: personId, year, month, amount: Number(amount), payment_date: date, method, reference, notes,
          advance: withAdvance ? { total_amount: alloc.total, allocations: alloc.allocations, notes: '' } : null,
        },
      });
      toast(withAdvance ? `Payment for ${monthLabel(year, month)} and advance saved` : `Payment saved for ${monthLabel(year, month)}`);
      onSaved?.();
      onClose();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title="Add payment" subtitle="Record money received for a specific month."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving} disabled={!personId || blocked || !(Number(amount) > 0)}>{withAdvance ? 'Save payment and advance' : 'Save payment'}</Button></>}>
      <div className="space-y-5">
        <Field label="Person"><PersonPicker value={personId} onChange={(id) => setPersonId(id)} /></Field>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Month">
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select>
          </Field>
          <Field label="Year">
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select>
          </Field>
          <Field label="Amount (Rs.)"><Input type="number" min="1" step="any" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Payment date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>

        {cell && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-slate-50 border border-line px-4 py-3 text-sm">
            <StatusBadge status={effectiveStatus(cell)} />
            <span className="text-slate-500">Due <b className="num text-ink font-semibold">{money(cell.baseRequired)}</b></span>
            <span className="text-slate-500">Received <b className="num text-ink font-semibold">{money(cell.covered)}</b></span>
            <span className="text-slate-500">Remaining <b className="num text-ink font-semibold">{money(cell.remaining)}</b></span>
            {cell.closed && <span className="text-st-pend">This month is closed. Reopen it from Closings to add payments.</span>}
            {!cell.closed && cell.remaining <= 0 && <span className="text-st-paid">Already fully paid{cell.advanceCovered > 0 ? ' by advance' : ''}.</span>}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="cheque">Cheque</option><option value="online">Online</option><option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Reference (optional)"><Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} /></Field>
        </div>
        <Field label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></Field>

        <div className="rounded-xl border border-line">
          <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 accent-navy-800" checked={withAdvance} onChange={(e) => setWithAdvance(e.target.checked)} />
            <span className="text-sm"><b className="font-semibold text-ink">Also received an advance</b> <span className="text-slate-500">for months after {monthLabel(year, month)}</span></span>
          </label>
          {withAdvance && (
            <div className="px-4 pb-4 pt-1 border-t border-line">
              <div className="pt-4">
                <AdvanceAllocator personId={personId} paymentDate={date} afterPeriod={{ year, month }} onChange={setAlloc} />
              </div>
            </div>
          )}
        </div>
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Modal>
  );
}
