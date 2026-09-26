import { route, json } from '@/lib/api';
import { db } from '@/lib/db';
import { getYears } from '@/lib/ledger-service';
export const dynamic = 'force-dynamic';
export const GET = route(async () => json(await getYears(db())), { role: 'any' });
