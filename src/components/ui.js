'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Loader2, ChevronLeft, ChevronRight, Inbox, CornerDownRight } from 'lucide-react';
import { money } from '@/lib/format';

export function cx(...a) { return a.filter(Boolean).join(' '); }

// ---------------------------------------------------------------- Button
const VARIANTS = {
  primary: 'bg-navy-900 text-white hover:bg-navy-800 shadow-sm',
  secondary: 'bg-white text-ink border border-line hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-ink',
  danger: 'bg-st-pend text-white hover:bg-[#a8322d]',
  success: 'bg-st-paid text-white hover:bg-[#0b7a54]',
  subtle: 'bg-slate-100 text-ink hover:bg-slate-200',
};
export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className, ...props }) {
  const sz = size === 'sm' ? 'h-8 px-3 text-[13px] gap-1.5' : size === 'xs' ? 'h-7 px-2 text-xs gap-1' : 'h-10 px-4 text-sm gap-2';
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx('inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap', VARIANTS[variant], sz, className)}
    >
      {loading ? <Loader2 size={size === 'md' ? 16 : 14} className="animate-spin" /> : Icon ? <Icon size={size === 'md' ? 16 : 14} /> : null}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Card & stats
export function Card({ title, subtitle, actions, children, className, bodyClass, ...rest }) {
  return (
    <section className={cx('card', className)} {...rest}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cx(title || actions ? 'px-5 pb-5' : 'p-5', bodyClass)}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, tone = 'default', icon: Icon }) {
  const tones = {
    default: 'text-ink',
    green: 'text-st-paid',
    red: 'text-st-pend',
    violet: 'text-st-adv',
    blue: 'text-st-cur',
  };
  return (
    <div className="card px-4 py-4 flex flex-col gap-1 min-w-0">
      <div className="flex items-center justify-between gap-2 text-[13px] text-slate-500">
        <span className="truncate">{label}</span>
        {Icon && <Icon size={16} className="text-slate-400 shrink-0" />}
      </div>
      <div className={cx('num text-[22px] leading-7 font-semibold truncate', tones[tone])}>{value}</div>
      {hint && <div className="text-xs text-slate-500 truncate">{hint}</div>}
    </div>
  );
}

export const Money = ({ v, className }) => <span className={cx('num', className)}>{money(v)}</span>;

// ---------------------------------------------------------------- Status badge
export const STATUS_STYLE = {
  paid: { cls: 'bg-st-paidbg text-st-paid', label: 'Paid', short: 'Paid' },
  current_paid: { cls: 'bg-st-curbg text-st-cur', label: 'Paid', short: 'Paid' },
  advance_paid: { cls: 'bg-st-paidbg text-st-paid', label: 'Advance Paid', short: 'Adv' },
  partial: { cls: 'bg-st-partbg text-st-part', label: 'Partially Paid', short: 'Part' },
  pending: { cls: 'bg-st-pendbg text-st-pend', label: 'Pending', short: 'Due' },
  upcoming: { cls: 'bg-st-nonebg text-st-none', label: 'Not Started', short: '—' },
  na: { cls: 'bg-transparent text-slate-300', label: 'N/A', short: 'n/a' },
};
const DOT = { paid: 'bg-st-paid', current_paid: 'bg-st-cur', advance_paid: 'bg-st-paid', partial: 'bg-st-part', pending: 'bg-st-pend', upcoming: 'bg-st-none', na: 'bg-slate-300' };

export function effectiveStatus(m) {
  return m.status === 'paid' && m.isCurrent ? 'current_paid' : m.status;
}

export function StatusBadge({ status, withAdvance, className }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.na;
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', s.cls, className)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', DOT[status])} />
      {s.label}
      {withAdvance && <span className="ml-0.5 rounded-full bg-st-advbg text-st-adv px-1.5 text-[11px]">+ Advance</span>}
    </span>
  );
}

