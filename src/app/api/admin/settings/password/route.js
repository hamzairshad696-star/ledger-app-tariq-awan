import { route, json, body } from '@/lib/api';
import { query } from '@/lib/db';
import { changePasswordSchema } from '@/lib/validators';
import { checkPassword, hashPassword, setSessionCookie } from '@/lib/auth';
import { badRequest } from '@/lib/errors';
export const dynamic = 'force-dynamic';
export const POST = route(async (req, { user }) => {
  const { current_password, new_password } = changePasswordSchema.parse(await body(req));
  const { rows } = await query('SELECT * FROM users WHERE id=$1', [user.id]);
  if (!(await checkPassword(current_password, rows[0].password_hash))) throw badRequest('Current password is incorrect.');
  const { rows: upd } = await query(
    'UPDATE users SET password_hash=$2, token_version=token_version+1, updated_at=now() WHERE id=$1 RETURNING *',
    [user.id, await hashPassword(new_password)]
  );
  await setSessionCookie(upd[0]); // keep this session, sign out all others
  return json({ ok: true });
});
