'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, Unlock, CalendarCheck2, CornerDownRight, History, Search } from 'lucide-react';
import { api, useApi } from '@/components/api-client';
import { useYear } from '@/components/year-context';
import { useActions } from '@/components/AdminShell';
import { useToast } from '@/components/toast';
import { PageHeader, Card, Button, Spinner, ErrorBox, StatusBadge, ConfirmDialog, Modal, Field, Textarea, Input, Tabs, Money, cx } from '@/components/ui';
import { money, fmtDate, fmtDateTime, matchesSearch } from '@/lib/format';
import { MONTHS } from '@/lib/dates';

const STATE = {
  closed: { label: 'Closed', cls: 'bg-navy-900 text-white', icon: Lock },
  current: { label: 'Current month', cls: 'bg-st-curbg text-st-cur', icon: CalendarCheck2 },
  open: { label: 'Open', cls: 'bg-st-partbg text-st-part', icon: Unlock },
  future: { label: 'Not started', cls: 'bg-slate-100 text-slate-500', icon: null },
};

function Figure({ label, value, tone }) {
  return <div className="rounded-lg bg-slate-50 px-3.5 py-2.5"><div className="text-xs text-slate-500">{label}</div><div className={cx('num text-lg font-semibold', tone)}>{value}</div></div>;
}

function SummaryFigures({ s }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      <Figure label="Total people" value={s.people} />
      <Figure label="Paid" value={s.paidCount} tone="text-st-paid" />
      <Figure label="Pending" value={s.pendingCount + (s.upcomingCount || 0) + s.partialCount} tone="text-st-pend" />
      <Figure label="Advance given" value={money(s.advanceGiven)} tone="text-st-adv" />
      <Figure label="Total collected" value={money(s.collected)} />
      <Figure label="Pending amount" value={money(s.pending)} tone={s.pending ? 'text-st-pend' : ''} />
    </div>
  );
}

