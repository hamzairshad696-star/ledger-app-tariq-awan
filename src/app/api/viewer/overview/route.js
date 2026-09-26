import { route, json, searchParams } from '@/lib/api';
import { db, query } from '@/lib/db';
import { buildYearGrid } from '@/lib/ledger-service';
import { summarize } from '@/lib/ledger-calc';
import { yearParam } from '@/lib/validators';
import { publicPerson, publicMonth } from '@/lib/viewer-shape';
export const dynamic = 'force-dynamic';

// Only people assigned to THIS viewer — enforced on the server.
export const GET = route(async (req, { user }) => {
  const year = yearParam.parse(searchParams(req).get('year') || 2026);
  const { rows } = await query('SELECT person_id FROM viewer_assignments WHERE viewer_id=$1', [user.id]);
  const ids = rows.map((r) => r.person_id);
  if (!ids.length) return json({ year, viewer: { name: user.name }, people: [], totals: summarize([]) });
  const grid = await buildYearGrid(db(), year, { personIds: ids });
  return json({
    year,
    current: grid.current,
    today: grid.today,
    viewer: { name: user.name },
    totals: grid.totals,
    monthlyTotal: grid.rows.filter((r) => r.person.status === 'active').reduce((s, r) => s + Number(r.person.monthly_amount), 0),
    people: grid.rows.map((r) => ({ person: publicPerson(r.person), summary: r.summary, advanceStatus: r.advanceStatus, months: r.months.map(publicMonth) })),
  });
}, { role: 'viewer' });
