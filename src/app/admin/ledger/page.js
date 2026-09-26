'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Banknote, CalendarClock, Download, Table2 } from 'lucide-react';
import { useApi, downloadUrl } from '@/components/api-client';
import { useYear } from '@/components/year-context';
import { useActions } from '@/components/AdminShell';
import { PageHeader, Card, Button, Input, Select, Spinner, ErrorBox, EmptyState, Pagination, MonthCell, Legend, Money, cx } from '@/components/ui';
import { matchesSearch, money } from '@/lib/format';
import { MONTHS, MONTHS_SHORT } from '@/lib/dates';

const PAY_FILTERS = [
  ['', 'Any payment status'], ['paid', 'Paid'], ['advance_paid', 'Advance paid'], ['partial', 'Partially paid'],
  ['pending', 'Pending'], ['upcoming', 'Not started'], ['has_advance', 'Advance given (any)'],
];

export default function LedgerPage() {
  const { year } = useYear();
  const actions = useActions();
  const { data, error, loading } = useApi(`/api/admin/ledger?year=${year}`, [actions.version]);
  const [q, setQ] = useState('');
  const [marital, setMarital] = useState('');
  const [pstatus, setPstatus] = useState('');
  const [month, setMonth] = useState('');
  const [pay, setPay] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const focusMonth = month ? Number(month) : (data && data.current.year === year ? data.current.month : null);

  const rows = useMemo(() => (data?.rows || []).filter((r) => {
    if (!matchesSearch(r.person, q)) return false;
    if (marital && r.person.marital_status !== marital) return false;
    if (pstatus && r.person.status !== pstatus) return false;
    if (pay) {
      const cells = focusMonth ? [r.months[focusMonth - 1]] : r.months;
      if (pay === 'has_advance') return cells.some((c) => c.advanceGivenAmount > 0 || c.advanceCovered > 0);
      return cells.some((c) => c.status === pay);
    }
    return true;
  }), [data, q, marital, pstatus, pay, focusMonth]);
  const shown = rows.slice((page - 1) * pageSize, page * pageSize);
  const reset = (fn) => (e) => { fn(e.target.value); setPage(1); };

  return (
    <div className="space-y-6">
      <PageHeader title="Monthly ledger" subtitle={`All people, all twelve months of ${year}. Click any month to see its details.`}
        actions={<>
          <Button variant="secondary" icon={Download} onClick={() => downloadUrl(`/api/admin/export?type=annual&format=xlsx&year=${year}`)}>Excel</Button>
          <Button variant="secondary" icon={CalendarClock} onClick={() => actions.openAdvance()}>Add advance</Button>
          <Button icon={Banknote} onClick={() => actions.openPayment({ year })}>Add payment</Button>
        </>} />

      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-line">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search name, father name, account or Sr#" value={q} onChange={reset(setQ)} aria-label="Search" />
          </div>
          <Select className="w-auto" value={marital} onChange={reset(setMarital)} aria-label="Marital status">
            <option value="">Married &amp; unmarried</option><option value="married">Married</option><option value="unmarried">Unmarried</option>
          </Select>
          <Select className="w-auto" value={pstatus} onChange={reset(setPstatus)} aria-label="Person status">
            <option value="">Active &amp; inactive</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </Select>
          <Select className="w-auto" value={month} onChange={reset(setMonth)} aria-label="Month">
            <option value="">{data?.current.year === year ? `Current month (${MONTHS_SHORT[data.current.month - 1]})` : 'Any month'}</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
          <Select className="w-auto" value={pay} onChange={reset(setPay)} aria-label="Payment status">
            {PAY_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <div className="px-4 py-3 border-b border-line"><Legend /></div>

        <ErrorBox>{error}</ErrorBox>
        {loading && !data ? <Spinner /> : !rows.length ? (
          <EmptyState icon={Table2} title={data?.rows?.length ? 'No one matches these filters' : 'The ledger is empty'} text={data?.rows?.length ? 'Try clearing a filter.' : 'Add people first; their 12 months appear here automatically.'}
            action={!data?.rows?.length && <Link href="/admin/people"><Button>Go to People</Button></Link>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th sticky left-0 z-10 bg-slate-50">Sr#</th>
                    <th className="th sticky left-[52px] z-10 bg-slate-50 min-w-[150px]">Name</th>
                    <th className="th">Father name</th><th className="th">Status</th><th className="th">Marital</th><th className="th text-right">Monthly</th>
                    {MONTHS_SHORT.map((m, i) => (
                      <th key={m} className={cx('th text-center px-1', focusMonth === i + 1 && 'text-navy-800 bg-st-curbg/60')}>
                        {m}{data.closings[i].is_closed && <span className="block text-[10px] font-normal text-slate-400">closed</span>}
                      </th>
                    ))}
                    <th className="th text-right">Advance</th><th className="th text-right">Pending</th><th className="th text-right">Net</th><th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(({ person: p, months, summary: s }) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 group">
                      <td className="td num text-slate-500 sticky left-0 bg-white group-hover:bg-slate-50">{p.sr_no}</td>
                      <td className="td sticky left-[52px] bg-white group-hover:bg-slate-50"><Link href={`/admin/people/${p.id}`} className="font-medium text-ink hover:underline">{p.name}</Link></td>
                      <td className="td text-slate-600">{p.father_name}</td>
                      <td className="td text-xs">{p.status === 'active' ? <span className="text-st-paid">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                      <td className="td text-xs text-slate-600">{p.marital_status === 'married' ? 'Married' : 'Unmarried'}</td>
                      <td className="td text-right"><Money v={p.monthly_amount} /></td>
                      {months.map((m) => (
                        <td key={m.month} className={cx('td px-1 text-center', focusMonth === m.month && 'bg-st-curbg/30')}>
                          <MonthCell m={m} onClick={() => actions.openMonth({ personId: p.id, year, month: m.month })} title={`${p.name}, ${MONTHS[m.month - 1]}`} />
                        </td>
                      ))}
                      <td className="td text-right text-st-adv"><Money v={s.advanceTotal} /></td>
                      <td className={cx('td text-right', s.pendingTotal > 0 ? 'text-st-pend font-medium' : 'text-slate-400')}><Money v={s.pendingTotal} /></td>
                      <td className="td text-right font-medium"><Money v={s.netTotal} /></td>
                      <td className="td">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="xs" icon={Banknote} title="Add payment" aria-label={`Add payment for ${p.name}`} onClick={() => actions.openPayment({ personId: p.id, year, month: focusMonth || undefined })} />
                          <Button variant="ghost" size="xs" icon={CalendarClock} title="Add advance" aria-label={`Add advance for ${p.name}`} onClick={() => actions.openAdvance({ personId: p.id })} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="td sticky left-0 bg-slate-50" colSpan={2}>Totals ({rows.length})</td>
                    <td className="td" colSpan={3}></td>
                    <td className="td text-right"><Money v={rows.filter((r) => r.person.status === 'active').reduce((t, r) => t + Number(r.person.monthly_amount), 0)} /></td>
                    {MONTHS_SHORT.map((m, i) => {
                      const pend = rows.reduce((t, r) => t + r.months[i].pending, 0);
                      return <td key={m} className="td px-1 text-center text-[11px] font-medium" title={`Pending ${money(pend)}`}>{pend > 0 ? <span className="text-st-pend num">{(pend / 1000).toFixed(pend % 1000 ? 1 : 0)}k</span> : <span className="text-slate-300">—</span>}</td>;
                    })}
                    <td className="td text-right text-st-adv"><Money v={rows.reduce((t, r) => t + r.summary.advanceTotal, 0)} /></td>
                    <td className="td text-right text-st-pend"><Money v={rows.reduce((t, r) => t + r.summary.pendingTotal, 0)} /></td>
                    <td className="td text-right"><Money v={rows.reduce((t, r) => t + r.summary.netTotal, 0)} /></td>
                    <td className="td"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          </>
        )}
      </Card>
    </div>
  );
}
