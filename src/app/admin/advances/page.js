'use client';
import { useMemo, useState } from 'react';
import { Plus, Search, CalendarClock, ArrowUpRight } from 'lucide-react';
import { useApi } from '@/components/api-client';
import { useYear } from '@/components/year-context';
import { useActions } from '@/components/AdminShell';
import { PageHeader, Card, Button, Input, Select, Spinner, ErrorBox, EmptyState, StatCard, Pagination, cx } from '@/components/ui';
import { money, fmtDate } from '@/lib/format';
import { MONTHS, MONTHS_SHORT } from '@/lib/dates';

export default function AdvancesPage() {
  const { year } = useYear();
  const actions = useActions();
  const { data, error, loading } = useApi(`/api/admin/advances?year=${year}`, [actions.version]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const list = useMemo(() => (data?.advances || []).filter((a) => {
    if (status && a.status !== status) return false;
    if (month) {
      const m = Number(month);
      if (!(a.paid_in_year === year && a.paid_in_month === m) && !a.allocations.some((x) => x.year === year && x.month === m)) return false;
    }
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!(a.person_name.toLowerCase().includes(s) || (a.father_name || '').toLowerCase().includes(s) || String(a.sr_no) === s)) return false;
    }
    return true;
  }), [data, q, status, month, year]);

  const active = (data?.advances || []).filter((a) => a.status === 'active');
  const intoYear = active.reduce((t, a) => t + a.allocations.filter((x) => x.year === year).reduce((u, x) => u + x.amount, 0), 0);
  const receivedYear = active.filter((a) => a.paid_in_year === year).reduce((t, a) => t + a.total_amount, 0);
  const people = new Set(active.map((a) => a.person_id)).size;
  const shown = list.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader title="Advances" subtitle="Every advance and the exact future months it pays for."
        actions={<Button icon={Plus} onClick={() => actions.openAdvance()}>Add advance</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={`Advances received in ${year}`} value={money(receivedYear)} tone="violet" />
        <StatCard label={`Allocated into ${year} months`} value={money(intoYear)} tone="green" hint="The dashboard's Total Advance" />
        <StatCard label="Active advances" value={active.length} />
        <StatCard label="People with advances" value={people} />
      </div>

      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-line">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search name, father name or Sr#" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search advances" />
          </div>
          <Select className="w-auto" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} aria-label="Month">
            <option value="">All months</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>Received in or covering {m}</option>)}
          </Select>
          <Select className="w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
            <option value="active">Active</option><option value="cancelled">Cancelled</option><option value="">All</option>
          </Select>
        </div>
        <ErrorBox>{error}</ErrorBox>
        {loading && !data ? <Spinner /> : !list.length ? (
          <EmptyState icon={CalendarClock} title="No advances found" text="Advances you record appear here with the months they cover." action={<Button icon={Plus} onClick={() => actions.openAdvance()}>Add advance</Button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>
                  <th className="th">Paid on</th><th className="th">Sr#</th><th className="th">Person</th><th className="th text-right">Amount</th>
                  <th className="th">Applied to</th><th className="th">Status</th><th className="th"></th>
                </tr></thead>
                <tbody>
                  {shown.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70 cursor-pointer" onClick={() => actions.openAdvanceDetail(a.id)}>
                      <td className="td">{fmtDate(a.payment_date)}</td>
                      <td className="td num text-slate-500">{a.sr_no}</td>
                      <td className="td"><span className="font-medium">{a.person_name}</span> <span className="text-slate-400 text-xs">s/o {a.father_name}</span></td>
                      <td className="td text-right num font-semibold text-st-adv">{money(a.total_amount)}</td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1">
                          {a.allocations.map((x) => (
                            <span key={`${x.year}-${x.month}`} className="rounded-md bg-st-paidbg text-st-paid px-1.5 py-0.5 text-xs font-medium num" title={money(x.amount)}>
                              {MONTHS_SHORT[x.month - 1]}{x.year !== year ? ` ${x.year}` : ''} · {money(x.amount).replace('Rs. ', '')}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="td"><span className={cx('rounded-full px-2 py-0.5 text-xs font-medium', a.status === 'active' ? 'bg-st-paidbg text-st-paid' : 'bg-slate-100 text-slate-500')}>{a.status === 'active' ? 'Active' : 'Cancelled'}</span></td>
                      <td className="td text-slate-400"><ArrowUpRight size={15} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={list.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          </>
        )}
      </Card>
    </div>
  );
}
