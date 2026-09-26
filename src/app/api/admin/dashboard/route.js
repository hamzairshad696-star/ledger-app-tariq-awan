import { route, json, searchParams } from '@/lib/api';
import { db } from '@/lib/db';
import { dashboard } from '@/lib/ledger-service';
import { yearParam } from '@/lib/validators';
export const dynamic = 'force-dynamic';
export const GET = route(async (req) => json(await dashboard(db(), yearParam.parse(searchParams(req).get('year') || 2026))));
