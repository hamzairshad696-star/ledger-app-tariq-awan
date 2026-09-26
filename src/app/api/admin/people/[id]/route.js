import { route, json, body } from '@/lib/api';
import { query, tx } from '@/lib/db';
import { personSchema } from '@/lib/validators';
import { updatePerson, deletePerson } from '@/lib/ledger-service';
import { notFound } from '@/lib/errors';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const idOf = (params) => z.coerce.number().int().positive().parse(params.id);

export const GET = route(async (req, { params }) => {
  const { rows } = await query('SELECT * FROM people WHERE id=$1', [idOf(params)]);
  if (!rows[0]) throw notFound('Person not found.');
  return json({ person: rows[0] });
});
export const PUT = route(async (req, { params, user }) => {
  const data = personSchema.parse(await body(req));
  const person = await tx((c) => updatePerson(c, user, idOf(params), data));
  return json({ person });
});
export const DELETE = route(async (req, { params, user }) => {
  await tx((c) => deletePerson(c, user, idOf(params)));
  return json({ ok: true });
});
