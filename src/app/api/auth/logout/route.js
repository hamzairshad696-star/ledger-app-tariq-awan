import { route, json } from '@/lib/api';
import { clearSessionCookie } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const POST = route(async () => { clearSessionCookie(); return json({ ok: true }); }, { role: null });
