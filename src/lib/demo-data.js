/**
 * Demo data: 40 people (25 married, 15 unmarried) with realistic scenarios.
 * Uses the same service functions as the app, so every rule is enforced.
 */
import { createPerson, recordPayment, createAdvance, closeMonth, ensureYear } from './ledger-service.js';
import { currentPeriod, todayISO, pIndex, fromIndex } from './dates.js';
import { hashPassword } from './password.js';

const NAMES = [
  ['Hamza', 'Ahmed'], ['Bilal', 'Aslam'], ['Usman', 'Farooq'], ['Ali Raza', 'Ghulam Rasool'], ['Imran', 'Saeed'],
  ['Kashif', 'Mehmood'], ['Faisal', 'Iqbal'], ['Adeel', 'Shahid'], ['Waqas', 'Anwar'], ['Zeeshan', 'Akram'],
  ['Shahzad', 'Bashir'], ['Naveed', 'Latif'], ['Asad', 'Rafiq'], ['Tahir', 'Yousaf'], ['Fahad', 'Nadeem'],
  ['Junaid', 'Khalid'], ['Rizwan', 'Siddique'], ['Sohail', 'Arshad'], ['Nadeem', 'Hanif'], ['Salman', 'Javed'],
  ['Atif', 'Zafar'], ['Irfan', 'Maqsood'], ['Shoaib', 'Riaz'], ['Arslan', 'Tariq'], ['Qasim', 'Ashraf'],
  ['Danish', 'Sarwar'], ['Owais', 'Nawaz'], ['Hassan', 'Mushtaq'], ['Umair', 'Rehman'], ['Talha', 'Habib'],
  ['Saad', 'Qadeer'], ['Haris', 'Munir'], ['Ahsan', 'Karim'], ['Moiz', 'Sattar'], ['Zain', 'Abbas'],
  ['Ammar', 'Ishaq'], ['Shayan', 'Rauf'], ['Mudassir', 'Hameed'], ['Noman', 'Sabir'], ['Ehsan', 'Majeed'],
];
const AMOUNTS = [10000, 8000, 12000, 7500, 15000, 10000, 9000, 6000, 11000, 10000];

// Deterministic PRNG so demo data is identical each time
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

