'use client';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, UserCog, Search, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { api, useApi } from '@/components/api-client';
import { useToast } from '@/components/toast';
import { loadPeople } from '@/components/PersonPicker';
import { PageHeader, Card, Button, Input, Field, Modal, ErrorBox, Spinner, EmptyState, ConfirmDialog, cx } from '@/components/ui';
import { fmtDateTime, matchesSearch } from '@/lib/format';

function ViewerForm({ viewer, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!viewer;
  const [f, setF] = useState({ username: viewer?.username || '', name: viewer?.name || '', password: '', is_active: viewer ? viewer.is_active : true });
  const [ids, setIds] = useState(() => new Set((viewer?.people || []).map((p) => p.id)));
  const [people, setPeople] = useState(null);
  const [q, setQ] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadPeople().then(setPeople).catch((e) => setError(e.message)); }, []);
  const list = useMemo(() => (people || []).filter((p) => matchesSearch(p, q)), [people, q]);
  const toggle = (id) => setIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const save = async () => {
    setError('');
    if (f.username.trim().length < 3) return setError('Username must be at least 3 characters.');
    if (!f.name.trim()) return setError('Name is required.');
    if (!editing && f.password.length < 8) return setError('Password must be at least 8 characters.');
    if (editing && f.password && f.password.length < 8) return setError('New password must be at least 8 characters.');
    setBusy(true);
    try {
      const body = { ...f, password: f.password || null, person_ids: [...ids] };
      if (editing) await api(`/api/admin/viewers/${viewer.id}`, { method: 'PUT', body });
      else await api('/api/admin/viewers', { method: 'POST', body });
      toast(editing ? 'Viewer updated' : 'Viewer created');
      onSaved(); onClose();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={editing ? `Edit ${viewer.name}` : 'New viewer'} subtitle="Viewers can only see the people assigned to them, and can never change anything."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>{editing ? 'Save viewer' : 'Create viewer'}</Button></>}>
      <div className="space-y-4">
        <ErrorBox>{error}</ErrorBox>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name *"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="off" /></Field>
          <Field label="Username *" hint="Letters, numbers, dot, dash, underscore"><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="off" autoCapitalize="none" /></Field>
          <Field label={editing ? 'New password' : 'Password *'} hint={editing ? 'Leave blank to keep the current password. Changing it signs the viewer out.' : 'At least 8 characters'}>
            <div className="relative">
              <Input type={showPw ? 'text' : 'password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" className="pr-10" />
              <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-ink" aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </Field>
          <Field label="Account status">
            <label className="flex items-center gap-2.5 h-10 text-sm">
              <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
              {f.is_active ? 'Active — can sign in' : 'Disabled — cannot sign in'}
            </label>
          </Field>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="label mb-0">Assigned people <span className="text-slate-400 font-normal">({ids.size} selected)</span></span>
            {ids.size > 0 && <button className="text-xs link" onClick={() => setIds(new Set())}>Clear</button>}
          </div>
          <div className="relative mb-2"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-line divide-y divide-line">
            {!people ? <Spinner /> : list.map((p) => (
              <label key={p.id} className={cx('flex items-center gap-3 px-3.5 py-2 text-sm cursor-pointer hover:bg-slate-50', ids.has(p.id) && 'bg-st-curbg/40')}>
                <input type="checkbox" checked={ids.has(p.id)} onChange={() => toggle(p.id)} />
                <span className="num text-slate-400 w-8">{p.sr_no}</span>
                <span className="font-medium">{p.name}</span><span className="text-slate-400">s/o {p.father_name}</span>
              </label>
            ))}
            {people && !list.length && <p className="px-3.5 py-3 text-sm text-slate-500">No people found.</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function ViewersPage() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi('/api/admin/viewers');
  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const toggleActive = async (v) => {
    try {
      await api(`/api/admin/viewers/${v.id}`, { method: 'PUT', body: { username: v.username, name: v.name, is_active: !v.is_active, person_ids: v.people.map((p) => p.id) } });
      toast(v.is_active ? `${v.name} disabled` : `${v.name} enabled`); reload();
    } catch (e) { toast(e.message, 'error'); }
  };
  const doDelete = async () => {
    setBusy(true);
    try { await api(`/api/admin/viewers/${del.id}`, { method: 'DELETE' }); toast('Viewer deleted'); setDel(null); reload(); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Viewers" subtitle="Read-only accounts. Each viewer sees only the people you assign to them."
        actions={<Button icon={Plus} onClick={() => setForm({})}>New viewer</Button>} />
      <div className="flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm text-slate-600">
        <ShieldCheck size={18} className="text-st-paid mt-0.5 shrink-0" />
        <p>Permissions are enforced on the server: a viewer cannot open admin pages or APIs, and cannot see an unassigned person even by editing the link. Disabling a viewer or changing their password signs them out immediately.</p>
      </div>
      <Card bodyClass="p-0">
        <ErrorBox>{error}</ErrorBox>
        {loading && !data ? <Spinner /> : !data?.viewers.length ? (
          <EmptyState icon={UserCog} title="No viewers yet" text="Create a viewer account and assign people to it." action={<Button icon={Plus} onClick={() => setForm({})}>New viewer</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">Name</th><th className="th">Username</th><th className="th">Assigned people</th><th className="th">Status</th><th className="th">Last sign-in</th><th className="th"></th></tr></thead>
              <tbody>
                {data.viewers.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70">
                    <td className="td font-medium">{v.name}</td>
                    <td className="td text-slate-600">{v.username}</td>
                    <td className="td whitespace-normal min-w-[220px]">
                      {v.people.length ? <div className="flex flex-wrap gap-1">{v.people.slice(0, 6).map((p) => <span key={p.id} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs">{p.name}</span>)}{v.people.length > 6 && <span className="text-xs text-slate-500">+{v.people.length - 6} more</span>}</div>
                        : <span className="text-xs text-st-part">No one assigned</span>}
                    </td>
                    <td className="td"><button onClick={() => toggleActive(v)} className={cx('rounded-full px-2 py-0.5 text-xs font-medium', v.is_active ? 'bg-st-paidbg text-st-paid' : 'bg-slate-100 text-slate-500')} title="Click to toggle">{v.is_active ? 'Active' : 'Disabled'}</button></td>
                    <td className="td text-slate-500 text-sm">{v.last_login_at ? fmtDateTime(v.last_login_at) : 'Never'}</td>
                    <td className="td text-right">
                      <div className="inline-flex gap-1">
                        <Button variant="ghost" size="xs" icon={Pencil} onClick={() => setForm({ viewer: v })} aria-label={`Edit ${v.name}`} title="Edit" />
                        <Button variant="ghost" size="xs" icon={Trash2} onClick={() => setDel(v)} aria-label={`Delete ${v.name}`} title="Delete" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {form && <ViewerForm viewer={form.viewer} onClose={() => setForm(null)} onSaved={reload} />}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={doDelete} loading={busy} variant="danger" title={`Delete ${del?.name}?`} confirmLabel="Delete viewer">
        <p>The viewer account is removed and signed out. Ledger records are not affected.</p>
      </ConfirmDialog>
    </div>
  );
}
