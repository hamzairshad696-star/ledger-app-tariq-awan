'use client';
import { useState } from 'react';
import { KeyRound, CalendarPlus, Download, Database, Trash2, History } from 'lucide-react';
import { api, useApi, downloadUrl } from '@/components/api-client';
import { useYear } from '@/components/year-context';
import { useActions } from '@/components/AdminShell';
import { useToast } from '@/components/toast';
import { invalidatePeople } from '@/components/PersonPicker';
import { PageHeader, Card, Button, Field, Input, Select, ErrorBox, ConfirmDialog, Spinner } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';

const TABLES = ['people', 'monthly_ledger', 'payments', 'advances', 'advance_allocations', 'monthly_closings', 'closing_events', 'viewers', 'viewer_assignments', 'ledger_years'];

function PasswordCard() {
  const toast = useToast();
  const [f, setF] = useState({ current_password: '', new_password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setError('');
    if (f.new_password.length < 8) return setError('New password must be at least 8 characters.');
    if (f.new_password !== f.confirm) return setError('The new passwords do not match.');
    setBusy(true);
    try {
      await api('/api/admin/settings/password', { method: 'POST', body: { current_password: f.current_password, new_password: f.new_password } });
      toast('Password changed. Other sessions have been signed out.');
      setF({ current_password: '', new_password: '', confirm: '' });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <Card title="Admin password" subtitle="Changing it signs out every other session.">
      <form onSubmit={save} className="space-y-3">
        <ErrorBox>{error}</ErrorBox>
        <Field label="Current password"><Input type="password" autoComplete="current-password" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="New password"><Input type="password" autoComplete="new-password" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} /></Field>
          <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
        </div>
        <Button type="submit" icon={KeyRound} loading={busy}>Change password</Button>
      </form>
    </Card>
  );
}

function YearsCard() {
  const { years, refreshYears, setYear } = useYear();
  const toast = useToast();
  const next = Math.max(...years) + 1;
  const [y, setY] = useState(String(next));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setError(''); setBusy(true);
    try {
      await api('/api/admin/years', { method: 'POST', body: { year: Number(y) } });
      await refreshYears(); setYear(Number(y)); toast(`${y} added`); setY(String(Number(y) + 1));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Card title="Ledger years" subtitle="Add a year to start its twelve months for everyone.">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">{years.map((x) => <span key={x} className="rounded-md bg-slate-100 px-2.5 py-1 text-sm num font-medium">{x}</span>)}</div>
        <ErrorBox>{error}</ErrorBox>
        <div className="flex gap-2 items-end">
          <Field label="Year" className="w-32"><Input type="number" min="2000" max="2100" value={y} onChange={(e) => setY(e.target.value)} /></Field>
          <Button icon={CalendarPlus} onClick={add} loading={busy}>Add year</Button>
        </div>
      </div>
    </Card>
  );
}

function BackupCard() {
  const [table, setTable] = useState('people');
  return (
    <Card title="Backup & export" subtitle="Download all data: people, payments, advances and their month allocations, monthly ledger, closings and viewers.">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button icon={Download} onClick={() => downloadUrl('/api/admin/export?type=backup&format=xlsx')}>Full backup (Excel)</Button>
          <Button variant="secondary" icon={Download} onClick={() => downloadUrl('/api/admin/export?type=backup&format=json')}>Full backup (JSON)</Button>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <Field label="Single table as CSV" className="w-56"><Select value={table} onChange={(e) => setTable(e.target.value)}>{TABLES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</Select></Field>
          <Button variant="secondary" icon={Download} onClick={() => downloadUrl(`/api/admin/export?type=backup&format=csv&table=${table}`)}>Download CSV</Button>
        </div>
      </div>
    </Card>
  );
}

function DataCard() {
  const toast = useToast();
  const { changed } = useActions();
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await api('/api/admin/settings/data', { method: 'POST', body: confirm === 'clear' ? { action: 'clear', confirmText: 'DELETE' } : { action: 'load-demo' } });
      invalidatePeople();
      toast(confirm === 'clear' ? 'All ledger data deleted' : `Demo data loaded${r.people ? ` (${r.people} people)` : ''}`);
      setConfirm(null); changed();
    } catch (e) { toast(e.message, 'error'); setConfirm(null); } finally { setBusy(false); }
  };
  return (
    <Card title="Demo data" subtitle="Load 40 sample people with realistic scenarios for testing, then clear everything before real use.">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={Database} onClick={() => setConfirm('demo')}>Load demo data</Button>
        <Button variant="danger" icon={Trash2} onClick={() => setConfirm('clear')}>Delete all ledger data</Button>
      </div>
      <p className="text-xs text-slate-500 mt-3">Demo data can only be loaded into an empty ledger. Deleting removes people, payments, advances, closings and viewer accounts; the Admin account stays. Download a backup first.</p>
      <ConfirmDialog open={confirm === 'demo'} onClose={() => setConfirm(null)} onConfirm={run} loading={busy} title="Load demo data?" confirmLabel="Load demo data">
        <p>Adds 40 sample people (25 married, 15 unmarried) with payments, advances, partial payments and closed months, plus a demo viewer account.</p>
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'clear'} onClose={() => setConfirm(null)} onConfirm={run} loading={busy} variant="danger" requireText="DELETE" title="Delete all ledger data?" confirmLabel="Delete everything">
        <p>This permanently deletes every person, payment, advance, closing and viewer. It cannot be undone.</p>
      </ConfirmDialog>
    </Card>
  );
}

function AuditCard() {
  const { version } = useActions();
  const { data, loading } = useApi('/api/admin/audit?limit=40', [version]);
  return (
    <Card title="Activity log" subtitle="Every change made in the app.">
      {loading && !data ? <Spinner /> : data?.entries.length ? (
        <ul className="space-y-2.5 max-h-80 overflow-y-auto pr-2">
          {data.entries.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm"><History size={15} className="mt-0.5 text-slate-400 shrink-0" /><div><p>{e.summary}</p><p className="text-xs text-slate-500">{fmtDateTime(e.created_at)} · {e.user_name}</p></div></li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-500">No activity yet.</p>}
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Security, years, backups and demo data." />
      <div className="grid lg:grid-cols-2 gap-6">
        <PasswordCard />
        <YearsCard />
        <BackupCard />
        <DataCard />
      </div>
      <AuditCard />
    </div>
  );
}
