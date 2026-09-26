import { route, json, body } from '@/lib/api';
import { db, tx } from '@/lib/db';
import { closingDetail, closeMonth, reopenMonth } from '@/lib/ledger-service';
import { yearParam, monthParam, closingActionSchema } from '@/lib/validators';
export const dynamic = 'force-dynamic';
const period = (p) => ({ year: yearParam.parse(p.year), month: monthParam.parse(p.month) });
export const GET = route(async (req, { params }) => {
  const { year, month } = period(params);
  return json(await closingDetail(db(), year, month));
});
export const POST = route(async (req, { params, user }) => {
  const { year, month } = period(params);
  const b = closingActionSchema.parse(await body(req));
  await tx((c) => (b.action === 'close' ? closeMonth(c, user, year, month) : reopenMonth(c, user, year, month, b.reason)));
  return json({ ok: true });
});
