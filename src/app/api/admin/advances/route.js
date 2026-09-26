import { route, json, body, searchParams } from '@/lib/api';
import { db, tx } from '@/lib/db';
import { advanceSchema, yearParam } from '@/lib/validators';
import { createAdvance, listAdvances } from '@/lib/ledger-service';
export const dynamic = 'force-dynamic';
export const GET = route(async (req) => json({ advances: await listAdvances(db(), yearParam.parse(searchParams(req).get('year') || 2026)) }));
export const POST = route(async (req, { user }) => {
  const data = advanceSchema.parse(await body(req));
  return json({ advance: await tx((c) => createAdvance(c, user, data)) }, 201);
});
