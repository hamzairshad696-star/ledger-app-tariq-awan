import { route, json, body } from '@/lib/api';
import { query } from '@/lib/db';
import { loginSchema } from '@/lib/validators';
import { checkPassword, setSessionCookie } from '@/lib/auth';
import { ApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
// A real bcrypt hash so unknown usernames take as long as wrong passwords
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5oAqA6T1Q8k6u8o5bB3J0mJ6F0bQyKa';

export const POST = route(async (req) => {
  const { username, password } = loginSchema.parse(await body(req));
  const { rows } = await query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
  const user = rows[0];
  const invalid = new ApiError(401, 'Incorrect username or password.');

  if (!user) { await checkPassword(password, DUMMY_HASH); throw invalid; }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new ApiError(429, 'Too many failed attempts. Try again in a few minutes.');
  }
  const ok = await checkPassword(password, user.password_hash);
  if (!ok) {
    const attempts = user.failed_attempts + 1;
    const lock = attempts >= MAX_ATTEMPTS;
    await query(
      `UPDATE users SET failed_attempts=$2, locked_until = CASE WHEN $3 THEN now() + make_interval(mins => $4) ELSE NULL END WHERE id=$1`,
      [user.id, lock ? 0 : attempts, lock, LOCK_MINUTES]
    );
    if (lock) throw new ApiError(429, `Too many failed attempts. The account is locked for ${LOCK_MINUTES} minutes.`);
    throw invalid;
  }
  if (!user.is_active) throw new ApiError(403, 'This account has been disabled. Contact the administrator.');
  await query('UPDATE users SET failed_attempts=0, locked_until=NULL, last_login_at=now() WHERE id=$1', [user.id]);
  await setSessionCookie(user);
  return json({ user: { id: user.id, name: user.name, role: user.role }, redirect: user.role === 'admin' ? '/admin' : '/viewer' });
}, { role: null });
