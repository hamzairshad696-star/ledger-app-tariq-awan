'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export class ClientError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function handleUnauthorized() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
  window.location.href = '/login?expired=1';
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 401 && !path.startsWith('/api/auth/login')) { await handleUnauthorized(); throw new ClientError('Session expired', 401); }
  if (!res.ok) throw new ClientError(data?.error || `Request failed (${res.status})`, res.status);
  return data;
}

/** Fetch JSON with loading/error state; `reload()` re-runs it. */
export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path });
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(path);
      if (n === seq.current) setState({ data, error: null, loading: false });
    } catch (e) {
      if (n === seq.current) setState((s) => ({ ...s, error: e.message, loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export function downloadUrl(url) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
