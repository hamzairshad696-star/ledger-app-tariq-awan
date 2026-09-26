import { route, json } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const GET = route(async (req, { user }) => json({ user: { id: user.id, name: user.name, username: user.username, role: user.role } }), { role: 'any' });
