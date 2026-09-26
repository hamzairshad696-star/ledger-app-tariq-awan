'use client';
import { useState } from 'react';
import { api } from './api-client';
import { useToast } from './toast';
import { invalidatePeople } from './PersonPicker';
import { Modal, Button, Field, Input, Select, Textarea, ErrorBox } from './ui';

const EMPTY = {
  sr_no: '', name: '', father_name: '', status: 'active', marital_status: '', split_cash: '0',
  account: '', monthly_amount: '', joining_date: '', notes: '', apply_amount_to_open_months: true,
};

/** Add Person / Edit Person. `person` = existing record for edit, otherwise a new record. */
export default function PersonFormModal({ person, nextSr, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!person;
  const [f, setF] = useState(() => (person ? {
    ...EMPTY, ...person,
    sr_no: String(person.sr_no ?? ''), split_cash: String(person.split_cash ?? 0), monthly_amount: String(person.monthly_amount ?? ''),
    joining_date: person.joining_date || '', notes: person.notes || '', account: person.account || '',
  } : { ...EMPTY, sr_no: nextSr ? String(nextSr) : '' }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Name is required.';
    if (!f.father_name.trim()) e.father_name = 'Father name is required.';
    if (!f.marital_status) e.marital_status = 'Choose Married or Unmarried.';
    if (f.monthly_amount === '' || Number.isNaN(Number(f.monthly_amount))) e.monthly_amount = 'Monthly amount is required.';
    else if (Number(f.monthly_amount) < 0) e.monthly_amount = 'Amount cannot be negative.';
    if (f.split_cash !== '' && Number(f.split_cash) < 0) e.split_cash = 'Amount cannot be negative.';
    if (f.sr_no !== '' && (!Number.isInteger(Number(f.sr_no)) || Number(f.sr_no) <= 0)) e.sr_no = 'Sr# must be a positive whole number.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    setError('');
    if (!validate()) return;
    setBusy(true);
    const payload = {
      ...f,
      sr_no: f.sr_no === '' ? null : Number(f.sr_no),
      split_cash: Number(f.split_cash || 0),
      monthly_amount: Number(f.monthly_amount),
      joining_date: f.joining_date || null,
    };
    for (const k of ['id', 'created_at', 'updated_at', 'viewer_count', 'next_sr']) delete payload[k];
    try {
      const r = editing
        ? await api(`/api/admin/people/${person.id}`, { method: 'PUT', body: payload })
        : await api('/api/admin/people', { method: 'POST', body: payload });
      invalidatePeople();
      toast(editing ? `${f.name} updated` : `${f.name} added`);
      onSaved?.(r.person);
      onClose();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const amountChanged = editing && Number(f.monthly_amount) !== Number(person.monthly_amount);

  return (
    <Modal open onClose={onClose} size="lg" title={editing ? `Edit ${person.name}` : 'Add person'}
      subtitle={editing ? `Sr# ${person.sr_no}` : 'A 12-month ledger is created automatically for every year.'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>{editing ? 'Save changes' : 'Add person'}</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <ErrorBox>{error}</ErrorBox>
        <div className="grid sm:grid-cols-[110px_1fr_1fr] gap-4">
          <Field label="Sr#" error={errors.sr_no} hint={!editing ? 'Auto' : undefined}><Input type="number" min="1" value={f.sr_no} onChange={set('sr_no')} /></Field>
          <Field label="Name *" error={errors.name}><Input value={f.name} onChange={set('name')} autoComplete="off" /></Field>
          <Field label="Father name *" error={errors.father_name}><Input value={f.father_name} onChange={set('father_name')} autoComplete="off" /></Field>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Status"><Select value={f.status} onChange={set('status')}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
          <Field label="Marital status *" error={errors.marital_status}>
            <Select value={f.marital_status} onChange={set('marital_status')}><option value="">Select…</option><option value="married">Married</option><option value="unmarried">Unmarried</option></Select>
          </Field>
          <Field label="Joining / starting date" hint="Months before this are not charged"><Input type="date" value={f.joining_date || ''} onChange={set('joining_date')} /></Field>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Monthly amount (Rs.) *" error={errors.monthly_amount}><Input type="number" min="0" step="any" value={f.monthly_amount} onChange={set('monthly_amount')} /></Field>
          <Field label="Split cash (Rs.)" error={errors.split_cash}><Input type="number" min="0" step="any" value={f.split_cash} onChange={set('split_cash')} /></Field>
          <Field label="Account"><Input value={f.account} onChange={set('account')} autoComplete="off" /></Field>
        </div>
        {amountChanged && (
          <label className="flex items-start gap-2.5 rounded-lg bg-st-partbg/60 border border-st-part/20 px-3.5 py-2.5 text-sm">
            <input type="checkbox" className="mt-0.5" checked={f.apply_amount_to_open_months} onChange={set('apply_amount_to_open_months')} />
            <span>Apply the new monthly amount to open months from the current month onward. Closed months and past months keep their amounts.</span>
          </label>
        )}
        <Field label="Notes"><Textarea value={f.notes} onChange={set('notes')} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
