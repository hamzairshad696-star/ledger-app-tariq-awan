'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api-client';

const Ctx = createContext(null);
export const useYear = () => useContext(Ctx);

export function YearProvider({ children }) {
  const [info, setInfo] = useState(null);
  const [year, setYearState] = useState(null);

  const refresh = async () => {
    const d = await api('/api/years');
    setInfo(d);
    setYearState((y) => {
      if (y && d.years.includes(y)) return y;
      const saved = Number(typeof window !== 'undefined' && window.sessionStorage?.getItem('ledger-year'));
      return d.years.includes(saved) ? saved : d.defaultYear;
    });
    return d;
  };
  useEffect(() => { refresh().catch(() => {}); }, []);

  const setYear = (y) => {
    setYearState(y);
    try { window.sessionStorage.setItem('ledger-year', String(y)); } catch {}
  };
  if (!info || !year) return <div className="min-h-[50vh] grid place-items-center text-slate-500 text-sm">Loading…</div>;
  return <Ctx.Provider value={{ ...info, year, setYear, refreshYears: refresh }}>{children}</Ctx.Provider>;
}
