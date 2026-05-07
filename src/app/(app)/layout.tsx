import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSession, type Role } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect('/login');
  const path = headers().get('x-pathname') ?? '/overview';
  return (
    <AppShell
      role={session.role as Role}
      userName={session.name ?? ''}
      userEmail={session.email ?? ''}
      locale={session.locale ?? 'en'}
      currentPath={path}
    >
      {children}
    </AppShell>
  );
}
