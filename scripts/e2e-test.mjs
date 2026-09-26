/**
 * End-to-end test of the running app over HTTP.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_USERNAME=tariq ADMIN_PASSWORD=... E2E_ALLOW_RESET=1 node scripts/e2e-test.mjs
 *
 * WARNING: this CLEARS all ledger data (it needs a known starting point), runs the
 * March → April → May advance workflow and the security checks, then reloads demo data.
 * Never run it against a live database.
 */
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_U = process.env.ADMIN_USERNAME || 'tariq';
const ADMIN_P = process.env.ADMIN_PASSWORD;
if (process.env.E2E_ALLOW_RESET !== '1') { console.error('Refusing to run: set E2E_ALLOW_RESET=1 (this deletes all ledger data).'); process.exit(1); }
if (!ADMIN_P) { console.error('Set ADMIN_PASSWORD'); process.exit(1); }

let passed = 0;
const results = [];
async function step(name, fn) {
  try { await fn(); passed++; results.push(['✔', name]); console.log('  ✔', name); }
  catch (e) { results.push(['✘', name]); console.error('  ✘', name, '\n     ', e.message); process.exitCode = 1; }
}

class Client {
  constructor() { this.cookie = ''; }
  async req(path, { method = 'GET', body, headers = {}, raw = false, redirect = 'manual' } = {}) {
    const res = await fetch(BASE + path, {
      method, redirect,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) { const m = set.match(/ledger_session=([^;]*)/); if (m) this.cookie = m[1] ? `ledger_session=${m[1]}` : ''; }
    if (raw) return res;
    let data = null; try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  login(username, password) { return this.req('/api/auth/login', { method: 'POST', body: { username, password } }); }
}

const expectStatus = (r, s, msg) => assert.equal(r.status, s, `${msg || ''} expected ${s}, got ${r.status}: ${JSON.stringify(r.data)}`);

const admin = new Client();
const viewer = new Client();
const anon = new Client();
let hamza, bilal, viewerId, marchAdvanceId;

console.log(`\nE2E against ${BASE}\n`);

// ------------------------------------------------------------------ auth
await step('Invalid login is rejected', async () => expectStatus(await anon.login(ADMIN_U, 'wrong-password'), 401));
await step('Admin (Tariq Awan) can log in', async () => {
  const r = await admin.login(ADMIN_U, ADMIN_P);
  expectStatus(r, 200); assert.equal(r.data.user.role, 'admin'); assert.equal(r.data.user.name, 'Tariq Awan');
});
await step('Admin APIs require a session', async () => expectStatus(await anon.req('/api/admin/dashboard'), 401));
await step('Cross-site POST is blocked', async () => expectStatus(await admin.req('/api/admin/people', { method: 'POST', body: {}, headers: { Origin: 'https://evil.example' } }), 403));

// ------------------------------------------------------------------ setup
await step('Reset to an empty ledger', async () => expectStatus(await admin.req('/api/admin/settings/data', { method: 'POST', body: { action: 'clear', confirmText: 'DELETE' } }), 200));
await step('Missing person information is rejected', async () => {
  const r = await admin.req('/api/admin/people', { method: 'POST', body: { name: '', father_name: 'X', marital_status: 'married', monthly_amount: 100 } });
  expectStatus(r, 400); assert.match(r.data.error, /name/);
});
await step('Negative monthly amount is rejected', async () => expectStatus(await admin.req('/api/admin/people', { method: 'POST', body: { name: 'A', father_name: 'B', marital_status: 'married', monthly_amount: -5 } }), 400));
await step('Add person Hamza Ahmed', async () => {
  const r = await admin.req('/api/admin/people', { method: 'POST', body: { name: 'Hamza', father_name: 'Ahmed', status: 'active', marital_status: 'married', split_cash: 10000, account: '12345', monthly_amount: 10000, joining_date: '2026-01-01' } });
  expectStatus(r, 201); hamza = r.data.person;
});
await step('Add person Bilal (not assigned to the viewer)', async () => {
  const r = await admin.req('/api/admin/people', { method: 'POST', body: { name: 'Bilal', father_name: 'Karim', marital_status: 'unmarried', monthly_amount: 8000, joining_date: '2026-01-01' } });
  expectStatus(r, 201); bilal = r.data.person;
});

// ------------------------------------------------------------------ the core workflow
for (const [m, d] of [[1, '2026-01-08'], [2, '2026-02-09']]) {
  await step(`Record ${['', 'January', 'February'][m]} payment`, async () => expectStatus(await admin.req('/api/admin/payments', { method: 'POST', body: { person_id: hamza.id, year: 2026, month: m, amount: 10000, payment_date: d } }), 201));
}
await step('Record March payment + Rs 20,000 advance for April and May (15 March 2026)', async () => {
  const r = await admin.req('/api/admin/payments', { method: 'POST', body: {
    person_id: hamza.id, year: 2026, month: 3, amount: 10000, payment_date: '2026-03-15',
    advance: { total_amount: 20000, allocations: [{ year: 2026, month: 4, amount: 10000 }, { year: 2026, month: 5, amount: 10000 }] },
  } });
  expectStatus(r, 201); marchAdvanceId = r.data.advance.id; assert.ok(marchAdvanceId);
});
await step('Ledger: Mar Paid + Advance, Apr & May Advance Paid, Jun Pending', async () => {
  const { data: l } = await admin.req(`/api/admin/people/${hamza.id}/ledger?year=2026`);
  const [jan, feb, mar, apr, may, jun] = l.months;
  assert.equal(jan.status, 'paid'); assert.equal(feb.status, 'paid');
  assert.equal(mar.status, 'paid'); assert.equal(mar.advanceGivenAmount, 20000);
  assert.deepEqual(mar.advanceGivenFor.map((x) => [x.month, x.amount]), [[4, 10000], [5, 10000]]);
  assert.equal(apr.status, 'advance_paid'); assert.equal(apr.advanceCovered, 10000); assert.equal(apr.advanceSources[0].paidOn, '2026-03-15');
  assert.equal(may.status, 'advance_paid');
  assert.equal(jun.status, 'pending'); assert.equal(jun.pending, 10000);
  assert.equal(l.summary.advanceTotal, 20000); assert.equal(l.summary.paidTotal, 30000);
  assert.equal(l.summary.netTotal, l.summary.paidTotal + l.summary.advanceTotal - l.summary.pendingTotal);
});
await step('Advance detail: 15 March 2026, Rs 20,000, April + May, Active', async () => {
  const { data } = await admin.req(`/api/admin/advances/${marchAdvanceId}`);
  const a = data.advance;
  assert.equal(a.payment_date, '2026-03-15'); assert.equal(a.total_amount, 20000); assert.equal(a.status, 'active');
  assert.equal(a.person_name, 'Hamza');
  assert.deepEqual(a.allocations.map((x) => [x.label, x.amount]), [['April 2026', 10000], ['May 2026', 10000]]);
});

// ------------------------------------------------------------------ validation
const pay = (month, amount, extra = {}) => admin.req('/api/admin/payments', { method: 'POST', body: { person_id: hamza.id, year: 2026, month, amount, payment_date: '2026-06-10', ...extra } });
await step('Negative payment is rejected', async () => expectStatus(await pay(6, -100), 400));
await step('Invalid date is rejected', async () => expectStatus(await pay(6, 100, { payment_date: '2026-02-30' }), 400));
await step('Duplicate payment for a fully paid month is rejected', async () => { const r = await pay(3, 10000); assert.ok([400, 409].includes(r.status), `got ${r.status}`); });
await step('Payment into a month already paid by advance is rejected', async () => { const r = await pay(4, 10000); assert.ok([400, 409].includes(r.status), `got ${r.status}`); });
await step('Advance allocation greater than the advance amount is rejected', async () => {
  const r = await admin.req('/api/admin/advances', { method: 'POST', body: { person_id: hamza.id, payment_date: '2026-06-10', total_amount: 5000, allocations: [{ year: 2026, month: 7, amount: 10000 }] } });
  expectStatus(r, 400); assert.match(r.data.error, /more than the advance/);
});
await step('Advance into a past month is rejected', async () => {
  const r = await admin.req('/api/admin/advances', { method: 'POST', body: { person_id: hamza.id, payment_date: '2026-06-10', total_amount: 10000, allocations: [{ year: 2026, month: 6, amount: 10000 }] } });
  expectStatus(r, 400);
});

// ------------------------------------------------------------------ closing & opening
await step('March closing preview shows Rs 20,000 advance given', async () => {
  const { data } = await admin.req('/api/admin/closings/2026/3');
  assert.equal(data.live.summary.advanceGiven, 20000);
  assert.equal(data.live.summary.people, 2); assert.equal(data.live.summary.paidCount, 1);
});
await step('Close March 2026', async () => expectStatus(await admin.req('/api/admin/closings/2026/3', { method: 'POST', body: { action: 'close', confirm: true } }), 200));
await step('Closing without confirmation is rejected', async () => expectStatus(await admin.req('/api/admin/closings/2026/2', { method: 'POST', body: { action: 'close' } }), 400));
await step('A future month cannot be closed', async () => expectStatus(await admin.req('/api/admin/closings/2026/12', { method: 'POST', body: { action: 'close', confirm: true } }), 400));
await step('Closed month rejects new payments', async () => {
  const r = await admin.req('/api/admin/payments', { method: 'POST', body: { person_id: bilal.id, year: 2026, month: 3, amount: 100, payment_date: '2026-03-20' } });
  assert.ok([400, 409, 423].includes(r.status), `got ${r.status}`);
});
await step('April opening: Hamza April & May already paid by advance, June pending', async () => {
  const { data } = await admin.req('/api/admin/closings/2026/3');
  assert.equal(data.record.is_closed, true);
  assert.equal(data.next.label, 'April 2026');
  const h = data.opening.rows.find((r) => r.person_id === hamza.id);
  assert.deepEqual(h.months.map((m) => [m.month, m.status]), [[4, 'advance_paid'], [5, 'advance_paid'], [6, 'pending']]);
  assert.equal(data.opening.summary.alreadyByAdvance, 1);
});
await step('Closing snapshot is permanent (kept in record)', async () => {
  const { data } = await admin.req('/api/admin/closings/2026/3');
  assert.equal(data.record.snapshot.summary.advanceGiven, 20000);
});
await step('Reopen needs a reason', async () => expectStatus(await admin.req('/api/admin/closings/2026/3', { method: 'POST', body: { action: 'reopen', confirm: true, reason: '' } }), 400));
await step('Reopen with reason, then close again', async () => {
  expectStatus(await admin.req('/api/admin/closings/2026/3', { method: 'POST', body: { action: 'reopen', confirm: true, reason: 'E2E check' } }), 200);
  expectStatus(await admin.req('/api/admin/closings/2026/3', { method: 'POST', body: { action: 'close', confirm: true } }), 200);
  const { data } = await admin.req('/api/admin/closings/2026/3');
  assert.deepEqual(data.events.map((e) => e.action), ['close', 'reopen', 'close']);
});

// ------------------------------------------------------------------ cancel advance keeps history
await step('Cancelled advance frees its months (Bilal Oct+Nov)', async () => {
  const r = await admin.req('/api/admin/advances', { method: 'POST', body: { person_id: bilal.id, payment_date: '2026-09-20', total_amount: 16000, allocations: [{ year: 2026, month: 10, amount: 8000 }, { year: 2026, month: 11, amount: 8000 }] } });
  expectStatus(r, 201);
  let { data: l } = await admin.req(`/api/admin/people/${bilal.id}/ledger?year=2026`);
  assert.equal(l.months[9].status, 'advance_paid');
  expectStatus(await admin.req(`/api/admin/advances/${r.data.advance.id}`, { method: 'POST', body: { action: 'cancel', confirm: true, reason: 'test' } }), 200);
  ({ data: l } = await admin.req(`/api/admin/people/${bilal.id}/ledger?year=2026`));
  assert.equal(l.months[9].status, 'upcoming');
  const { data: d } = await admin.req(`/api/admin/advances/${r.data.advance.id}`);
  assert.equal(d.advance.status, 'cancelled');
});

// ------------------------------------------------------------------ dashboard & reports
await step('Dashboard totals come from the database', async () => {
  const { data } = await admin.req('/api/admin/dashboard?year=2026');
  assert.equal(data.counts.total, 2); assert.equal(data.counts.married, 1); assert.equal(data.counts.unmarried, 1);
  assert.equal(data.totalMonthlyAmount, 18000); assert.equal(data.totals.advanceTotal, 20000);
});
await step('Monthly report CSV export contains Hamza', async () => {
  const res = await admin.req('/api/admin/export?type=monthly&year=2026&month=3&format=csv', { raw: true });
  assert.equal(res.status, 200); const t = await res.text(); assert.match(t, /Hamza/); assert.match(t, /Apr 2026 \+ May 2026/);
});
await step('Excel export and JSON backup work', async () => {
  const x = await admin.req('/api/admin/export?type=annual&year=2026&format=xlsx', { raw: true });
  assert.equal(x.status, 200); assert.match(x.headers.get('content-type'), /spreadsheetml/);
  const b = await admin.req('/api/admin/export?type=backup&format=json', { raw: true });
  const j = await b.json(); assert.equal(j.tables.advance_allocations.filter((a) => a.person_id === hamza.id).length, 2);
});

// ------------------------------------------------------------------ viewer permissions
await step('Admin creates a viewer assigned only to Hamza', async () => {
  const r = await admin.req('/api/admin/viewers', { method: 'POST', body: { username: 'e2e.viewer', name: 'E2E Viewer', password: 'ViewerPass#1', is_active: true, person_ids: [hamza.id] } });
  expectStatus(r, 201); viewerId = r.data.viewer.id;
});
await step('Viewer logs in and sees only Hamza, with April Advance Paid', async () => {
  expectStatus(await viewer.login('e2e.viewer', 'ViewerPass#1'), 200);
  const { status, data } = await viewer.req('/api/viewer/overview?year=2026');
  expectStatus({ status, data }, 200);
  assert.equal(data.people.length, 1); assert.equal(data.people[0].person.name, 'Hamza');
  assert.equal(data.people[0].months[3].status, 'advance_paid');
  assert.equal(data.people[0].person.notes, undefined, 'internal fields must not leak');
});
await step('Viewer cannot open an unassigned person by changing the URL', async () => expectStatus(await viewer.req(`/api/viewer/people/${bilal.id}?year=2026`), 404));
await step('Viewer can open the assigned person', async () => expectStatus(await viewer.req(`/api/viewer/people/${hamza.id}?year=2026`), 200));
await step('Viewer cannot read Admin APIs', async () => {
  for (const p of ['/api/admin/dashboard', '/api/admin/people', `/api/admin/people/${bilal.id}/ledger`, '/api/admin/viewers', '/api/admin/export?type=backup&format=json']) {
    expectStatus(await viewer.req(p), 403, p);
  }
});
await step('Viewer cannot write through Admin APIs', async () => {
  expectStatus(await viewer.req('/api/admin/payments', { method: 'POST', body: { person_id: hamza.id, year: 2026, month: 6, amount: 1, payment_date: '2026-06-01' } }), 403);
  expectStatus(await viewer.req(`/api/admin/people/${hamza.id}`, { method: 'DELETE' }), 403);
  expectStatus(await viewer.req('/api/admin/viewers', { method: 'POST', body: { username: 'x.y.z', name: 'X', password: 'longenough' } }), 403);
});
await step('Viewer is redirected away from Admin pages', async () => {
  const r = await viewer.req('/admin', { raw: true });
  assert.ok([302, 307, 308].includes(r.status)); assert.match(r.headers.get('location'), /\/viewer/);
});
await step('Disabling a viewer ends their session and blocks login', async () => {
  expectStatus(await admin.req(`/api/admin/viewers/${viewerId}`, { method: 'PUT', body: { username: 'e2e.viewer', name: 'E2E Viewer', is_active: false, person_ids: [hamza.id] } }), 200);
  expectStatus(await viewer.req('/api/viewer/overview?year=2026'), 401);
  expectStatus(await new Client().login('e2e.viewer', 'ViewerPass#1'), 403);
});

// ------------------------------------------------------------------ restore demo data
await step('Clear test data and reload demo data', async () => {
  expectStatus(await admin.req('/api/admin/settings/data', { method: 'POST', body: { action: 'clear', confirmText: 'DELETE' } }), 200);
  const r = await admin.req('/api/admin/settings/data', { method: 'POST', body: { action: 'load-demo' } });
  expectStatus(r, 200); assert.equal(r.data.people, 40);
  const { data } = await admin.req('/api/admin/dashboard?year=2026');
  assert.equal(data.counts.married, 25); assert.equal(data.counts.unmarried, 15);
});

const failed = results.filter((r) => r[0] === '✘').length;
console.log(`\n${passed} passed, ${failed} failed\n`);
