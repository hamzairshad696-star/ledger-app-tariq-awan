import { route, json, searchParams } from '@/lib/api';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const GET = route(async (req) => {
  const limit = Math.min(200, Math.max(1, Number(searchParams(req).get('limit')) || 50));
  const { rows } = await query('SELECT id, user_name, action, summary, created_at FROM audit_log ORDER BY created_at DESC LIMIT $1', [limit]);
  return json({ entries: rows });
});
