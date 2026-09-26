'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { api } from './api-client';
import { cx } from './ui';

let cache = null;
export function invalidatePeople() { cache = null; }
export async function loadPeople() {
  if (!cache) cache = api('/api/admin/people').then((d) => d.people).catch((e) => { cache = null; throw e; });
  return cache;
}

export default function PersonPicker({ value, onChange, disabled, autoFocus }) {
  const [people, setPeople] = useState([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const box = useRef(null);
  useEffect(() => { loadPeople().then(setPeople).catch(() => {}); }, []);
  useEffect(() => {
    const onDoc = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const selected = people.find((p) => p.id === Number(value));
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const f = s ? people.filter((p) => `${p.sr_no} ${p.name} ${p.father_name} ${p.account}`.toLowerCase().includes(s)) : people;
    return f.slice(0, 60);
  }, [people, q]);
  const pick = (p) => { onChange(p.id, p); setOpen(false); setQ(''); };

  return (
    <div className="relative" ref={box}>
      <button type="button" disabled={disabled} autoFocus={autoFocus} onClick={() => setOpen((o) => !o)}
        className={cx('input flex items-center justify-between text-left', !selected && 'text-slate-400')}>
        <span className="truncate">{selected ? `${selected.sr_no}. ${selected.name} s/o ${selected.father_name}` : 'Select a person'}</span>
        <ChevronDown size={16} className="text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-line bg-white shadow-pop animate-pop">
          <div className="flex items-center gap-2 px-3 border-b border-line">
            <Search size={15} className="text-slate-400" />
            <input autoFocus className="w-full py-2.5 text-sm outline-none" placeholder="Search name, father name, Sr# or account" value={q}
              onChange={(e) => { setQ(e.target.value); setHi(0); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, list.length - 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
                if (e.key === 'Enter' && list[hi]) { e.preventDefault(); pick(list[hi]); }
                if (e.key === 'Escape') setOpen(false);
              }} />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
            {list.map((p, i) => (
              <li key={p.id} role="option" aria-selected={p.id === Number(value)}>
                <button type="button" onMouseEnter={() => setHi(i)} onClick={() => pick(p)}
                  className={cx('w-full text-left px-3 py-2 text-sm flex items-center gap-3', i === hi && 'bg-slate-50')}>
                  <span className="num w-7 text-slate-400">{p.sr_no}</span>
                  <span className="flex-1 truncate"><span className="text-ink font-medium">{p.name}</span> <span className="text-slate-500">s/o {p.father_name}</span></span>
                  {p.status === 'inactive' && <span className="text-xs text-slate-400">Inactive</span>}
                </button>
              </li>
            ))}
            {!list.length && <li className="px-3 py-4 text-sm text-slate-500">No one matches “{q}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
