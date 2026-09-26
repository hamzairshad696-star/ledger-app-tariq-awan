// Creates the Admin account (Tariq Awan) if missing. `--demo` also loads demo data.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const f of ['.env.local', '.env']) {
  const p = path.join(root, f);
  if (existsSync(p) && typeof process.loadEnvFile === 'function') { try { process.loadEnvFile(p); } catch {} }
}

const { tx, getPool } = await import('../src/lib/db.js');
const { hashPassword } = await import('../src/lib/password.js');
const { loadDemoData } = await import('../src/lib/demo-data.js');

const username = (process.env.ADMIN_USERNAME || 'tariq').trim();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME || 'Tariq Awan';
const wantDemo = process.argv.includes('--demo') || process.env.SEED_DEMO === 'true';

await tx(async (c) => {
  const { rows } = await c.query("SELECT id FROM users WHERE role='admin'");
  if (!rows.length) {
    if (!password || password.length < 8) throw new Error('Set ADMIN_PASSWORD (8+ characters) to create the admin account.');
    await c.query("INSERT INTO users (username, password_hash, name, role) VALUES ($1,$2,$3,'admin')", [username, await hashPassword(password), name]);
    console.log(`✔ Admin account created: ${name} (username "${username}")`);
  } else {
    console.log('✔ Admin account already exists — not changed.');
  }
});

if (wantDemo) {
  const { rows } = await getPool().query('SELECT COUNT(*)::int AS n FROM people');
  if (rows[0].n > 0) {
    console.log('• People already exist — demo data skipped.');
  } else {
    const admin = (await getPool().query("SELECT id, name FROM users WHERE role='admin' LIMIT 1")).rows[0];
    const r = await tx((c) => loadDemoData(c, admin));
    console.log(`✔ Demo data loaded: ${r.people} people. Demo viewer: viewer.demo / Viewer@2026`);
  }
}
await getPool().end();
