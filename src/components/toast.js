'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const Ctx = createContext({ toast: () => {} });
export const useToast = () => useContext(Ctx).toast;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, message, type }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), type === 'error' ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 max-w-sm no-print" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`animate-pop flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm shadow-pop border ${t.type === 'error' ? 'bg-white border-st-pend/30 text-st-pend' : 'bg-navy-900 border-navy-800 text-white'}`}>
            {t.type === 'error' ? <AlertCircle size={18} className="shrink-0 mt-px" /> : <CheckCircle2 size={18} className="shrink-0 mt-px text-emerald-300" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} className="opacity-60 hover:opacity-100" aria-label="Dismiss"><X size={16} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
