/**
 * Ledger service: loads data from PostgreSQL, applies business rules and
 * delegates ALL arithmetic to ledger-calc.js. Every function takes a
 * `client` (pool adapter or transaction client) so it can run inside a tx.
 */
import { computeMonth, summarize, summarizeMonthGroup, advanceStatusFrom, r2, STATUS } from './ledger-calc.js';
import { pIndex, fromIndex, periodOfDate, monthLabel, shortLabel, currentPeriod, todayISO } from './dates.js';
import { badRequest, notFound, conflict } from './errors.js';

const DEFAULT_YEAR = () => Number(process.env.DEFAULT_YEAR || 2026);

// ---------------------------------------------------------------- helpers
function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}
const key = (personId, month) => `${personId}:${month}`;

/** Run queries in parallel on the pool, sequentially inside a transaction client. */
async function runAll(client, thunks) {
  if (client.parallel) return Promise.all(thunks.map((f) => f()));
  const out = [];
  for (const f of thunks) out.push(await f());
  return out;
}

export async function audit(client, user, action, entity, entityId, summary, details = null) {
  await client.query(
    'INSERT INTO audit_log (user_id, user_name, action, entity, entity_id, summary, details) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [user?.id || null, user?.name || 'system', action, entity, entityId || null, summary, details ? JSON.stringify(details) : null]
  );
}

// ---------------------------------------------------------------- years
export async function getYears(client) {
  const { rows } = await client.query('SELECT year FROM ledger_years ORDER BY year');
  const years = rows.map((r) => r.year);
  const def = years.includes(DEFAULT_YEAR()) ? DEFAULT_YEAR() : years.at(-1) || DEFAULT_YEAR();
  return { years, defaultYear: def, today: todayISO(), current: currentPeriod() };
}

/** Create a year and one monthly_ledger row per person per month. */
export async function ensureYear(client, year) {
  await client.query('INSERT INTO ledger_years (year) VALUES ($1) ON CONFLICT DO NOTHING', [year]);
  await client.query(
    `INSERT INTO monthly_ledger (person_id, year, month, required_amount)
     SELECT p.id, $1, m, p.monthly_amount FROM people p CROSS JOIN generate_series(1, 12) m
     ON CONFLICT (person_id, year, month) DO NOTHING`,
    [year]
  );
}

/** Get (and lock) the ledger row for a person-month, creating year/row if needed. */
export async function ensureLedgerRow(client, personId, year, month) {
  let { rows } = await client.query(
    'SELECT * FROM monthly_ledger WHERE person_id=$1 AND year=$2 AND month=$3 FOR UPDATE',
    [personId, year, month]
  );
  if (rows[0]) return rows[0];
  await ensureYear(client, year);
  ({ rows } = await client.query(
    'SELECT * FROM monthly_ledger WHERE person_id=$1 AND year=$2 AND month=$3 FOR UPDATE',
    [personId, year, month]
  ));
  if (!rows[0]) throw notFound('Person not found.');
  return rows[0];
}

export async function isMonthClosed(client, year, month) {
  const { rows } = await client.query('SELECT is_closed FROM monthly_closings WHERE year=$1 AND month=$2', [year, month]);
  return !!rows[0]?.is_closed;
}

async function assertOpen(client, year, month, what = '') {
  if (await isMonthClosed(client, year, month)) {
    throw conflict(`${monthLabel(year, month)} is closed${what ? ` (${what})` : ''}. Reopen it from Closings before making changes.`);
  }
}

async function monthCoverage(client, personId, year, month) {
  const { rows } = await client.query(
    `SELECT
       COALESCE((SELECT SUM(amount) FROM payments WHERE person_id=$1 AND year=$2 AND month=$3), 0) AS paid,
       COALESCE((SELECT SUM(al.amount) FROM advance_allocations al JOIN advances a ON a.id = al.advance_id
                  WHERE a.status='active' AND al.person_id=$1 AND al.year=$2 AND al.month=$3), 0) AS adv`,
    [personId, year, month]
  );
  return { paid: Number(rows[0].paid), adv: Number(rows[0].adv), covered: r2(Number(rows[0].paid) + Number(rows[0].adv)) };
}

