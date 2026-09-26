import 'server-only';
import { cookies } from 'next/headers';
import { query } from './db.js';
import { SESSION_COOKIE, SESSION_HOURS, signSession, verifySession } from './session.js';
import { unauthorized, forbidden } from './errors.js';

export { hashPassword, checkPassword } from './password.js';

export async function setSessionCookie(user) {
  const token = await signSession(user);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/**
 * Resolve the signed-in user from the cookie AND the database.
 * A disabled user, or one whose sessions were revoked, is rejected immediately.
 */
export async function getCurrentUser() {
  const payload = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!payload?.sub) return null;
  const { rows } = await query(
    'SELECT id, username, name, role, is_active, token_version FROM users WHERE id = $1',
    [Number(payload.sub)]
  );
  const u = rows[0];
  if (!u || !u.is_active || u.token_version !== payload.tv || u.role !== payload.role) return null;
  return u;
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) throw unauthorized();
  return u;
}

export async function requireRole(role) {
  const u = await requireUser();
  if (u.role !== role) throw forbidden(role === 'admin' ? 'Admin access only.' : 'This area is for viewers.');
  return u;
}
