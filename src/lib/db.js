import pg from 'pg';

// Return DATE columns as 'YYYY-MM-DD' strings and NUMERIC as JS numbers.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(20, (v) => Number(v));

function makePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  return new pg.Pool({
    connectionString,
    ssl: isLocal || /sslmode=disable/.test(connectionString) ? false : { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_MAX || 5),
    idleTimeoutMillis: 10_000,
  });
}

// Reuse one pool across hot reloads / serverless invocations.
const g = globalThis;
export function getPool() {
  if (!g.__ledgerPool) g.__ledgerPool = makePool();
  return g.__ledgerPool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

/** Run fn(client) inside a transaction. */
export async function tx(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

/** A tiny adapter so services accept either the pool or a tx client. */
export function db(client) {
  return client || { parallel: true, query: (t, p) => getPool().query(t, p) };
}