async function getPersonOrThrow(client, id) {
  const { rows } = await client.query('SELECT * FROM people WHERE id=$1', [id]);
  if (!rows[0]) throw notFound('Person not found.');
  return rows[0];
}

// ---------------------------------------------------------------- the grid
/**
 * Build the computed ledger for a year: one row per person with 12 computed months.
 * Works for years that do not exist yet (falls back to each person's monthly amount).
 */
export async function buildYearGrid(client, year, { personIds = null } = {}) {
  const ids = personIds ? personIds.map(Number) : null;
  const current = currentPeriod();
  const [people, ledger, payments, allocs, given, closings, future] = await runAll(client, [
    () => client.query('SELECT * FROM people WHERE ($1::int[] IS NULL OR id = ANY($1)) ORDER BY sr_no', [ids]),
    () => client.query('SELECT person_id, month, required_amount, notes FROM monthly_ledger WHERE year=$1 AND ($2::int[] IS NULL OR person_id = ANY($2))', [year, ids]),
    () => client.query('SELECT * FROM payments WHERE year=$1 AND ($2::int[] IS NULL OR person_id = ANY($2)) ORDER BY payment_date, id', [year, ids]),
    () => client.query(
      `SELECT al.*, a.payment_date AS advance_payment_date FROM advance_allocations al
       JOIN advances a ON a.id = al.advance_id
       WHERE a.status='active' AND al.year=$1 AND ($2::int[] IS NULL OR al.person_id = ANY($2))`,
      [year, ids]
    ),
    () => client.query(
      `SELECT a.id, a.person_id, a.paid_in_month, a.total_amount, a.payment_date,
              COALESCE(json_agg(json_build_object('year', al.year, 'month', al.month, 'amount', al.amount)
                ORDER BY al.year, al.month) FILTER (WHERE al.id IS NOT NULL), '[]') AS allocations
       FROM advances a LEFT JOIN advance_allocations al ON al.advance_id = a.id
       WHERE a.status='active' AND a.paid_in_year=$1 AND ($2::int[] IS NULL OR a.person_id = ANY($2))
       GROUP BY a.id`,
      [year, ids]
    ),
    () => client.query('SELECT month, is_closed, closed_at, closed_by_name FROM monthly_closings WHERE year=$1', [year]),
    () => client.query(
      `SELECT al.person_id, al.year, al.month, al.amount FROM advance_allocations al
       JOIN advances a ON a.id = al.advance_id
       WHERE a.status='active' AND (al.year * 12 + al.month - 1) > $1 AND ($2::int[] IS NULL OR al.person_id = ANY($2))`,
      [pIndex(current.year, current.month), ids]
    ),
  ]);

  const ledgerMap = new Map(ledger.rows.map((r) => [key(r.person_id, r.month), r]));
  const payMap = groupBy(payments.rows, (r) => key(r.person_id, r.month));
  const allocMap = groupBy(allocs.rows, (r) => key(r.person_id, r.month));
  const givenMap = groupBy(given.rows, (r) => key(r.person_id, r.paid_in_month));
  const futureMap = groupBy(future.rows, (r) => r.person_id);
  const closedMap = new Map(closings.rows.map((c) => [c.month, c]));

  const rows = people.rows.map((person) => {
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const lr = ledgerMap.get(key(person.id, m));
      const cell = computeMonth({
        person,
        year,
        month: m,
        required: lr ? lr.required_amount : undefined,
        payments: payMap.get(key(person.id, m)) || [],
        allocations: allocMap.get(key(person.id, m)) || [],
        advancesGiven: givenMap.get(key(person.id, m)) || [],
        current,
        closed: !!closedMap.get(m)?.is_closed,
      });
      cell.ledgerNotes = lr?.notes || '';
      months.push(cell);
    }
    return { person, months, summary: summarize(months), advanceStatus: advanceStatusFrom(futureMap.get(person.id) || []) };
  });

  const closingsArr = Array.from({ length: 12 }, (_, i) => {
    const c = closedMap.get(i + 1);
    return { month: i + 1, is_closed: !!c?.is_closed, closed_at: c?.closed_at || null, closed_by_name: c?.closed_by_name || null, everClosed: !!c };
  });

  return { year, current, today: todayISO(), rows, closings: closingsArr, totals: summarize(rows.flatMap((r) => r.months)) };
}

