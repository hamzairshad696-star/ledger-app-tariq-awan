import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ViewerShell from '@/components/ViewerShell';

export const dynamic = 'force-dynamic';

export default async function ViewerLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (user.role !== 'viewer') redirect('/admin');
  return <ViewerShell user={{ name: user.name }}>{children}</ViewerShell>;
}
