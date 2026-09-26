import { route, json, searchParams } from '@/lib/api';
import { db } from '@/lib/db';
import { closingOverview } from '@/lib/ledger-service';
import { yearParam } from '@/lib/validators';
export const dynamic = 'force-dynamic';
export const GET = route(async (req) => json(await closingOverview(db(), yearParam.parse(searchParams(req).get('year') || 2026))));