// ---------------------------------------------------------------- person ledger
export async function getPersonLedger(client, personId, year) {
  await getPersonOrThrow(client, personId);
  const grid = await buildYearGrid(client, year, { personIds: [personId] });
  const row = grid.rows[0];

  const [pay, adv] = await runAll(client, [
    () => client.query('SELECT id, year, month, amount, payment_date, method, reference, notes, created_at FROM payments WHERE person_id=$1 AND year=$2 ORDER BY payment_date, id', [personId, year]),
    () => client.query(
      `SELECT a.*, COALESCE(json_agg(json_build_object('id', al.id, 'year', al.year, 'month', al.month, 'amount', al.amount)
                ORDER BY al.year, al.month) FILTER (WHERE al.id IS NOT NULL), '[]') AS allocations
       FROM advances a LEFT JOIN advance_allocations al ON al.advance_id = a.id
       WHERE a.person_id=$1 GROUP BY a.id ORDER BY a.payment_date DESC, a.id DESC`,
      [personId]
    ),
  ]);
  const payByMonth = groupBy(pay.rows, (p) => p.month);
  for (const m of row.months) m.payments = payByMonth.get(m.month) || [];

  const advances = adv.rows.map((a) => ({ ...a, appliedTo: a.allocations.map((x) => shortLabel(x.year, x.month)).join(' + ') }));
  return { year, current: grid.current, today: grid.today, closings: grid.closings, ...row, advances };
}

/** Months from `fromIdx` for `count` months with remaining due — used by the advance form. */
export async function getCoverage(client, personId, fromIdx, count = 12) {
  await getPersonOrThrow(client, personId);
  const years = new Set();
  for (let i = 0; i < count; i++) years.add(fromIndex(fromIdx + i).year);
  const grids = new Map();
  for (const y of years) grids.set(y, (await buildYearGrid(client, y, { personIds: [personId] })).rows[0]);
  const out = [];
  for (let i = 0; i < count; i++) {
    const { year, month } = fromIndex(fromIdx + i);
    const c = grids.get(year).months[month - 1];
    out.push({ year, month, label: monthLabel(year, month), required: c.baseRequired, covered: c.covered, remaining: c.remaining, status: c.status, closed: c.closed, applicable: c.applicable });
  }
  return out;
}

