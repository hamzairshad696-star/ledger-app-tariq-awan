import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMonth, summarize, autoAllocate, advanceStatusFrom } from '../src/lib/ledger-calc.js';

const person = { status: 'active', joining_date: null, monthly_amount: 10000 };
const cur = { year: 2026, month: 4 }; // "today" is April 2026
const cell = (month, extra = {}) => computeMonth({ person, year: 2026, month, current: cur, ...extra });

test('March paid + advance given, April/May covered by advance, June not started', () => {
  const march = cell(3, {
    payments: [{ amount: 10000, payment_date: '2026-03-15' }],
    advancesGiven: [{ id: 1, total_amount: 20000, allocations: [{ year: 2026, month: 4, amount: 10000 }, { year: 2026, month: 5, amount: 10000 }] }],
  });
  assert.equal(march.status, 'paid');
  assert.equal(march.advanceGivenAmount, 20000);
  assert.deepEqual(march.advanceGivenFor.map((x) => x.month), [4, 5]);

  const april = cell(4, { allocations: [{ amount: 10000, advance_id: 1, advance_payment_date: '2026-03-15' }] });
  assert.equal(april.status, 'advance_paid');
  assert.equal(april.pending, 0);
  assert.equal(april.advanceSources[0].paidOn, '2026-03-15');

  const may = cell(5, { allocations: [{ amount: 10000, advance_id: 1 }] });
  assert.equal(may.status, 'advance_paid');

  const june = cell(6);
  assert.equal(june.status, 'upcoming');
  assert.equal(june.pending, 0);
  assert.equal(june.upcoming, 10000);

  const s = summarize([march, april, may, june]);
  assert.equal(s.paidTotal, 10000);
  assert.equal(s.advanceTotal, 20000);
  assert.equal(s.pendingTotal, 0);
  assert.equal(s.netTotal, 30000);
});

test('due month with nothing paid is pending; partial is partial', () => {
  assert.equal(cell(2).status, 'pending');
  assert.equal(cell(2).pending, 10000);
  const p = cell(1, { payments: [{ amount: 4000, payment_date: '2026-01-02' }] });
  assert.equal(p.status, 'partial');
  assert.equal(p.pending, 6000);
});

test('months before joining date are N/A; inactive people accrue nothing new', () => {
  const late = computeMonth({ person: { ...person, joining_date: '2026-03-10' }, year: 2026, month: 2, current: cur });
  assert.equal(late.status, 'na');
  assert.equal(late.required, 0);
  const inactive = computeMonth({ person: { ...person, status: 'inactive' }, year: 2026, month: 2, current: cur });
  assert.equal(inactive.status, 'na');
  assert.equal(inactive.pending, 0);
});

test('autoAllocate fills months in order and reports leftovers', () => {
  const months = [{ year: 2026, month: 4, remaining: 10000 }, { year: 2026, month: 5, remaining: 10000 }];
  assert.deepEqual(autoAllocate(15000, months), { allocations: [{ year: 2026, month: 4, amount: 10000 }, { year: 2026, month: 5, amount: 5000 }], unallocated: 0 });
  assert.equal(autoAllocate(25000, months).unallocated, 5000);
});

test('advance status reports last covered month', () => {
  const st = advanceStatusFrom([{ year: 2026, month: 5, amount: 10000 }, { year: 2026, month: 6, amount: 10000 }]);
  assert.equal(st.through.month, 6);
  assert.equal(st.amount, 20000);
});
