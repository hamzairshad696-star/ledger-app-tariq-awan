'use client';
import Link from 'next/link';
import { Users, Heart, User, Wallet, CalendarClock, AlertCircle, Scale, Lock, CornerDownRight, ChevronRight } from 'lucide-react';
import { useApi } from '@/components/api-client';
import { useYear } from '@/components/year-context';
import { useActions } from '@/components/AdminShell';
import { PageHeader, StatCard, Card, Spinner, ErrorBox, Button, cx } from '@/components/ui';
import { MonthlyCollectionChart } from '@/components/Charts';
import { money, num, fmtDateTime } from '@/lib/format';
import { MONTHS, monthLabel } from '@/lib/dates';

function Bar({ parts }) {
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      {parts.map((p) => p.v > 0 && <div key={p.k} className={p.c} style={{ width: `${(p.v / total) * 100}%` }} title={`${p.k}: ${p.v}`} />)}
    </div>
  );
}

export default function Dashboard() {
  const { year } = useYear();
  const { version, openPayment, openAdvance } = useActions();
  const { data: d, error, loading } = useApi(`/api/admin/dashboard?year=${year}`, [version]);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (loading && !d) return <Spinner />;
  const f = d.focus;
  const focusLabel = monthLabel(year, d.focusMonth);
  const closing = d.closings[d.focusMonth - 1];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={`Overview for ${year}. Figures are calculated live from every payment and advance.`}
        actions={<><Button variant="secondary" icon={CalendarClock} onClick={() => openAdvance()}>Add advance</Button><Button icon={Wallet} onClick={() => openPayment()}>Add payment</Button></>} />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <StatCard label="Total people" value={num(d.counts.total)} hint={`${d.counts.active} active, ${d.counts.inactive} inactive`} icon={Users} />
        <StatCard label="Married" value={num(d.counts.married)} icon={Heart} />
        <StatCard label="Unmarried" value={num(d.counts.unmarried)} icon={User} />
        <StatCard label="Total monthly amount" value={money(d.totalMonthlyAmount)} hint="Active people, per month" icon={Wallet} />
        <StatCard label="Total advance" value={money(d.totals.advanceTotal)} hint={`Allocated into ${year}`} tone="violet" icon={CalendarClock} />
        <StatCard label="Total pending" value={money(d.totals.pendingTotal)} hint="Due and not yet paid" tone="red" icon={AlertCircle} />
        <StatCard label="Net total" value={money(d.totals.netTotal)} hint="Paid + advance − pending" tone="green" icon={Scale} />
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-6">
        <Card title="Collection by month" subtitle={`Paid, covered by advance, and pending — ${year}`}>
          <MonthlyCollectionChart monthly={d.monthly} />
        </Card>

        <Card title={focusLabel} subtitle={closing.is_closed ? 'Closed' : d.focusMonth === d.current.month && year === d.current.year ? 'Current month' : 'Open'}
          actions={<Link href="/admin/closings"><Button variant="secondary" size="sm" icon={Lock}>{closing.is_closed ? 'View closing' : 'Close month'}</Button></Link>}>
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm text-slate-500">Settled</span>
                <span className="num text-sm"><b className="text-ink text-lg">{f.paidCount}</b> <span className="text-slate-500">of {f.people}</span></span>
              </div>
              <Bar parts={[
                { k: 'Paid', v: f.paidDirectCount, c: 'bg-st-paid' },
                { k: 'Advance paid', v: f.advancePaidCount, c: 'bg-[#6FCBA5]' },
                { k: 'Partial', v: f.partialCount, c: 'bg-st-part' },
                { k: 'Pending', v: f.pendingCount + f.upcomingCount, c: 'bg-st-pend/70' },
              ]} />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Paid directly', f.paidDirectCount], ['Paid by advance', f.advancePaidCount],
                ['Partially paid', f.partialCount], ['Pending', f.pendingCount + f.upcomingCount],
              ].map(([k, v]) => <div key={k} className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-slate-500 text-xs">{k}</dt><dd className="num font-semibold">{v}</dd></div>)}
            </dl>
            <div className="border-t border-line pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Collected this month</span><b className="num">{money(f.collected)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Advance received</span><b className="num text-st-adv">{money(f.advanceGiven)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Still pending</span><b className="num text-st-pend">{money(f.pending)}</b></div>
            </div>
            <Link href="/admin/ledger" className="flex items-center justify-between text-sm link">Open the monthly ledger <ChevronRight size={16} /></Link>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title={d.aheadNext.month ? `Already paid for ${MONTHS[d.aheadNext.month - 1]}` : 'Already paid ahead'} subtitle="Covered by advances received earlier">
          {d.aheadNext.people.length ? (
            <ul className="divide-y divide-line -mx-1">
              {d.aheadNext.people.slice(0, 8).map((p) => (
                <li key={p.id}><Link href={`/admin/people/${p.id}`} className="flex items-center gap-3 px-1 py-2.5 text-sm hover:bg-slate-50 rounded-md">
                  <CornerDownRight size={15} className="text-st-paid" /><span className="flex-1">{p.name}</span><span className="num text-slate-600">{money(p.amount)}</span>
                </Link></li>
              ))}
              {d.aheadNext.people.length > 8 && <li className="px-1 pt-2.5 text-sm text-slate-500">and {d.aheadNext.people.length - 8} more</li>}
            </ul>
          ) : <p className="text-sm text-slate-500">No advances cover next month yet.</p>}
        </Card>
        <Card title="Recent activity">
          {d.activity.length ? (
            <ul className="space-y-3">
              {d.activity.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className={cx('mt-1.5 h-2 w-2 rounded-full shrink-0', a.action.startsWith('advance') ? 'bg-st-adv' : a.action.startsWith('payment') ? 'bg-st-paid' : a.action.startsWith('month') ? 'bg-navy-600' : 'bg-slate-300')} />
                  <div className="min-w-0"><p className="text-ink">{a.summary}</p><p className="text-xs text-slate-500">{fmtDateTime(a.created_at)}, {a.user_name}</p></div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Nothing recorded yet.</p>}
        </Card>
      </div>
    </div>
  );
}
