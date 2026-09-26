import { route, json, body } from '@/lib/api';
import { tx } from '@/lib/db';
import { viewerSchema, passwordRule } from '@/lib/validators';
import { hashPassword } from '@/lib/auth';
import { audit } from '@/lib/ledger-service';
import { notFound } from '@/lib/errors';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const idOf = (p) => z.coerce.number().int().positive().parse(p.id);

async function loadViewer(c, id) {
  const { rows } = await c.query("SELECT * FROM users WHERE id=$1 AND role='viewer' FOR UPDATE", [id]);
  if (!rows[0]) throw notFound('Viewer not found.');
  return rows[0];
}

export const PUT = route(async (req, { params, user }) => {
  const id = idOf(params);
  const data = viewerSchema.parse(await body(req));
  await tx(async (c) => {
    const v = await loadViewer(c, id);
    const newPw = data.password ? await hashPassword(passwordRule.parse(data.password)) : null;
    // Changing password or disabling signs the viewer out everywhere (token_version bump)
    const revoke = !!newPw || (v.is_active && !data.is_active);
    await c.query(
      `UPDATE users SET username=$2, name=$3, is_active=$4, password_hash=COALESCE($5, password_hash),
         token_version = token_version + $6, failed_attempts = 0, locked_until = NULL, updated_at=now() WHERE id=$1`,
      [id, data.username, data.name, data.is_active, newPw, revoke ? 1 : 0]
    );
    await c.query('DELETE FROM viewer_assignments WHERE viewer_id=$1', [id]);
    for (const pid of data.person_ids) await c.query('INSERT INTO viewer_assignments (viewer_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, pid]);
    await audit(c, user, 'viewer.update', 'user', id, `Updated viewer ${data.name}${data.is_active ? '' : ' (disabled)'}`);
  });
  return json({ ok: true });
});

export const DELETE = route(async (req, { params, user }) => {
  const id = idOf(params);
  await tx(async (c) => {
    const v = await loadViewer(c, id);
    await c.query('DELETE FROM users WHERE id=$1', [id]);
    await audit(c, user, 'viewer.delete', 'user', id, `Deleted viewer ${v.name}`);
  });
  return json({ ok: true });
});
