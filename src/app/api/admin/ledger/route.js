import { route, json, searchParams } from '@/lib/api';
import { db } from '@/lib/db';
import { buildYearGrid } from '@/lib/ledger-service';
import { yearParam } from '@/lib/validators';
export const dynamic = 'force-dynamic';
export const GET = route(async (req) => json(await buildYearGrid(db(), yearParam.parse(searchParams(req).get('year') || 2026))));
