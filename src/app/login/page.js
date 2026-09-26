'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

const STRIP = [
  { m: 'Mar', s: 'Paid', c: 'bg-emerald-400/90 text-navy-950' },
  { m: 'Apr', s: 'Advance', c: 'bg-emerald-400/25 text-emerald-200 ring-1 ring-emerald-300/40' },
  { m: 'May', s: 'Advance', c: 'bg-emerald-400/25 text-emerald-200 ring-1 ring-emerald-300/40' },
  { m: 'Jun', s: 'Pending', c: 'bg-white/5 text-slate-300 ring-1 ring-white/15' },
];

function LoginForm() {
  const sp = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(sp.get('expired') ? 'Your session ended. Please sign in again.' : '');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) return setError('Enter your username and password.');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Sign in failed.');
      window.location.href = d.redirect;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-ink">Sign in</h1>
        <p className="text-sm text-slate-500 mt-1">Private ledger. Access is by invitation only.</p>
      </div>
      <label className="block">
        <span className="label">Username</span>
        <input className="input h-11" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <div className="relative">
          <input className="input h-11 pr-11" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </label>
      {error && <p role="alert" className="rounded-lg bg-st-pendbg text-st-pend text-sm px-3.5 py-2.5">{error}</p>}
      <button disabled={loading} className="w-full h-11 rounded-lg bg-navy-900 text-white font-medium hover:bg-navy-800 disabled:opacity-60 inline-flex items-center justify-center gap-2">
        {loading && <Loader2 size={16} className="animate-spin" />} Sign in
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="hidden lg:flex flex-col justify-between bg-navy-900 bg-[linear-gradient(160deg,#122850_0%,#0B1934_70%)] p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] bg-[repeating-linear-gradient(0deg,#fff_0,#fff_1px,transparent_1px,transparent_36px)]" aria-hidden="true" />
        <div className="relative flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-white/10 grid place-items-center ring-1 ring-white/15">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M5 4h2v14h12v2H5z" fill="#fff" /><path d="M9 13h2v3H9zm4-4h2v7h-2zm4-3h2v10h-2z" fill="#34D399" /></svg>
          </div>
          <span className="font-semibold">Ledger</span>
        </div>
        <div className="relative max-w-md">
          <p className="text-[34px] leading-[1.15] font-semibold tracking-[-0.015em]">Every rupee tied to the month it pays for.</p>
          <p className="mt-4 text-slate-300 leading-relaxed">Advances paid early are linked to the exact months they cover, so each month opens already knowing what is settled.</p>
          <div className="mt-10 flex gap-2" aria-hidden="true">
            {STRIP.map((x) => (
              <div key={x.m} className={`rounded-lg px-3 py-2.5 w-[88px] ${x.c}`}>
                <div className="text-[13px] font-semibold">{x.m}</div>
                <div className="text-[12px] opacity-90">{x.s}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 ml-[96px] w-[184px] h-3 border-x border-b border-emerald-300/50 rounded-b-md" aria-hidden="true" />
          <p className="mt-2 text-xs text-slate-400">Advance received 15 March, applied to April and May</p>
        </div>
        <p className="relative text-xs text-slate-400">Administered by Tariq Awan</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12 bg-white">
        <Suspense fallback={null}><LoginForm /></Suspense>
      </div>
    </div>
  );
}
