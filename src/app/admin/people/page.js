'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Pencil, Trash2, Users, CornerDownRight } from 'lucide-react';
import { api, useApi } from '@/components/api-client';
import { useYear } from '@/components/year-context';
import { useActions } from '@/components/AdminShell';
import { useToast } from '@/components/toast';
import { invalidatePeople } from '@/components/PersonPicker';
import PersonFormModal from '@/components/PersonFormModal';
import { PageHeader, Card, Button, Input, Select, Spinner, ErrorBox, EmptyState, Pagination, ConfirmDialog, Money, cx } from '@/components/ui';
import { money, matchesSearch } from '@/lib/format';
import { shortLabel } from '@/lib/dates';

export default function PeoplePage() {
  const { year } = useYear();
  const { version, changed } = useActions();
  const toast = useToast();
  const { data, error, loading } = useApi(`/api/admin/ledger?year=${year}`, [version]);
  const [q, setQ] = useState('');
  const [marital, setMarital] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState(null); // {person?}
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => (data?.rows || []).filter((r) =>
    matchesSearch(r.person, q) && (!marital || r.person.marital_status === marital) && (!status || r.person.status === status)
  ), [data, q, marital, status]);
  const nextSr = data?.rows?.length ? Math.max(...data.rows.map((r) => r.person.sr_no)) + 1 : 1;
  const shown = rows.slice((page - 1) * pageSize, page * pageSize);

  const doDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/admin/people/${del.id}`, { method: 'DELETE' });
      invalidatePeople(); toast(`${del.name} deleted`); setDel(null); changed();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="People" subtitle="Everyone on the ledger. There is no limit on how many people you can add."
        actions={<Button icon={Plus} onClick={() => setForm({})}>Add person</Button>} />

      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-line">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search name, father name, account or Sr#" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search people" />
          </div>
          <Select className="w-auto" value={marital} onChange={(e) => { setMarital(e.target.value); setPage(1); }} aria-label="Marital status">
            <option value="">Married &amp; unmarried</option><option value="married">Married</option><option value="unmarried">Unmarried</option>
          </Select>
          <Select className="w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
            <option value="">Active &amp; inactive</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </Select>
        </div>

        <ErrorBox>{error}</ErrorBox>
        {loading && !data ? <Spinner /> : !rows.length ? (
          <EmptyState icon={Users} title={data?.rows?.length ? 'No one matches these filters' : 'No people yet'}
            text={data?.rows?.length ? 'Try a different search or clear the filters.' : 'Add the first person to start the ledger, or load demo data from Settings.'}
            action={!data?.rows?.length && <Button icon={Plus} onClick={() => setForm({})}>Add person</Button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>
                  {['Sr#', 'Name', 'Father name', 'Status', 'Marital', 'Split cash', 'Account', 'Monthly amount', 'Advance status', `Pending ${year}`, ''].map((h, i) => (
                    <th key={i} className={cx('th', [5, 7, 9].includes(i) && 'text-right')}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {shown.map(({ person: p, summary, advanceStatus: a }) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="td num text-slate-500">{p.sr_no}</td>
                      <td className="td"><Link href={`/admin/people/${p.id}`} className="font-medium text-ink hover:underline">{p.name}</Link></td>
                      <td className="td text-slate-600">{p.father_name}</td>
                      <td className="td"><span className={cx('rounded-full px-2 py-0.5 text-xs font-medium', p.status === 'active' ? 'bg-st-paidbg text-st-paid' : 'bg-slate-100 text-slate-500')}>{p.status === 'active' ? 'Active' : 'Inactive'}</span></td>
                      <td className="td text-slate-600">{p.marital_status === 'married' ? 'Married' : 'Unmarried'}</td>
                      <td className="td text-right"><Money v={p.split_cash} /></td>
                      <td className="td num text-slate-600">{p.account || '—'}</td>
                      <td className="td text-right font-medium"><Money v={p.monthly_amount} /></td>
                      <td className="td">
                        {a.hasAdvance
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-st-advbg text-st-adv px-2 py-0.5 text-xs font-medium" title={`${money(a.amount)} across ${a.months} future month(s)`}><CornerDownRight size={12} />Paid through {shortLabel(a.through.year, a.through.month)}</span>
                          : <span className="text-xs text-slate-400">No advance</span>}
                      </td>
                      <td className={cx('td text-right', summary.pendingTotal > 0 ? 'text-st-pend font-medium' : 'text-slate-400')}><Money v={summary.pendingTotal} /></td>
                      <td className="td text-right">
                        <div className="inline-flex gap-1">
                          <Button variant="ghost" size="xs" icon={Pencil} onClick={() => setForm({ person: p })} aria-label={`Edit ${p.name}`} title="Edit" />
                          <Button variant="ghost" size="xs" icon={Trash2} className="hover:text-st-pend" onClick={() => setDel(p)} aria-label={`Delete ${p.name}`} title="Delete" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          </>
        )}
      </Card>

      {form && <PersonFormModal person={form.person} nextSr={nextSr} onClose={() => setForm(null)} onSaved={changed} />}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={doDelete} loading={busy} variant="danger" title={`Delete ${del?.name}?`} confirmLabel="Delete permanently" requireText="DELETE">
        <p>This permanently removes {del?.name} with all of their monthly records, payments and advances. Closing snapshots already taken keep their figures.</p>
        <p>If this person has simply left, consider marking them <b>Inactive</b> instead — their history is kept and no new dues are charged.</p>
      </ConfirmDialog>
    </div>
  );
}
