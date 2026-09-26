// Applies db/schema.sql (idempotent) and makes sure the default year exists.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const f of ['.env.local', '.env']) {
  const p = path.join(root, f);
  if (existsSync(p) && typeof process.loadEnvFile === 'function') { try { process.loadEnvFile(p); } catch {} }
}
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(1); }

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: isLocal ? false : { rejectUnauthorized: false } });
await client.connect();
await client.query(readFileSync(path.join(root, 'db', 'schema.sql'), 'utf8'));
const year = Number(process.env.DEFAULT_YEAR || 2026);
await client.query('INSERT INTO ledger_years (year) VALUES ($1) ON CONFLICT DO NOTHING', [year]);
await client.end();
console.log(`✔ Database schema is up to date (default year ${year}).`);
