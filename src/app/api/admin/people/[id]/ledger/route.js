import { route, json, searchParams } from '@/lib/api';
import { db } from '@/lib/db';
import { getPersonLedger } from '@/lib/ledger-service';
import { yearParam } from '@/lib/validators';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export const GET = route(async (req, { params }) => {
  const id = z.coerce.number().int().positive().parse(params.id);
  return json(await getPersonLedger(db(), id, yearParam.parse(searchParams(req).get('year') || 2026)));
});
