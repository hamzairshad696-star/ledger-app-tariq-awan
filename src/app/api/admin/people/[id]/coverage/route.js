import { route, json, searchParams } from '@/lib/api';
import { db } from '@/lib/db';
import { getCoverage } from '@/lib/ledger-service';
import { pIndex } from '@/lib/dates';
import { yearParam, monthParam } from '@/lib/validators';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
// Months AFTER (year, month) — the choices for an advance received in that month.
export const GET = route(async (req, { params }) => {
  const sp = searchParams(req);
  const id = z.coerce.number().int().positive().parse(params.id);
  const y = yearParam.parse(sp.get('year'));
  const m = monthParam.parse(sp.get('month'));
  const count = z.coerce.number().int().min(1).max(24).parse(sp.get('count') || 12);
  return json({ months: await getCoverage(db(), id, pIndex(y, m) + 1, count) });
});