// ---------------------------------------------------------------- people
export async function createPerson(client, user, data) {
  let sr = data.sr_no;
  if (!sr) {
    const { rows } = await client.query('SELECT COALESCE(MAX(sr_no), 0) + 1 AS n FROM people');
    sr = rows[0].n;
  }
  const { rows } = await client.query(
    `INSERT INTO people (sr_no, name, father_name, status, marital_status, split_cash, account, monthly_amount, joining_date, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [sr, data.name, data.father_name, data.status, data.marital_status, data.split_cash, data.account, data.monthly_amount, data.joining_date, data.notes]
  );
  const p = rows[0];
  await client.query(
    `INSERT INTO monthly_ledger (person_id, year, month, required_amount)
     SELECT $1, y.year, m, $2 FROM ledger_years y CROSS JOIN generate_series(1, 12) m ON CONFLICT DO NOTHING`,
    [p.id, p.monthly_amount]
  );
  await audit(client, user, 'person.create', 'person', p.id, `Added ${p.name} (Sr# ${p.sr_no})`);
  return p;
}

export async function updatePerson(client, user, id, data) {
  const before = await getPersonOrThrow(client, id);
  const { rows } = await client.query(
    `UPDATE people SET sr_no=$2, name=$3, father_name=$4, status=$5, marital_status=$6, split_cash=$7, account=$8,
       monthly_amount=$9, joining_date=$10, notes=$11, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, data.sr_no || before.sr_no, data.name, data.father_name, data.status, data.marital_status, data.split_cash, data.account, data.monthly_amount, data.joining_date, data.notes]
  );
  let applied = 0;
  if (Number(before.monthly_amount) !== Number(data.monthly_amount) && data.apply_amount_to_open_months !== false) {
    const cur = currentPeriod();
    const res = await client.query(
      `UPDATE monthly_ledger ml SET required_amount=$2, updated_at=now()
       WHERE person_id=$1 AND (year * 12 + month - 1) >= $3
         AND NOT EXISTS (SELECT 1 FROM monthly_closings c WHERE c.year=ml.year AND c.month=ml.month AND c.is_closed)`,
      [id, data.monthly_amount, pIndex(cur.year, cur.month)]
    );
    applied = res.rowCount;
  }
  await audit(client, user, 'person.update', 'person', id, `Updated ${rows[0].name}${applied ? ` (monthly amount applied to ${applied} open months)` : ''}`);
  return rows[0];
}

export async function deletePerson(client, user, id) {
  const p = await getPersonOrThrow(client, id);
  await client.query('DELETE FROM people WHERE id=$1', [id]);
  await audit(client, user, 'person.delete', 'person', id, `Deleted ${p.name} (Sr# ${p.sr_no})`);
}

export async function updateLedgerMonth(client, user, { person_id, year, month, required_amount, notes }) {
  const p = await getPersonOrThrow(client, person_id);
  const row = await ensureLedgerRow(client, person_id, year, month);
  await assertOpen(client, year, month);
  const cov = await monthCoverage(client, person_id, year, month);
  if (required_amount < cov.covered) {
    throw badRequest(`Rs. ${cov.covered.toLocaleString('en-US')} is already recorded for ${monthLabel(year, month)}; the amount due cannot be lower than that.`);
  }
  await client.query('UPDATE monthly_ledger SET required_amount=$2, notes=$3, updated_at=now() WHERE id=$1', [row.id, required_amount, notes]);
  await audit(client, user, 'ledger.update', 'person', person_id, `${p.name}: ${monthLabel(year, month)} amount due set to Rs. ${required_amount}`);
}

// ---------------------------------------------------------------- payments
export async function recordPayment(client, user, data) {
  const p = await getPersonOrThrow(client, data.person_id);
  const label = monthLabel(data.year, data.month);
  const row = await ensureLedgerRow(client, p.id, data.year, data.month);
  await assertOpen(client, data.year, data.month);

  const required = Number(row.required_amount);
  if (required <= 0) throw badRequest(`Nothing is due for ${p.name} in ${label}.`);
  const cov = await monthCoverage(client, p.id, data.year, data.month);
  const remaining = r2(required - cov.covered);
  if (remaining <= 0) {
    throw conflict(`${label} is already fully paid for ${p.name}${cov.adv > 0 ? ' (covered by an advance)' : ''}. To pay ahead, record an advance for a future month.`);
  }
  if (data.amount > remaining) {
    throw badRequest(`Only Rs. ${remaining.toLocaleString('en-US')} is still due for ${label}. Record the extra amount as an advance for future months.`);
  }

  const { rows } = await client.query(
    `INSERT INTO payments (person_id, ledger_id, year, month, amount, payment_date, method, reference, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [p.id, row.id, data.year, data.month, data.amount, data.payment_date, data.method, data.reference, data.notes, user?.id || null]
  );
  await audit(client, user, 'payment.create', 'person', p.id, `${p.name}: Rs. ${data.amount} paid for ${label}`, { paymentId: rows[0].id });

  let advance = null;
  if (data.advance) {
    advance = await createAdvance(client, user, {
      person_id: p.id,
      payment_date: data.payment_date,
      total_amount: data.advance.total_amount,
      allocations: data.advance.allocations,
      notes: data.advance.notes || '',
      minTarget: pIndex(data.year, data.month) + 1,
    });
  }
  return { payment: rows[0], advance };
}

export async function deletePayment(client, user, id) {
  const { rows } = await client.query('SELECT pay.*, p.name FROM payments pay JOIN people p ON p.id = pay.person_id WHERE pay.id=$1', [id]);
  const pay = rows[0];
  if (!pay) throw notFound('Payment not found.');
  await assertOpen(client, pay.year, pay.month);
  await client.query('DELETE FROM payments WHERE id=$1', [id]);
  await audit(client, user, 'payment.delete', 'person', pay.person_id, `${pay.name}: removed Rs. ${pay.amount} payment for ${monthLabel(pay.year, pay.month)}`);
}

// ---------------------------------------------------------------- advances
/**
 * Create an advance linked to exact future months.
 * allocations: [{year, month, amount}] — must sum exactly to total_amount.
 */
export async function createAdvance(client, user, data) {
  const p = await getPersonOrThrow(client, data.person_id);
  const paidIn = periodOfDate(data.payment_date);
  const paidIdx = pIndex(paidIn.year, paidIn.month);
  await assertOpen(client, paidIn.year, paidIn.month, 'month the advance was received');

  const allocs = [...data.allocations].sort((a, b) => pIndex(a.year, a.month) - pIndex(b.year, b.month));
  const seen = new Set();
  const minIdx = Math.max(paidIdx + 1, data.minTarget || 0);
  for (const a of allocs) {
    const i = pIndex(a.year, a.month);
    if (seen.has(i)) throw badRequest(`${monthLabel(a.year, a.month)} is selected more than once.`);
    seen.add(i);
    if (i < minIdx) {
      throw badRequest(`An advance must cover months after ${monthLabel(fromIndex(minIdx - 1).year, fromIndex(minIdx - 1).month)}. ${monthLabel(a.year, a.month)} is not a future month.`);
    }
  }
  const allocated = r2(allocs.reduce((s, a) => s + a.amount, 0));
  const total = r2(data.total_amount);
  if (allocated > total) throw badRequest(`Allocated Rs. ${allocated.toLocaleString('en-US')} is more than the advance amount of Rs. ${total.toLocaleString('en-US')}.`);
  if (allocated < total) throw badRequest(`Rs. ${r2(total - allocated).toLocaleString('en-US')} of the advance is not assigned to any month. Add another month or lower the amount.`);

  const rowsByIdx = new Map();
  for (const a of allocs) {
    const row = await ensureLedgerRow(client, p.id, a.year, a.month);
    await assertOpen(client, a.year, a.month);
    const cov = await monthCoverage(client, p.id, a.year, a.month);
    const remaining = r2(Number(row.required_amount) - cov.covered);
    if (a.amount > remaining) {
      throw badRequest(
        remaining <= 0
          ? `${monthLabel(a.year, a.month)} is already fully paid for ${p.name}.`
          : `${monthLabel(a.year, a.month)} only has Rs. ${remaining.toLocaleString('en-US')} left to pay, but Rs. ${a.amount.toLocaleString('en-US')} was assigned.`
      );
    }
    rowsByIdx.set(pIndex(a.year, a.month), row);
  }

  const { rows } = await client.query(
    `INSERT INTO advances (person_id, payment_date, paid_in_year, paid_in_month, total_amount, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [p.id, data.payment_date, paidIn.year, paidIn.month, total, data.notes || '', user?.id || null]
  );
  const adv = rows[0];
  for (const a of allocs) {
    await client.query(
      'INSERT INTO advance_allocations (advance_id, person_id, ledger_id, year, month, amount) VALUES ($1,$2,$3,$4,$5,$6)',
      [adv.id, p.id, rowsByIdx.get(pIndex(a.year, a.month)).id, a.year, a.month, a.amount]
    );
  }
  const applied = allocs.map((a) => shortLabel(a.year, a.month)).join(' + ');
  await audit(client, user, 'advance.create', 'person', p.id, `${p.name}: advance Rs. ${total} on ${data.payment_date} applied to ${applied}`, { advanceId: adv.id });
  return { ...adv, allocations: allocs, appliedTo: applied };
}

export async function getAdvanceDetail(client, id) {
  const { rows } = await client.query(
    `SELECT a.*, p.name AS person_name, p.father_name, p.sr_no,
       COALESCE(json_agg(json_build_object('id', al.id, 'year', al.year, 'month', al.month, 'amount', al.amount)
         ORDER BY al.year, al.month) FILTER (WHERE al.id IS NOT NULL), '[]') AS allocations
     FROM advances a JOIN people p ON p.id = a.person_id
     LEFT JOIN advance_allocations al ON al.advance_id = a.id
     WHERE a.id=$1 GROUP BY a.id, p.id`,
    [id]
  );
  const a = rows[0];
  if (!a) throw notFound('Advance not found.');
  const cur = currentPeriod();
  const curIdx = pIndex(cur.year, cur.month);
  const { rows: closed } = await client.query('SELECT year, month FROM monthly_closings WHERE is_closed');
  const closedSet = new Set(closed.map((c) => pIndex(c.year, c.month)));
  a.allocations = a.allocations.map((al) => {
    const i = pIndex(al.year, al.month);
    return { ...al, label: monthLabel(al.year, al.month), closed: closedSet.has(i), timing: i < curIdx ? 'past' : i === curIdx ? 'current' : 'upcoming' };
  });
  a.appliedTo = a.allocations.map((x) => shortLabel(x.year, x.month)).join(' + ');
  a.paidInLabel = monthLabel(a.paid_in_year, a.paid_in_month);
  a.canCancel = a.status === 'active' && !closedSet.has(pIndex(a.paid_in_year, a.paid_in_month)) && !a.allocations.some((x) => x.closed);
  return a;
}

export async function cancelAdvance(client, user, id, reason) {
  const a = await getAdvanceDetail(client, id);
  if (a.status !== 'active') throw conflict('This advance is already cancelled.');
  await assertOpen(client, a.paid_in_year, a.paid_in_month, 'month the advance was received');
  for (const al of a.allocations) await assertOpen(client, al.year, al.month);
  await client.query("UPDATE advances SET status='cancelled', cancelled_at=now(), cancelled_by=$2, cancel_reason=$3 WHERE id=$1", [id, user?.id || null, reason || '']);
  await audit(client, user, 'advance.cancel', 'person', a.person_id, `${a.person_name}: cancelled advance Rs. ${a.total_amount} (${a.appliedTo})`, { advanceId: id, reason });
}

export async function listAdvances(client, year) {
  const { rows } = await client.query(
    `SELECT a.*, p.name AS person_name, p.father_name, p.sr_no,
       COALESCE(json_agg(json_build_object('year', al.year, 'month', al.month, 'amount', al.amount)
         ORDER BY al.year, al.month) FILTER (WHERE al.id IS NOT NULL), '[]') AS allocations
     FROM advances a JOIN people p ON p.id = a.person_id
     LEFT JOIN advance_allocations al ON al.advance_id = a.id
     WHERE a.paid_in_year = $1 OR EXISTS (SELECT 1 FROM advance_allocations x WHERE x.advance_id = a.id AND x.year = $1)
     GROUP BY a.id, p.id ORDER BY a.payment_date DESC, a.id DESC`,
    [year]
  );
  return rows.map((a) => ({ ...a, appliedTo: a.allocations.map((x) => shortLabel(x.year, x.month)).join(' + ') }));
}

// ---------------------------------------------------------------- closings
function monthRowsFromGrid(grid, month) {
  return grid.rows.map((r) => {
    const c = r.months[month - 1];
    return {
      person_id: r.person.id,
      sr_no: r.person.sr_no,
      name: r.person.name,
      father_name: r.person.father_name,
      status: c.status,
      required: c.required,
      paid: c.paid,
      advanceCovered: c.advanceCovered,
      pending: c.pending,
      remaining: c.remaining,
      advanceGiven: c.advanceGivenAmount,
      advanceGivenFor: c.advanceGivenFor.map((x) => ({ ...x, label: shortLabel(x.year, x.month) })),
    };
  });
}

export async function closingPreview(client, year, month) {
  const grid = await buildYearGrid(client, year);
  const cells = grid.rows.map((r) => r.months[month - 1]);
  return { year, month, label: monthLabel(year, month), summary: summarizeMonthGroup(cells), rows: monthRowsFromGrid(grid, month) };
}

/** Opening view: what is already settled for month M and the next two months. */
export async function openingView(client, year, month) {
  const startIdx = pIndex(year, month);
  const periods = [0, 1, 2].map((d) => fromIndex(startIdx + d));
  const grids = new Map();
  for (const y of new Set(periods.map((p) => p.year))) grids.set(y, await buildYearGrid(client, y));
  const base = grids.get(year);
  const rows = base.rows.map((r, i) => ({
    person_id: r.person.id,
    sr_no: r.person.sr_no,
    name: r.person.name,
    months: periods.map((p) => {
      const c = grids.get(p.year).rows[i].months[p.month - 1];
      return { year: p.year, month: p.month, status: c.status, required: c.required, covered: c.covered, remaining: c.remaining, advanceSources: c.advanceSources };
    }),
  }));
  const first = rows.map((r) => r.months[0]);
  return {
    periods: periods.map((p) => ({ ...p, label: monthLabel(p.year, p.month) })),
    rows,
    summary: {
      alreadyByAdvance: first.filter((m) => m.status === STATUS.ADVANCE_PAID).length,
      alreadyPaid: first.filter((m) => m.status === STATUS.PAID).length,
      partial: first.filter((m) => m.status === STATUS.PARTIAL).length,
      open: first.filter((m) => m.status === STATUS.PENDING || m.status === STATUS.UPCOMING).length,
      advanceAmount: r2(rows.reduce((s, r) => s + r.months[0].advanceSources.reduce((t, x) => t + x.amount, 0), 0)),
    },
  };
}

export async function closingOverview(client, year) {
  const grid = await buildYearGrid(client, year);
  const { rows: rec } = await client.query('SELECT * FROM monthly_closings WHERE year=$1', [year]);
  const recMap = new Map(rec.map((r) => [r.month, r]));
  const curIdx = pIndex(grid.current.year, grid.current.month);
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const r = recMap.get(m);
    const live = summarizeMonthGroup(grid.rows.map((row) => row.months[i]));
    return {
      month: m,
      label: monthLabel(year, m),
      state: r?.is_closed ? 'closed' : pIndex(year, m) > curIdx ? 'future' : pIndex(year, m) === curIdx ? 'current' : 'open',
      closed_at: r?.closed_at || null,
      closed_by_name: r?.closed_by_name || null,
      reopened_at: r?.reopened_at || null,
      reopen_reason: r?.reopen_reason || null,
      close_count: r?.close_count || 0,
      summary: r?.is_closed ? r.snapshot.summary : live,
    };
  });
  return { year, current: grid.current, months };
}

export async function closingDetail(client, year, month) {
  const { rows } = await client.query('SELECT * FROM monthly_closings WHERE year=$1 AND month=$2', [year, month]);
  const { rows: events } = await client.query('SELECT id, action, reason, user_name, created_at FROM closing_events WHERE year=$1 AND month=$2 ORDER BY created_at DESC', [year, month]);
  const rec = rows[0] || null;
  const live = await closingPreview(client, year, month);
  const next = fromIndex(pIndex(year, month) + 1);
  const opening = await openingView(client, next.year, next.month);
  return { year, month, label: monthLabel(year, month), record: rec, live, events, next: { ...next, label: monthLabel(next.year, next.month) }, opening };
}

export async function closeMonth(client, user, year, month) {
  const cur = currentPeriod();
  if (pIndex(year, month) > pIndex(cur.year, cur.month)) throw badRequest(`${monthLabel(year, month)} has not started yet and cannot be closed.`);
  await client.query('INSERT INTO ledger_years (year) VALUES ($1) ON CONFLICT DO NOTHING', [year]);
  const { rows } = await client.query('SELECT * FROM monthly_closings WHERE year=$1 AND month=$2 FOR UPDATE', [year, month]);
  if (rows[0]?.is_closed) throw conflict(`${monthLabel(year, month)} is already closed.`);
  const preview = await closingPreview(client, year, month);
  const snapshot = { summary: preview.summary, rows: preview.rows, closedOn: todayISO() };
  await client.query(
    `INSERT INTO monthly_closings (year, month, is_closed, closed_at, closed_by, closed_by_name, snapshot, close_count)
     VALUES ($1,$2,TRUE,now(),$3,$4,$5,1)
     ON CONFLICT (year, month) DO UPDATE SET is_closed=TRUE, closed_at=now(), closed_by=$3, closed_by_name=$4, snapshot=$5,
       close_count = monthly_closings.close_count + 1`,
    [year, month, user?.id || null, user?.name || 'system', JSON.stringify(snapshot)]
  );
  await client.query('INSERT INTO closing_events (year, month, action, snapshot, user_name) VALUES ($1,$2,$3,$4,$5)', [year, month, 'close', JSON.stringify(snapshot), user?.name || 'system']);
  await audit(client, user, 'month.close', 'closing', null, `${monthLabel(year, month)} closed — ${preview.summary.paidCount}/${preview.summary.people} paid`);
  return snapshot;
}

export async function reopenMonth(client, user, year, month, reason) {
  if (!reason || reason.trim().length < 3) throw badRequest('Give a short reason for reopening (at least 3 characters).');
  const { rows } = await client.query('SELECT * FROM monthly_closings WHERE year=$1 AND month=$2 FOR UPDATE', [year, month]);
  if (!rows[0]?.is_closed) throw conflict(`${monthLabel(year, month)} is not closed.`);
  await client.query('UPDATE monthly_closings SET is_closed=FALSE, reopened_at=now(), reopened_by_name=$3, reopen_reason=$4 WHERE year=$1 AND month=$2', [year, month, user?.name, reason]);
  await client.query('INSERT INTO closing_events (year, month, action, reason, user_name) VALUES ($1,$2,$3,$4,$5)', [year, month, 'reopen', reason, user?.name]);
  await audit(client, user, 'month.reopen', 'closing', null, `${monthLabel(year, month)} reopened: ${reason}`);
}

// ---------------------------------------------------------------- dashboard
export async function dashboard(client, year) {
  const grid = await buildYearGrid(client, year);
  const people = grid.rows.map((r) => r.person);
  const cur = grid.current;
  const focusMonth = year === cur.year ? cur.month : year < cur.year ? 12 : 1;
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const s = summarizeMonthGroup(grid.rows.map((r) => r.months[i]));
    return { month: i + 1, required: s.required, paid: s.paid, advanceCovered: s.advanceCovered, pending: s.pending, collected: s.collected, paidCount: s.paidCount, people: s.people };
  });
  const focus = summarizeMonthGroup(grid.rows.map((r) => r.months[focusMonth - 1]));
  const nextIdx = focusMonth < 12 ? focusMonth : null;
  const aheadNext = nextIdx
    ? grid.rows.filter((r) => r.months[nextIdx].status === STATUS.ADVANCE_PAID).map((r) => ({ id: r.person.id, name: r.person.name, amount: r.months[nextIdx].advanceCovered }))
    : [];
  const { rows: activity } = await client.query('SELECT id, user_name, action, summary, created_at FROM audit_log ORDER BY created_at DESC LIMIT 8');
  const active = people.filter((p) => p.status === 'active');
  return {
    year,
    current: cur,
    today: grid.today,
    counts: {
      total: people.length,
      active: active.length,
      inactive: people.length - active.length,
      married: people.filter((p) => p.marital_status === 'married').length,
      unmarried: people.filter((p) => p.marital_status === 'unmarried').length,
    },
    totalMonthlyAmount: r2(active.reduce((s, p) => s + Number(p.monthly_amount), 0)),
    totals: grid.totals,
    focusMonth,
    focus,
    monthly,
    aheadNext: { month: nextIdx ? nextIdx + 1 : null, people: aheadNext },
    closings: grid.closings,
    activity,
  };
}
