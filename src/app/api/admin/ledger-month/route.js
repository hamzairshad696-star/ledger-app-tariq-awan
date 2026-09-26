import { route, json, body } from '@/lib/api';
import { tx } from '@/lib/db';
import { ledgerMonthSchema } from '@/lib/validators';
import { updateLedgerMonth } from '@/lib/ledger-service';
export const dynamic = 'force-dynamic';
export const PATCH = route(async (req, { user }) => {
  const data = ledgerMonthSchema.parse(await body(req));
  await tx((c) => updateLedgerMonth(c, user, data));
  return json({ ok: true });
});
