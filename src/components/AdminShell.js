'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Table2, CalendarClock, AlertCircle, Lock, UserCog, FileBarChart2, Settings, LogOut, Menu, X, Banknote,
} from 'lucide-react';
import { YearProvider, useYear } from './year-context';
import { ToastProvider } from './toast';
import { api } from './api-client';
import { cx, Button } from './ui';
import PaymentModal from './PaymentModal';
import AdvanceModal from './AdvanceModal';
import MonthDetailModal from './MonthDetailModal';
import AdvanceDetailModal from './AdvanceDetailModal';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/people', label: 'People', icon: Users },
  { href: '/admin/ledger', label: 'Monthly Ledger', icon: Table2 },
  { href: '/admin/advances', label: 'Advances', icon: CalendarClock },
  { href: '/admin/pending', label: 'Pending', icon: AlertCircle },
  { href: '/admin/closings', label: 'Closings', icon: Lock },
  { href: '/admin/viewers', label: 'Viewers', icon: UserCog },
  { href: '/admin/reports', label: 'Reports', icon: FileBarChart2 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

// ---- global actions (any page can open the payment/advance/month/advance-detail modals)
const ActionsCtx = createContext(null);
export const useActions = () => useContext(ActionsCtx);

function ActionsProvider({ children }) {
  const [modal, setModal] = useState(null); // {type, props}
  const [version, setVersion] = useState(0);
  const changed = useCallback(() => setVersion((v) => v + 1), []);
  const close = useCallback(() => setModal(null), []);
  const value = {
    version,
    changed,
    openPayment: (props = {}) => setModal({ type: 'payment', props }),
    openAdvance: (props = {}) => setModal({ type: 'advance', props }),
    openMonth: (props) => setModal({ type: 'month', props }),
    openAdvanceDetail: (id) => setModal({ type: 'advanceDetail', props: { id } }),
  };
  return (
    <ActionsCtx.Provider value={value}>
      {children}
      {modal?.type === 'payment' && <PaymentModal {...modal.props} onClose={close} onSaved={changed} />}
      {modal?.type === 'advance' && <AdvanceModal {...modal.props} onClose={close} onSaved={changed} />}
      {modal?.type === 'month' && <MonthDetailModal {...modal.props} onClose={close} />}
      {modal?.type === 'advanceDetail' && <AdvanceDetailModal {...modal.props} onClose={close} onChanged={changed} />}
    </ActionsCtx.Provider>
  );
}

function YearSelect() {
  const { years, year, setYear } = useYear();
  return (
    <label className="flex items-center gap-2 text-sm text-slate-500">
      <span className="hidden sm:inline">Year</span>
      <select className="input h-9 py-0 w-[92px] font-semibold num" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Select year">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  );
}

function SidebarContent({ user, onNavigate }) {
  const path = usePathname();
  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  };
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-white/10 grid place-items-center ring-1 ring-white/15">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M5 4h2v14h12v2H5z" fill="#fff" /><path d="M9 13h2v3H9zm4-4h2v7h-2zm4-3h2v10h-2z" fill="#34D399" /></svg>
          </div>
          <div className="leading-tight">
            <div className="text-white font-semibold text-[15px]">Ledger</div>
            <div className="text-[12px] text-slate-400">Monthly accounts</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5" aria-label="Main">
        {NAV.map((n) => {
          const active = n.exact ? path === n.href : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} onClick={onNavigate}
              className={cx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors', active ? 'bg-white/[0.09] text-white font-medium' : 'text-slate-300/90 hover:bg-white/[0.05] hover:text-white')}>
              <n.icon size={18} className={active ? 'text-emerald-300' : 'text-slate-400'} />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <div className="px-3 py-2">
          <div className="text-sm text-white font-medium truncate">{user.name}</div>
          <div className="text-xs text-slate-400">Administrator</div>
        </div>
        <button onClick={logout} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] text-slate-300 hover:bg-white/[0.05] hover:text-white">
          <LogOut size={18} className="text-slate-400" /> Logout
        </button>
      </div>
    </div>
  );
}

function Topbar({ onMenu }) {
  const actions = useActions();
  return (
    <header className="app-top sticky top-0 z-30 bg-paper/85 backdrop-blur border-b border-line">
      <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 h-16">
        <button className="lg:hidden rounded-lg p-2 -ml-2 text-slate-600 hover:bg-slate-200/60" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
        <YearSelect />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={CalendarClock} onClick={() => actions.openAdvance()} className="hidden sm:inline-flex">Add advance</Button>
          <Button size="sm" icon={Banknote} onClick={() => actions.openPayment()}><span className="hidden sm:inline">Add payment</span><span className="sm:hidden">Payment</span></Button>
        </div>
      </div>
    </header>
  );
}

export default function AdminShell({ user, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <ToastProvider>
      <YearProvider>
        <ActionsProvider>
          <div className="min-h-screen lg:pl-[248px]">
            <aside className="hidden lg:block fixed inset-y-0 left-0 w-[248px] bg-navy-900 bg-[linear-gradient(180deg,#0E1F3D_0%,#0B1934_100%)]">
              <SidebarContent user={user} />
            </aside>
            {mobileOpen && (
              <div className="lg:hidden fixed inset-0 z-50">
                <div className="absolute inset-0 bg-navy-950/50 animate-fade" onClick={() => setMobileOpen(false)} />
                <aside className="absolute inset-y-0 left-0 w-[268px] bg-navy-900 animate-pop">
                  <button className="absolute right-3 top-5 p-1.5 text-slate-300 hover:text-white" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={20} /></button>
                  <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} />
                </aside>
              </div>
            )}
            <Topbar onMenu={() => setMobileOpen(true)} />
            <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1600px]">{children}</main>
          </div>
        </ActionsProvider>
      </YearProvider>
    </ToastProvider>
  );
}

