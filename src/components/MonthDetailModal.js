'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Banknote, Pencil, UserRound } from 'lucide-react';
import { api } from './api-client';
import { useToast } from './toast';
import { useActions } from './AdminShell';
import { monthLabel } from '@/lib/dates';
import { Modal, Button, Spinner, ErrorBox, Field, Input, Textarea, ConfirmDialog } from './ui';
import MonthDetailContent from './MonthDetailContent';
import { money } from '@/lib/format';

export default function MonthDetailModal({ personId, year, month, onClose }) {
  const actions = useActions();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const load = () => api(`/api/admin/people/${personId}/ledger?year=${year}`).then((d) => {
    setData(d);
    const m = d.months[month - 1];
    setAmount(String(m.baseRequired));
    setNotes(m.ledgerNotes || '');
  }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [personId, year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = data?.months?.[month - 1];
  const saveAmount = async () => {
    setBusy(true); setError('');
    try {
      await api('/api/admin/ledger-month', { method: 'PATCH', body: { person_id: personId, year, month, required_amount: Number(amount), notes } });
      toast(`Amount due for ${monthLabel(year, month)} updated`);
      setEditing(false); actions.changed(); await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const deletePayment = async () => {
    setBusy(true); setError('');
    try {
      await api(`/api/admin/payments/${confirmDel.id}`, { method: 'DELETE' });
      toast('Payment deleted'); setConfirmDel(null); actions.changed(); await load();
    } catch (e) { setError(e.message); setConfirmDel(null); } finally { setBusy(false); }
  };

  return (
    <>
      <Modal open onClose={onClose} size="lg" title={data ? `${data.person.name} — ${monthLabel(year, month)}` : monthLabel(year, month)}
        subtitle={data ? `s/o ${data.person.father_name}, Sr# ${data.person.sr_no}` : undefined}
        footer={m && (
          <>
            <Link href={`/admin/people/${personId}`} onClick={onClose}><Button variant="ghost" icon={UserRound}>Open profile</Button></Link>
            {!m.closed && <Button variant="secondary" icon={Pencil} onClick={() => setEditing((e) => !e)}>Edit amount due</Button>}
            {!m.closed && m.remaining > 0 && <Button icon={Banknote} onClick={() => actions.openPayment({ personId, year, month })}>Record payment</Button>}
          </>
        )}>
        {!data && !error && <Spinner />}
        <ErrorBox>{error}</ErrorBox>
        {m && (
          <div className="space-y-5">
            {editing && (
              <div className="rounded-xl border border-line p-4 space-y-3">
                <p className="text-sm text-slate-600">Change the amount due for this one month only. The person&apos;s normal monthly amount is {money(data.person.monthly_amount)}.</p>
                <div className="grid sm:grid-cols-[180px_1fr] gap-3">
                  <Field label="Amount due (Rs.)"><Input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
                  <Field label="Note"><Textarea className="min-h-[40px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
                </div>
                <div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button><Button size="sm" onClick={saveAmount} loading={busy}>Save amount</Button></div>
              </div>
            )}
            <MonthDetailContent m={m} onAdvance={(id) => actions.openAdvanceDetail(id)} onDeletePayment={(p) => setConfirmDel(p)} deleting={busy} />
            {m.ledgerNotes && <p className="text-sm text-slate-500">Note: {m.ledgerNotes}</p>}
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={deletePayment} loading={busy} variant="danger" title="Delete this payment?" confirmLabel="Delete payment">
        <p>{confirmDel && `${money(confirmDel.amount)} paid on ${confirmDel.payment_date} will be removed and ${monthLabel(year, month)} will be recalculated.`}</p>
      </ConfirmDialog>
    </>
  );
}
