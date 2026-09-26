'use client';
import { useState } from 'react';
import { Download, Printer, FileBarChart2 } from 'lucide-react';
import { useApi, downloadUrl } from '@/components/api-client';
import { useYear } from '@/components/year-context';
import { useActions } from '@/components/AdminShell';
import PersonPicker from '@/components/PersonPicker';
import { PageHeader, Card, Button, Select, Field, Spinner, ErrorBox, EmptyState, StatusBadge, Tabs, cx } from '@/components/ui';
import { money, fmtDate, fmtDateTime } from '@/lib/format';
import { MONTHS } from '@/lib/dates';

const TYPES = [
  { value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }, { value: 'person', label: 'Person-wise' },
  { value: 'advance', label: 'Advance' }, { value: 'pending', label: 'Pending' }, { value: 'closing', label: 'Closing' },
];

function cell(v, type) {
  if (type === 'money') return v === null || v === undefined || v === '' ? '' : money(v);
  if (type === 'date') return v ? fmtDate(v) : '—';
  if (type === 'datetime') return v ? fmtDateTime(v) : '—';
  if (type === 'status') return <StatusBadge status={v} />;
  return v === null || v === undefined || v === '' ? '—' : String(v);
}

export default function ReportsPage() {
  const { year, current } = useYear();
  const actions = useActions();
  const [type, setType] = useState('monthly');
  const [month, setMonth] = useState(String(current.year === year ? current.month : 1));
  const [personId, setPersonId] = useState(null);
  const [status, setStatus] = useState('');
  const [personStatus, setPersonStatus] = useState('');
  const [marital, setMarital] = useState('');
  const [advStatus, setAdvStatus] = useState('');

  const usesMonth = ['monthly', 'advance', 'pending', 'closing'].includes(type);
  const usesPerson = ['person', 'advance', 'monthly', 'annual', 'pending'].includes(type);
  const params = new URLSearchParams({ type, year: String(year) });
  if (usesMonth && month) params.set('month', month);
  if (usesPerson && personId) params.set('personId', String(personId));
  if (type === 'monthly' && status) params.set('status', status);
  if (['monthly', 'annual', 'pending'].includes(type)) { if (personStatus) params.set('personStatus', personStatus); if (marital) params.set('marital', marital); }
  if (type === 'advance' && advStatus) params.set('advStatus', advStatus);
  const needsPerson = type === 'person' && !personId;
  const qs = params.toString();
  const { data, error, loading } = useApi(needsPerson ? null : `/api/admin/reports?${qs}`, [actions.version]);

  const numeric = (t) => t === 'money';
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Every report is calculated from the same ledger rules as the dashboard. Exports match what you see."
        actions={<>
          <Button variant="secondary" icon={Download} disabled={needsPerson} onClick={() => downloadUrl(`/api/admin/export?${qs}&format=csv`)}>CSV</Button>
          <Button variant="secondary" icon={Download} disabled={needsPerson} onClick={() => downloadUrl(`/api/admin/export?${qs}&format=xlsx`)}>Excel</Button>
          <Button variant="secondary" icon={Printer} disabled={needsPerson} onClick={() => window.print()}>Print / PDF</Button>
        </>} />

      <div className="no-print space-y-4">
        <Tabs tabs={TYPES} value={type} onChange={setType} className="w-fit max-w-full" />
        <div className="card p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {usesMonth && (
            <Field label={type === 'pending' ? 'Up to month' : 'Month'}>
              <Select value={month} onChange={(e) => setMonth(e.target.value)}>
                {type !== 'monthly' && <option value="">{type === 'pending' ? 'All due months' : 'All months'}</option>}
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m} {year}</option>)}
              </Select>
            </Field>
          )}
          {usesPerson && <Field label={type === 'person' ? 'Person *' : 'Person'}><div className="flex gap-2"><div className="flex-1"><PersonPicker value={personId} onChange={setPersonId} /></div>{personId && type !== 'person' && <Button variant="ghost" size="sm" className="h-10" onClick={() => setPersonId(null)}>All</Button>}</div></Field>}
          {type === 'monthly' && (
            <Field label="Payment status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option><option value="paid">Paid</option><option value="advance_paid">Advance paid</option><option value="partial">Partially paid</option><option value="pending">Pending</option><option value="upcoming">Not started</option>
              </Select>
            </Field>
          )}
          {['monthly', 'annual', 'pending'].includes(type) && (<>
            <Field label="Person status"><Select value={personStatus} onChange={(e) => setPersonStatus(e.target.value)}><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
            <Field label="Marital status"><Select value={marital} onChange={(e) => setMarital(e.target.value)}><option value="">All</option><option value="married">Married</option><option value="unmarried">Unmarried</option></Select></Field>
          </>)}
          {type === 'advance' && <Field label="Advance status"><Select value={advStatus} onChange={(e) => setAdvStatus(e.target.value)}><option value="">All</option><option value="active">Active</option><option value="cancelled">Cancelled</option></Select></Field>}
        </div>
      </div>

      <Card className="print-full" bodyClass="p-0">
        {needsPerson ? <EmptyState icon={FileBarChart2} title="Choose a person" text="The person-wise report shows one person's full ledger for the year." />
          : error ? <div className="p-4"><ErrorBox>{error}</ErrorBox></div>
            : loading && !data ? <Spinner /> : data && (
              <>
                <div className="px-5 py-4 border-b border-line">
                  <h2 className="text-lg font-semibold">{data.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{data.rows.length} rows · generated {fmtDateTime(new Date())}{data.note ? ` · ${data.note}` : ''}</p>
                </div>
                {!data.rows.length ? <EmptyState title="No rows for these filters" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr>{data.columns.map((c) => <th key={c.key} className={cx('th', numeric(c.type) && 'text-right')}>{c.label}</th>)}</tr></thead>
                      <tbody>
                        {data.rows.map((r, i) => (
                          <tr key={i} className={cx('hover:bg-slate-50/70', (r.person_id || r.advance_id) && 'cursor-pointer')}
                            onClick={() => r.advance_id ? actions.openAdvanceDetail(r.advance_id) : r.person_id && (r.month || month) && type !== 'annual' ? actions.openMonth({ personId: r.person_id, year, month: Number(r.month || month) }) : r.person_id && window.location.assign(`/admin/people/${r.person_id}`)}>
                            {data.columns.map((c) => <td key={c.key} className={cx('td', numeric(c.type) && 'text-right num')}>{cell(r[c.key], c.type)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                      {data.totals && (
                        <tfoot><tr className="bg-slate-50 font-semibold">
                          {data.columns.map((c, i) => <td key={c.key} className={cx('td', numeric(c.type) && 'text-right num')}>{i === 0 ? 'Total' : c.key in data.totals ? money(data.totals[c.key]) : ''}</td>)}
                        </tr></tfoot>
                      )}
                    </table>
                  </div>
                )}
              </>
            )}
      </Card>
    </div>
  );
}
