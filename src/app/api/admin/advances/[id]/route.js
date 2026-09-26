import { route, json, body } from '@/lib/api';
import { db, tx } from '@/lib/db';
import { getAdvanceDetail, cancelAdvance } from '@/lib/ledger-service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const idOf = (p) => z.coerce.number().int().positive().parse(p.id);
export const GET = route(async (req, { params }) => json({ advance: await getAdvanceDetail(db(), idOf(params)) }));
// POST { action: 'cancel', confirm: true, reason }
export const POST = route(async (req, { params, user }) => {
  const b = z.object({ action: z.literal('cancel'), confirm: z.literal(true), reason: z.string().trim().max(500).default('') }).parse(await body(req));
  await tx((c) => cancelAdvance(c, user, idOf(params), b.reason));
  return json({ ok: true });
});
