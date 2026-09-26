'use client';
import { LogOut, Eye } from 'lucide-react';
import { api } from './api-client';
import { ToastProvider } from './toast';
import { YearProvider, useYear } from './year-context';

function YearSelect() {
  const { years, year, setYear } = useYear();
  if (years.length < 2) return null;
  return (
    <select className="h-9 rounded-lg border border-white/15 bg-white/10 px-2 text-sm text-white num" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Select year">
      {years.map((y) => <option key={y} value={y} className="text-ink">{y}</option>)}
    </select>
  );
}

export default function ViewerShell({ user, children }) {
  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  };
  return (
    <ToastProvider>
      <YearProvider>
        <div className="min-h-screen">
          <header className="app-top bg-[linear-gradient(180deg,#0E1F3D_0%,#0B1934_100%)] text-white">
            <div className="mx-auto max-w-5xl flex items-center gap-3 px-4 sm:px-6 h-16">
              <div className="h-9 w-9 rounded-lg bg-white/10 grid place-items-center ring-1 ring-white/15">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M5 4h2v14h12v2H5z" fill="#fff" /><path d="M9 13h2v3H9zm4-4h2v7h-2zm4-3h2v10h-2z" fill="#34D399" /></svg>
              </div>
              <div className="leading-tight">
                <div className="font-semibold text-[15px]">Ledger</div>
                <div className="text-[12px] text-slate-400 inline-flex items-center gap-1"><Eye size={12} />Read-only access</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <YearSelect />
                <span className="hidden sm:inline text-sm text-slate-300 px-2">{user.name}</span>
                <button onClick={logout} className="inline-flex items-center gap-2 rounded-lg px-3 h-9 text-sm text-slate-200 hover:bg-white/10"><LogOut size={16} />Logout</button>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">{children}</main>
        </div>
      </YearProvider>
    </ToastProvider>
  );
}