export async function loadDemoData(client, user) {
  const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM people');
  if (rows[0].n > 0) throw new Error('Demo data can only be loaded into an empty ledger. Clear the existing data first.');

  await ensureYear(client, 2026);
  const today = todayISO();
  const cur = currentPeriod(today);
  const Y = 2026;
  const last = cur.year > Y ? 12 : cur.year < Y ? 0 : cur.month; // last month of 2026 that has started
  const rand = rng(42);
  const day = (y, m, d) => {
    let dd = Math.min(d, 28);
    if (y === cur.year && m === cur.month) dd = Math.min(dd, Number(today.slice(8, 10)));
    return `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  };
  const payFull = async (p, m, d = 5) =>
    recordPayment(client, user, { person_id: p.id, year: Y, month: m, amount: Number(p.monthly_amount), payment_date: day(Y, m, d), method: rand() > 0.5 ? 'cash' : 'bank', reference: '', notes: '' });
  const future = (fromMonth, n) => Array.from({ length: n }, (_, k) => fromIndex(pIndex(Y, fromMonth) + k + 1));

  // Scenario for each of the 40 people (index 0 is Hamza — the exact example from the brief)
  const plan = [
    'hamza', 'regular', 'one_adv', 'two_adv', 'partial', 'pending', 'multi_adv', 'regular', 'regular', 'one_adv',
    'pending', 'regular', 'two_adv', 'regular', 'partial', 'regular', 'late_joiner', 'regular', 'pending', 'one_adv',
    'regular', 'multi_adv', 'regular', 'regular', 'inactive', 'regular', 'two_adv', 'pending', 'regular', 'regular',
    'partial', 'regular', 'one_adv', 'regular', 'inactive', 'regular', 'pending', 'regular', 'regular', 'regular',
  ];

  const people = [];
  for (let i = 0; i < 40; i++) {
    const [name, father] = NAMES[i];
    const scenario = plan[i];
    const married = ![3, 6, 7].includes(i % 8); // 25 married / 15 unmarried
    const monthly = i === 0 ? 10000 : AMOUNTS[i % AMOUNTS.length];
    const p = await createPerson(client, user, {
      sr_no: i + 1,
      name,
      father_name: father,
      status: 'active', // 'inactive' scenarios are switched after their payments are recorded
      marital_status: married ? 'married' : 'unmarried',
      split_cash: i === 0 ? 10000 : Math.round((monthly * (0.4 + rand() * 0.6)) / 500) * 500,
      account: String(12345 + i * 1117).padStart(5, '0'),
      monthly_amount: monthly,
      joining_date: scenario === 'late_joiner' ? '2026-06-01' : null,
      notes: scenario === 'hamza' ? 'Example from the brief: March payment with April + May advance.' : '',
    });
    people.push({ p, scenario });
  }

  for (const { p, scenario } of people) {
    const amt = Number(p.monthly_amount);
    switch (scenario) {
      case 'hamza': {
        if (last >= 1) await payFull(p, 1, 10);
        if (last >= 2) await payFull(p, 2, 12);
        if (last >= 3) {
          await recordPayment(client, user, {
            person_id: p.id, year: Y, month: 3, amount: 10000, payment_date: day(Y, 3, 15), method: 'cash', reference: '', notes: 'March payment',
            advance: { total_amount: 20000, allocations: [{ year: Y, month: 4, amount: 10000 }, { year: Y, month: 5, amount: 10000 }], notes: 'Two months advance (April + May)' },
          });
        }
        break;
      }
      case 'regular':
        for (let m = 1; m <= last; m++) await payFull(p, m, 3 + Math.floor(rand() * 20));
        break;
      case 'one_adv':
        for (let m = 1; m <= last; m++) await payFull(p, m, 5);
        if (last >= 1) await createAdvance(client, user, { person_id: p.id, payment_date: day(Y, last, 6), total_amount: amt, allocations: future(last, 1).map((f) => ({ ...f, amount: amt })), notes: 'One month advance' });
        break;
      case 'two_adv':
        for (let m = 1; m <= last - 1; m++) await payFull(p, m, 8);
        if (last >= 2) await createAdvance(client, user, { person_id: p.id, payment_date: day(Y, last - 1, 9), total_amount: amt * 2, allocations: future(last - 1, 2).map((f) => ({ ...f, amount: amt })), notes: 'Two months advance' });
        break;
      case 'partial':
        for (let m = 1; m < last; m++) await payFull(p, m, 7);
        if (last >= 1) await recordPayment(client, user, { person_id: p.id, year: Y, month: last, amount: Math.round(amt / 2), payment_date: day(Y, last, 4), method: 'cash', reference: '', notes: 'Half paid' });
        break;
      case 'pending': {
        const stop = Math.max(0, last - 2 - Math.floor(rand() * 3));
        for (let m = 1; m <= stop; m++) await payFull(p, m, 11);
        break;
      }
      case 'multi_adv':
        if (last >= 1) await payFull(p, 1, 5);
        if (last >= 2) {
          await payFull(p, 2, 5);
          await createAdvance(client, user, { person_id: p.id, payment_date: day(Y, 2, 20), total_amount: amt, allocations: [{ year: Y, month: 3, amount: amt }], notes: 'Advance for March' });
        }
        for (let m = 4; m <= Math.min(last, 5); m++) await payFull(p, m, 6);
        if (last >= 5) await createAdvance(client, user, { person_id: p.id, payment_date: day(Y, 5, 25), total_amount: amt * 2, allocations: [{ year: Y, month: 6, amount: amt }, { year: Y, month: 7, amount: amt }], notes: 'Advance for June + July' });
        for (let m = 8; m <= last; m++) await payFull(p, m, 6);
        break;
      case 'late_joiner':
        for (let m = 6; m <= last; m++) await payFull(p, m, 14);
        break;
      case 'inactive':
        for (let m = 1; m <= Math.min(last, 4); m++) await payFull(p, m, 9);
        break;
    }
  }

  // People who left: mark inactive after their payments were recorded
  for (const { p, scenario } of people) {
    if (scenario === 'inactive') await client.query("UPDATE people SET status='inactive', notes='Left in April 2026' WHERE id=$1", [p.id]);
  }

  // Previous month closings: January and February 2026
  for (let m = 1; m <= Math.min(2, last); m++) await closeMonth(client, user, Y, m);

  // Demo viewer account assigned to three people
  const { rows: v } = await client.query("SELECT id FROM users WHERE username='viewer.demo'");
  let viewerId = v[0]?.id;
  if (!viewerId) {
    const hash = await hashPassword('Viewer@2026');
    const { rows: nv } = await client.query("INSERT INTO users (username, password_hash, name, role) VALUES ('viewer.demo', $1, 'Demo Viewer', 'viewer') RETURNING id", [hash]);
    viewerId = nv[0].id;
  }
  for (const idx of [0, 3, 4]) {
    await client.query('INSERT INTO viewer_assignments (viewer_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [viewerId, people[idx].p.id]);
  }

  return { people: people.length };
}

/** Remove every ledger record (people, payments, advances, closings). User accounts are kept. */
export async function clearAllData(client) {
  await client.query('DELETE FROM viewer_assignments');
  await client.query('DELETE FROM advance_allocations');
  await client.query('DELETE FROM advances');
  await client.query('DELETE FROM payments');
  await client.query('DELETE FROM monthly_ledger');
  await client.query('DELETE FROM people');
  await client.query('DELETE FROM monthly_closings');
  await client.query('DELETE FROM closing_events');
  await client.query("DELETE FROM users WHERE role='viewer'");
}
