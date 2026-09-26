import { route, json, body } from '@/lib/api';
import { query, tx } from '@/lib/db';
import { viewerSchema, passwordRule } from '@/lib/validators';
import { hashPassword } from '@/lib/auth';
import { audit } from '@/lib/ledger-service';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const { rows } = await query(
    `SELECT u.id, u.username, u.name, u.is_active, u.last_login_at, u.created_at,
       COALESCE(json_agg(json_build_object('id', p.id, 'name', p.name, 'sr_no', p.sr_no) ORDER BY p.sr_no) FILTER (WHERE p.id IS NOT NULL), '[]') AS people
     FROM users u LEFT JOIN viewer_assignments va ON va.viewer_id = u.id LEFT JOIN people p ON p.id = va.person_id
     WHERE u.role='viewer' GROUP BY u.id ORDER BY u.name`
  );
  return json({ viewers: rows });
});

export const POST = route(async (req, { user }) => {
  const data = viewerSchema.parse(await body(req));
  const password = passwordRule.parse(data.password || '');
  const viewer = await tx(async (c) => {
    const { rows } = await c.query(
      "INSERT INTO users (username, password_hash, name, role, is_active) VALUES ($1,$2,$3,'viewer',$4) RETURNING id, username, name",
      [data.username, await hashPassword(password), data.name, data.is_active]
    );
    for (const pid of data.person_ids) await c.query('INSERT INTO viewer_assignments (viewer_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rows[0].id, pid]);
    await audit(c, user, 'viewer.create', 'user', rows[0].id, `Created viewer ${data.name} (${data.username})`);
    return rows[0];
  });
  return json({ viewer }, 201);
});
