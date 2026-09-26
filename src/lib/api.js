import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError } from './errors.js';
import { requireRole, requireUser } from './auth.js';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

export const json = (data, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });

/** Reject cross-site state-changing requests (defence in depth on top of SameSite cookies). */
function checkOrigin(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  if (!origin) return;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  let originHost;
  try { originHost = new URL(origin).host; } catch { originHost = ''; }
  if (originHost !== host) throw new ApiError(403, 'Cross-site request blocked.');
}

/**
 * Wrap a route handler with auth + consistent error handling.
 * role: 'admin' | 'viewer' | 'any' | null (public)
 */
export function route(fn, { role = 'admin' } = {}) {
  return async (req, ctx = {}) => {
    try {
      checkOrigin(req);
      let user = null;
      if (role === 'any') user = await requireUser();
      else if (role) user = await requireRole(role);
      return await fn(req, { params: ctx.params || {}, user });
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.message, details: err.details }, err.status);
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const field = first?.path?.join('.') || 'input';
        return json({ error: `${field}: ${first?.message || 'Invalid value'}`, details: err.issues }, 400);
      }
      if (err?.code === '23505') return json({ error: 'That record already exists (duplicate value).' }, 409);
      if (err?.code === '23503') return json({ error: 'A related record is missing.' }, 400);
      if (err?.code === '23514') return json({ error: 'A value is outside the allowed range.' }, 400);
      if (err instanceof SyntaxError) return json({ error: 'Request body is not valid JSON.' }, 400);
      console.error('[api]', err);
      return json({ error: 'Something went wrong on the server. Please try again.' }, 500);
    }
  };
}

export async function body(req) {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

export function searchParams(req) {
  return new URL(req.url).searchParams;
}
