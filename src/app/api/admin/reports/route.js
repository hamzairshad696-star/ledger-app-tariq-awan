import { route, json, searchParams } from '@/lib/api';
import { db } from '@/lib/db';
import { buildReport, reportFilters } from '@/lib/reports';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const sp = searchParams(req);
  return json(await buildReport(db(), sp.get('type') || 'monthly', reportFilters(sp)));
});