function MonthRows({ rows, year, onOpen }) {
  const [q, setQ] = useState('');
  const list = rows.filter((r) => r.status !== 'na' && matchesSearch({ ...r, account: '' }, q));
  return (
    <div className="space-y-3">
      <div className="relative max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Find a person" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="overflow-x-auto rounded-lg border border-line max-h-[420px]">
        <table className="w-full">
          <thead className="sticky top-0"><tr><th className="th">Sr#</th><th className="th">Name</th><th className="th text-right">Due</th><th className="th text-right">Paid</th><th className="th text-right">By advance</th><th className="th">Advance given</th><th className="th text-right">Pending</th><th className="th">Status</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.person_id} className={cx('hover:bg-slate-50/70', onOpen && 'cursor-pointer')} onClick={() => onOpen?.(r.person_id)}>
                <td className="td num text-slate-500">{r.sr_no}</td><td className="td font-medium">{r.name}</td>
                <td className="td text-right"><Money v={r.required} /></td><td className="td text-right"><Money v={r.paid} /></td>
                <td className="td text-right text-st-paid"><Money v={r.advanceCovered} /></td>
                <td className="td text-sm">{r.advanceGiven > 0 ? <span className="text-st-adv"><b className="num">{money(r.advanceGiven)}</b> for {r.advanceGivenFor.map((x) => x.label).join(' + ')}</span> : <span className="text-slate-300">—</span>}</td>
                <td className={cx('td text-right', r.pending ? 'text-st-pend font-medium' : 'text-slate-400')}><Money v={r.pending} /></td>
                <td className="td"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpeningView({ opening, onOpen }) {
  const [q, setQ] = useState('');
  const [only, setOnly] = useState('all');
  const s = opening.summary;
  const rows = opening.rows.filter((r) => matchesSearch({ ...r, father_name: '', account: '' }, q) && r.months[0].status !== 'na'
    && (only === 'all' || (only === 'ahead' ? r.months[0].status === 'advance_paid' : ['pending', 'upcoming', 'partial'].includes(r.months[0].status))));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Figure label="Already paid by advance" value={s.alreadyByAdvance} tone="text-st-paid" />
        <Figure label="Already paid directly" value={s.alreadyPaid} tone="text-st-paid" />
        <Figure label="Partially paid" value={s.partial} tone="text-st-part" />
        <Figure label="Still to collect" value={s.open} tone="text-st-pend" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={only} onChange={setOnly} tabs={[{ value: 'all', label: 'Everyone' }, { value: 'ahead', label: 'Paid in advance' }, { value: 'open', label: 'Still to collect' }]} />
        <div className="relative flex-1 min-w-[180px] max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Find a person" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line max-h-[460px]">
        <table className="w-full">
          <thead className="sticky top-0"><tr><th className="th">Sr#</th><th className="th">Name</th>{opening.periods.map((p) => <th key={p.label} className="th">{p.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.person_id} className="hover:bg-slate-50/70 cursor-pointer" onClick={() => onOpen(r.person_id, opening.periods[0])}>
                <td className="td num text-slate-500">{r.sr_no}</td><td className="td font-medium">{r.name}</td>
                {r.months.map((m, i) => (
                  <td key={i} className="td">
                    <StatusBadge status={m.status} />
                    {m.advanceSources.length > 0 && <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1"><CornerDownRight size={11} />advance of {fmtDate(m.advanceSources[0].paidOn)}</div>}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && <tr><td className="td text-center text-slate-500" colSpan={5}>No one in this view.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ClosingsPage() {
  const { year } = useYear();
  const actions = useActions();
  const toast = useToast();
  const { data, error, loading, reload } = useApi(`/api/admin/closings?year=${year}`, [actions.version]);
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [dErr, setDErr] = useState('');
  const [tab, setTab] = useState('month');
  const [confirm, setConfirm] = useState(null); // 'close' | 'reopen'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    if (!sel || sel.year !== year) {
      // Default: most recent month that is not closed yet and has started, else the current month.
      const firstOpen = data.months.find((m) => m.state === 'open') || data.months.find((m) => m.state === 'current') || data.months[0];
      setSel({ year, month: firstOpen.month });
    }
  }, [data, year]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDetail = async () => {
    if (!sel) return;
    setDErr('');
    try { setDetail(await api(`/api/admin/closings/${sel.year}/${sel.month}`)); } catch (e) { setDErr(e.message); }
  };
  useEffect(() => { setDetail(null); loadDetail(); }, [sel?.year, sel?.month, actions.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async () => {
    setBusy(true);
    try {
      await api(`/api/admin/closings/${sel.year}/${sel.month}`, { method: 'POST', body: { action: confirm, confirm: true, reason } });
      toast(confirm === 'close' ? `${MONTHS[sel.month - 1]} ${sel.year} closed` : `${MONTHS[sel.month - 1]} ${sel.year} reopened`);
      setConfirm(null); setReason('');
      if (confirm === 'close') setTab('opening');
      actions.changed(); reload();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (loading && !data) return <Spinner />;
  const selMonth = data.months.find((m) => m.month === sel?.month);
  const closed = detail?.record?.is_closed;
  const shown = closed ? detail.record.snapshot : detail?.live;
  const openPerson = (personId, p = sel) => actions.openMonth({ personId, year: p.year, month: p.month });

  return (
    <div className="space-y-6">
      <PageHeader title="Monthly closing" subtitle="Close a month to lock its payments. The closing figures are kept permanently. Reopening needs a confirmation and a reason." />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {data.months.map((m) => {
          const st = STATE[m.state];
          const active = sel?.month === m.month;
          return (
            <button key={m.month} onClick={() => { setSel({ year, month: m.month }); setTab('month'); }}
              className={cx('card text-left px-4 py-3.5 transition hover:shadow-pop', active && 'ring-2 ring-navy-700')}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{MONTHS[m.month - 1]}</span>
                {st.icon && <st.icon size={15} className={m.state === 'closed' ? 'text-navy-800' : 'text-slate-400'} />}
              </div>
              <span className={cx('mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium', st.cls)}>{st.label}</span>
              {m.state !== 'future' && <div className="mt-2 text-xs text-slate-500 num">{m.summary.paidCount}/{m.summary.people} paid</div>}
            </button>
          );
        })}
      </div>

      {sel && (
        <Card title={<span className="flex items-center gap-2">{MONTHS[sel.month - 1]} {sel.year}{closed && <span className="rounded-full bg-navy-900 text-white text-xs px-2.5 py-0.5 font-medium">CLOSED</span>}</span>}
          subtitle={closed ? `Closed ${fmtDateTime(detail.record.closed_at)} by ${detail.record.closed_by_name}. Figures below are the permanent closing snapshot.` : selMonth?.state === 'future' ? 'This month has not started yet.' : 'Live figures — these will be saved when you close the month.'}
          actions={detail && selMonth?.state !== 'future' && (closed
            ? <Button variant="secondary" icon={Unlock} onClick={() => setConfirm('reopen')}>Reopen month</Button>
            : <Button icon={Lock} onClick={() => setConfirm('close')}>Close {MONTHS[sel.month - 1]}</Button>)}>
          <ErrorBox>{dErr}</ErrorBox>
          {!detail && !dErr ? <Spinner /> : detail && (
            <div className="space-y-5">
              <Tabs value={tab} onChange={setTab} className="w-fit" tabs={[
                { value: 'month', label: closed ? 'Closing snapshot' : 'Closing preview' },
                { value: 'opening', label: `${detail.next.label} opening` },
                { value: 'history', label: 'History' },
              ]} />
              {tab === 'month' && (<><SummaryFigures s={shown.summary} /><MonthRows rows={shown.rows} year={sel.year} onOpen={(pid) => openPerson(pid)} /></>)}
              {tab === 'opening' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">What is already settled as <b>{detail.next.label}</b> opens — including months already paid through earlier advances.</p>
                  <OpeningView opening={detail.opening} onOpen={openPerson} />
                </div>
              )}
              {tab === 'history' && (
                detail.events.length ? (
                  <ul className="space-y-3">
                    {detail.events.map((e) => (
                      <li key={e.id} className="flex gap-3 text-sm">
                        <History size={16} className="mt-0.5 text-slate-400" />
                        <div><p className="text-ink">{e.action === 'close' ? 'Closed' : 'Reopened'} by {e.user_name}{e.reason && <> — “{e.reason}”</>}</p><p className="text-xs text-slate-500">{fmtDateTime(e.created_at)}</p></div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-slate-500">This month has never been closed.</p>
              )}
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog open={confirm === 'close'} onClose={() => setConfirm(null)} onConfirm={act} loading={busy} title={`Close ${MONTHS[sel?.month - 1]} ${sel?.year}?`} confirmLabel="Close month">
        {detail && <>
          <div className="grid grid-cols-2 gap-2">
            <Figure label="Total people" value={detail.live.summary.people} />
            <Figure label="Paid" value={detail.live.summary.paidCount} tone="text-st-paid" />
            <Figure label="Pending" value={detail.live.summary.people - detail.live.summary.paidCount} tone="text-st-pend" />
            <Figure label="Advance given" value={money(detail.live.summary.advanceGiven)} tone="text-st-adv" />
            <Figure label="Total collected" value={money(detail.live.summary.collected)} />
            <Figure label="Pending amount" value={money(detail.live.summary.pending)} />
          </div>
          <p>After closing, payments, advances and amounts for this month are locked. You can reopen it later with a reason.</p>
        </>}
      </ConfirmDialog>

      <Modal open={confirm === 'reopen'} onClose={() => setConfirm(null)} size="sm" title={`Reopen ${MONTHS[sel?.month - 1]} ${sel?.year}?`}
        footer={<><Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="danger" onClick={act} loading={busy} disabled={reason.trim().length < 3}>Reopen month</Button></>}>
        <div className="space-y-3 text-sm text-slate-600">
          <p>Reopening unlocks this month for changes. The original closing snapshot stays in the history.</p>
          <Field label="Reason (required)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Payment for Sr# 12 was entered in the wrong month" /></Field>
        </div>
      </Modal>
    </div>
  );
}
