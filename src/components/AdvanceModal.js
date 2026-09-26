'use client';
import { useState } from 'react';
import { api } from './api-client';
import { useToast } from './toast';
import { useYear } from './year-context';
import { Modal, Field, Input, Textarea, Button, ErrorBox } from './ui';
import PersonPicker from './PersonPicker';
import AdvanceAllocator from './AdvanceAllocator';

export default function AdvanceModal({ personId: initialPerson, onClose, onSaved }) {
  const { today } = useYear();
  const toast = useToast();
  const [personId, setPersonId] = useState(initialPerson || '');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [alloc, setAlloc] = useState({ total: 0, allocations: [], error: 'Select at least one future month.' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (!personId) return setError('Select a person.');
    if (alloc.error) return setError(alloc.error);
    setSaving(true);
    try {
      const r = await api('/api/admin/advances', { method: 'POST', body: { person_id: personId, payment_date: date, total_amount: alloc.total, allocations: alloc.allocations, notes } });
      toast(`Advance saved — applied to ${r.advance.appliedTo}`);
      onSaved?.();
      onClose();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title="Add advance" subtitle="Money received now for specific future months. Each month is marked Advance Paid automatically."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving} disabled={!!alloc.error || !personId}>Save advance</Button></>}>
      <div className="space-y-5">
        <div className="grid sm:grid-cols-[1fr_180px] gap-4">
          <Field label="Person"><PersonPicker value={personId} onChange={(id) => setPersonId(id)} /></Field>
          <Field label="Payment date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <AdvanceAllocator personId={personId} paymentDate={date} onChange={setAlloc} />
        <Field label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></Field>
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Modal>
  );
}
