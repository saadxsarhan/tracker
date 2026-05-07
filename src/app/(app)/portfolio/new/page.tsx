import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NewDashboardForm } from './NewDashboardForm';

export default async function NewDashboard() {
  const session = await getSession();
  if (session.role !== 'ADMIN') redirect('/portfolio');
  const users = await prisma.user.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } });
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-navy">New Dashboard</h1>
      <div className="card">
        <NewDashboardForm users={users} />
      </div>
    </div>
  );
}
