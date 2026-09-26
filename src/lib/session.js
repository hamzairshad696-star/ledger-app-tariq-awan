// JWT helpers usable from both Edge middleware and Node route handlers.
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'ledger_session';
export const SESSION_HOURS = 10;

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET must be set to at least 32 characters');
  return new TextEncoder().encode(s);
}

export async function signSession(user) {
  return new SignJWT({ role: user.role, tv: user.token_version, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return payload;
  } catch {
    return null;
  }
}