/** Compact cell for the 12-month grid. */
export function MonthCell({ m, onClick, title }) {
  const st = effectiveStatus(m);
  const s = STATUS_STYLE[st] || STATUS_STYLE.na;
  const tip = title || `${s.label}${m.required ? ` — due ${money(m.required)}` : ''}${m.covered ? `, received ${money(m.covered)}` : ''}${m.advanceGivenAmount ? `, advance given ${money(m.advanceGivenAmount)}` : ''}${m.closed ? ' (closed)' : ''}`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={tip}
      aria-label={tip}
      className={cx('relative w-[52px] h-7 rounded-md text-[11px] font-semibold transition hover:ring-2 hover:ring-navy-600/20', s.cls, st === 'na' && 'border border-dashed border-slate-200')}
    >
      {st === 'advance_paid' ? <span className="inline-flex items-center gap-0.5"><CornerDownRight size={11} />Adv</span> : s.short}
      {m.advanceGivenAmount > 0 && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-st-adv ring-2 ring-white" />}
      {m.closed && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-[2px] w-4 rounded bg-current opacity-40" />}
    </button>
  );
}

export function Legend() {
  const items = [
    ['paid', 'Paid'], ['current_paid', 'Current month paid'], ['advance_paid', 'Advance paid'],
    ['partial', 'Partially paid'], ['pending', 'Pending'], ['upcoming', 'Not started'],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
      {items.map(([k, l]) => (
        <span key={k} className="inline-flex items-center gap-1.5"><span className={cx('h-2.5 w-2.5 rounded-sm', DOT[k])} />{l}</span>
      ))}
      <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-st-adv" />Advance given this month</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-[2px] w-3 bg-slate-500" />Month closed</span>
    </div>
  );
}

// ---------------------------------------------------------------- Forms
export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs text-st-pend">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}
export const Input = ({ className, ...p }) => <input className={cx('input', className)} {...p} />;
export const Select = ({ className, children, ...p }) => <select className={cx('input pr-8', className)} {...p}>{children}</select>;
export const Textarea = ({ className, ...p }) => <textarea className={cx('input min-h-[72px]', className)} {...p} />;

export function ErrorBox({ children }) {
  if (!children) return null;
  return <div role="alert" className="rounded-lg border border-st-pend/25 bg-st-pendbg px-3.5 py-2.5 text-sm text-st-pend">{children}</div>;
}

// ---------------------------------------------------------------- Modal
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector('input,select,textarea,button:not([data-close])')?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-navy-950/45 animate-fade" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className={cx('relative w-full bg-white sm:rounded-2xl rounded-t-2xl shadow-pop animate-pop flex flex-col max-h-[92vh]', w)}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-line">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-ink">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button data-close onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-line flex flex-wrap justify-end gap-2 bg-slate-50/60 sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', variant = 'primary', loading, requireText }) {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (!open) setTyped(''); }, [open]);
  const blocked = requireText && typed !== requireText;
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={variant} onClick={onConfirm} loading={loading} disabled={blocked}>{confirmLabel}</Button></>}>
      <div className="text-sm text-slate-600 space-y-3">{children}</div>
      {requireText && (
        <Field label={`Type ${requireText} to confirm`} className="mt-4">
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- misc
export function Spinner({ label = 'Loading…' }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />{label}</div>;
}

export function EmptyState({ title, text, action, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="h-11 w-11 rounded-full bg-slate-100 grid place-items-center text-slate-400 mb-3"><Icon size={20} /></div>
      <p className="font-medium text-ink">{title}</p>
      {text && <p className="text-sm text-slate-500 mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1', className)} role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cx('px-3 h-8 rounded-md text-[13px] font-medium whitespace-nowrap transition', value === t.value ? 'bg-white text-ink shadow-card' : 'text-slate-500 hover:text-ink')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-slate-500">
      <span className="num">{from}–{to} of {total}</span>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <select className="input h-8 py-0 w-auto" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page">
            {[25, 50, 100, 250].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        )}
        <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" />
        <span className="num text-ink">{page} / {pages}</span>
        <Button variant="secondary" size="sm" icon={ChevronRight} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page" />
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-8 font-semibold text-ink tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </div>
  );
}
