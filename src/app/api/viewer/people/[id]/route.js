import { route, json, searchParams } from '@/lib/api';
import { db, query } from '@/lib/db';
import { getPersonLedger } from '@/lib/ledger-service';
import { yearParam } from '@/lib/validators';
import { publicPerson, publicMonth } from '@/lib/viewer-shape';
import { notFound } from '@/lib/errors';
import { z } from 'zod';
export const dynamic = 'force-dynamic';

export const GET = route(async (req, { params, user }) => {
  const id = z.coerce.number().int().positive().parse(params.id);
  const year = yearParam.parse(searchParams(req).get('year') || 2026);
  // Changing the id in the URL does not help: assignment is checked here, server-side.
  const { rows } = await query('SELECT 1 FROM viewer_assignments WHERE viewer_id=$1 AND person_id=$2', [user.id, id]);
  if (!rows.length) throw notFound('Record not found.');
  const l = await getPersonLedger(db(), id, year);
  return json({
    year, current: l.current, today: l.today,
    person: publicPerson(l.person), summary: l.summary, advanceStatus: l.advanceStatus,
    months: l.months.map((m) => ({ ...publicMonth(m), payments: m.payments.map((p) => ({ amount: p.amount, payment_date: p.payment_date, method: p.method })) })),
    advances: l.advances.filter((a) => a.status === 'active').map((a) => ({ id: a.id, payment_date: a.payment_date, total_amount: a.total_amount, allocations: a.allocations.map(({ year, month, amount }) => ({ year, month, amount })), appliedTo: a.appliedTo, status: a.status })),
  });
}, { role: 'viewer' });
