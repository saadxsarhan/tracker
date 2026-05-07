import type { Role } from '@/lib/permissions';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';

export function AppShell({
  role,
  userName,
  userEmail,
  locale,
  children,
  currentPath
}: {
  role: Role;
  userName: string;
  userEmail: string;
  locale: 'en' | 'ar';
  children: React.ReactNode;
  currentPath: string;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} locale={locale} currentPath={currentPath} />
      <div className="flex-1 flex flex-col">
        <TopBar role={role} userName={userName} userEmail={userEmail} locale={locale} />
        <main className="flex-1 p-6 max-w-screen-2xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
