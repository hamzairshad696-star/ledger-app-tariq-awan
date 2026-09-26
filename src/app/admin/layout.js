import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AdminShell from '@/components/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (user.role !== 'admin') redirect('/viewer');
  return <AdminShell user={{ name: user.name, username: user.username }}>{children}</AdminShell>;
}
