import { route, json } from '@/lib/api';
import { tx } from '@/lib/db';
import { deletePayment } from '@/lib/ledger-service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export const DELETE = route(async (req, { params, user }) => {
  await tx((c) => deletePayment(c, user, z.coerce.number().int().positive().parse(params.id)));
  return json({ ok: true });
});
