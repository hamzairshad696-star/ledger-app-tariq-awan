import { route, json, body } from '@/lib/api';
import { query, tx } from '@/lib/db';
import { personSchema } from '@/lib/validators';
import { createPerson } from '@/lib/ledger-service';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const { rows } = await query(
    `SELECT p.*, (SELECT COUNT(*)::int FROM viewer_assignments v WHERE v.person_id = p.id) AS viewer_count,
            (SELECT COALESCE(MAX(sr_no),0)+1 FROM people) AS next_sr
     FROM people p ORDER BY sr_no`
  );
  return json({ people: rows, nextSr: rows[0]?.next_sr || 1 });
});

export const POST = route(async (req, { user }) => {
  const data = personSchema.parse(await body(req));
  const person = await tx((c) => createPerson(c, user, data));
  return json({ person }, 201);
});
