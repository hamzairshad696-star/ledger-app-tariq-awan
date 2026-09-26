import { route, json, body } from '@/lib/api';
import { tx } from '@/lib/db';
import { yearSchema } from '@/lib/validators';
import { ensureYear, audit } from '@/lib/ledger-service';
export const dynamic = 'force-dynamic';
export const POST = route(async (req, { user }) => {
  const { year } = yearSchema.parse(await body(req));
  await tx(async (c) => { await ensureYear(c, year); await audit(c, user, 'year.add', 'year', year, `Added year ${year}`); });
  return json({ ok: true, year }, 201);
});
