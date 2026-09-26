'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Banknote, Download, CheckCircle2, Lock } from 'lucide-react';
import { useApi, downloadUrl } from '@/components/api-client';
import { useYear } from '@/components/year-context';
import { useActions } from '@/components/AdminShell';
import { PageHeader, Card, Button, Input, Select, Spinner, ErrorBox, EmptyState, StatCard, StatusBadge, Money, Tabs } from '@/components/ui';
import { money, matchesSearch } from '@/lib/format';
import { MONTHS, MONTHS_SHORT } from '@/lib/dates';

export default function PendingPage() {
  const { year } = useYear();
  const actions = useActions();
  const [month, setMonth] = useState('');
  const [view, setView] = useState('person');
  const [q, setQ] = useState('');
  const qs = `type=pending&year=${year}${month ? `&month=${month}` : ''}`;
  const { data, error, loading } = useApi(`/api/admin/reports?${qs}`, [actions.version]);

  const rows = useMemo(() => (data?.rows || []).filter((r) => matchesSearch({ ...r, account: '' }, q)), [data, q]);
  const byPerson = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.person_id)) m.set(r.person_id, { person_id: r.person_id, sr_no: r.sr_no, name: r.name, father_name: r.father_name, months: [], pending: 0 });
      const g = m.get(r.person_id);
      g.months.push(r); g.pending += r.pending;
    }
    return [...m.values()].sort((a, b) => b.pending - a.pending);
  }, [rows]);
  const total = rows.reduce((t, r) => t + r.pending, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Pending" subtitle="Amounts that are due and not yet paid or covered by an advance. Future months are not counted until they start."
        actions={<>
          <Button variant="secondary" icon={Download} onClick={() => downloadUrl(`/api/admin/export?${qs}&format=csv`)}>CSV</Button>
          <Button variant="secondary" icon={Download} onClick={() => downloadUrl(`/api/admin/export?${qs}&format=xlsx`)}>Excel</Button>
        </>} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total pending" value={money(total)} tone="red" />
        <StatCard label="People with pending" value={byPerson.length} />
        <StatCard label="Unpaid person-months" value={rows.length} />
      </div>

      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-line">
          <Tabs value={view} onChange={setView} tabs={[{ value: 'person', label: 'By person' }, { value: 'month', label: 'Every month' }]} />
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search name, father name or Sr#" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          </div>
          <Select className="w-auto" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Up to month">
            <option value="">All due months</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>Up to {m}</option>)}
          </Select>
        </div>
        <ErrorBox>{error}</ErrorBox>
        {loading && !data ? <Spinner /> : !rows.length ? (
          <EmptyState icon={CheckCircle2} title="Nothing pending" text="Everyone is paid up for the selected period." />
        ) : view === 'person' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Sr#</th><th className="th">Name</th><th className="th">Unpaid months</th><th className="th text-right">Pending</th><th className="th"></th></tr></thead>
              <tbody>
                {byPerson.map((g) => (
                  <tr key={g.person_id} className="hover:bg-slate-50/70">
                    <td className="td num text-slate-500">{g.sr_no}</td>
                    <td className="td"><Link href={`/admin/people/${g.person_id}`} className="font-medium hover:underline">{g.name}</Link> <span className="text-xs text-slate-400">s/o {g.father_name}</span></td>
                    <td className="td"><div className="flex flex-wrap gap-1">{g.months.map((m) => (
                      <button key={m.month} onClick={() => actions.openMonth({ personId: g.person_id, year, month: m.month })}
                        className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${m.status === 'partial' ? 'bg-st-partbg text-st-part' : 'bg-st-pendbg text-st-pend'}`} title={`${MONTHS[m.month - 1]}: ${money(m.pending)} pending`}>
                        {MONTHS_SHORT[m.month - 1]}
                      </button>
                    ))}</div></td>
                    <td className="td text-right text-st-pend font-semibold"><Money v={g.pending} /></td>
                    <td className="td text-right"><Button size="xs" variant="secondary" icon={Banknote} onClick={() => actions.openPayment({ personId: g.person_id, year, month: g.months[0].month })}>Record payment</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Sr#</th><th className="th">Name</th><th className="th">Month</th><th className="th text-right">Due</th><th className="th text-right">Received</th><th className="th text-right">Pending</th><th className="th">Status</th><th className="th"></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.person_id}-${r.month}`} className="hover:bg-slate-50/70 cursor-pointer" onClick={() => actions.openMonth({ personId: r.person_id, year, month: r.month })}>
                    <td className="td num text-slate-500">{r.sr_no}</td>
                    <td className="td font-medium">{r.name}</td>
                    <td className="td">{r.month_label}{r.closed === 'Closed' && <Lock size={12} className="inline ml-1.5 text-slate-400" />}</td>
                    <td className="td text-right"><Money v={r.required} /></td>
                    <td className="td text-right"><Money v={r.covered} /></td>
                    <td className="td text-right text-st-pend font-medium"><Money v={r.pending} /></td>
                    <td className="td"><StatusBadge status={r.status} /></td>
                    <td className="td text-right" onClick={(e) => e.stopPropagation()}>
                      {r.closed !== 'Closed' && <Button size="xs" variant="secondary" icon={Banknote} onClick={() => actions.openPayment({ personId: r.person_id, year, month: r.month })}>Pay</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
