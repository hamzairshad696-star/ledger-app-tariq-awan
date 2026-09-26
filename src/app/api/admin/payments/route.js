import { route, json, body } from '@/lib/api';
import { tx } from '@/lib/db';
import { paymentSchema } from '@/lib/validators';
import { recordPayment } from '@/lib/ledger-service';
export const dynamic = 'force-dynamic';
export const POST = route(async (req, { user }) => {
  const data = paymentSchema.parse(await body(req));
  return json(await tx((c) => recordPayment(c, user, data)), 201);
});
