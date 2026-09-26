'use client';
import { useEffect, useState } from 'react';
import { api } from './api-client';
import { useToast } from './toast';
import { money, fmtDate, fmtDateTime } from '@/lib/format';
import { Modal, Button, Spinner, ErrorBox, Field, Textarea, cx } from './ui';

const TIMING = { past: 'Already passed', current: 'This month', upcoming: 'Upcoming' };

export default function AdvanceDetailModal({ id, onClose, onChanged }) {
  const toast = useToast();
  const [a, setA] = useState(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api(`/api/admin/advances/${id}`).then((d) => setA(d.advance)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = async () => {
    setBusy(true); setError('');
    try {
      await api(`/api/admin/advances/${id}`, { method: 'POST', body: { action: 'cancel', confirm: true, reason } });
      toast('Advance cancelled — the months it covered are open again');
      onChanged?.(); setCancelling(false); await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Advance details" subtitle={a ? `Advance #${a.id}` : undefined}
      footer={a && (
        <>
          {a.canCancel && !cancelling && <Button variant="ghost" className="text-st-pend mr-auto" onClick={() => setCancelling(true)}>Cancel advance</Button>}
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </>
      )}>
      {!a && !error && <Spinner />}
      <ErrorBox>{error}</ErrorBox>
      {a && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div><dt className="text-slate-500">Person</dt><dd className="font-medium mt-0.5">{a.person_name} <span className="text-slate-500 font-normal">s/o {a.father_name}</span></dd></div>
            <div><dt className="text-slate-500">Payment date</dt><dd className="font-medium mt-0.5">{fmtDate(a.payment_date)}</dd></div>
            <div><dt className="text-slate-500">Total advance</dt><dd className="num text-lg font-semibold text-st-adv">{money(a.total_amount)}</dd></div>
            <div><dt className="text-slate-500">Status</dt><dd className="mt-0.5">
              <span className={cx('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', a.status === 'active' ? 'bg-st-paidbg text-st-paid' : 'bg-slate-100 text-slate-500')}>{a.status === 'active' ? 'Active' : 'Cancelled'}</span>
            </dd></div>
          </dl>
          <div>
            <p className="text-sm font-semibold text-ink mb-2">Allocated months</p>
            <ul className="rounded-lg border border-line divide-y divide-line">
              {a.allocations.map((al) => (
                <li key={al.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="font-medium">{al.label}</span>
                  <span className="text-xs text-slate-500">{TIMING[al.timing]}{al.closed ? ', closed' : ''}</span>
                  <span className="num ml-auto font-medium">{money(al.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500 mt-2">Received in {a.paidInLabel}. Recorded {fmtDateTime(a.created_at)}.</p>
          </div>
          {a.notes && <p className="text-sm text-slate-600">Note: {a.notes}</p>}
          {a.status === 'cancelled' && <p className="text-sm text-slate-500">Cancelled {fmtDateTime(a.cancelled_at)}{a.cancel_reason ? `: ${a.cancel_reason}` : ''}</p>}
          {a.status === 'active' && !a.canCancel && <p className="text-xs text-slate-500">This advance touches a closed month, so it can only be cancelled after that month is reopened.</p>}
          {cancelling && (
            <div className="rounded-xl border border-st-pend/30 bg-st-pendbg/50 p-4 space-y-3">
              <p className="text-sm text-st-pend">Cancelling keeps the record for auditing, but the months above will no longer count as paid.</p>
              <Field label="Reason (optional)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
              <div className="flex justify-end gap-2"><Button variant="secondary" size="sm" onClick={() => setCancelling(false)}>Keep advance</Button><Button variant="danger" size="sm" onClick={cancel} loading={busy}>Cancel advance</Button></div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
