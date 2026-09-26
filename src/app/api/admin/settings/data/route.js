import { route, json, body } from '@/lib/api';
import { tx } from '@/lib/db';
import { loadDemoData, clearAllData } from '@/lib/demo-data';
import { audit } from '@/lib/ledger-service';
import { badRequest } from '@/lib/errors';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
// { action: 'load-demo' } or { action: 'clear', confirmText: 'DELETE' }
export const POST = route(async (req, { user }) => {
  const b = z.object({ action: z.enum(['load-demo', 'clear']), confirmText: z.string().optional() }).parse(await body(req));
  if (b.action === 'clear') {
    if (b.confirmText !== 'DELETE') throw badRequest('Type DELETE to confirm.');
    await tx(async (c) => { await clearAllData(c); await audit(c, user, 'data.clear', 'system', null, 'Deleted all ledger data'); });
    return json({ ok: true });
  }
  try {
    const r = await tx(async (c) => { const res = await loadDemoData(c, user); await audit(c, user, 'data.demo', 'system', null, 'Loaded demo data'); return res; });
    return json({ ok: true, ...r });
  } catch (e) {
    if (e.message?.startsWith('Demo data can only')) throw badRequest(e.message);
    throw e;
  }
});
