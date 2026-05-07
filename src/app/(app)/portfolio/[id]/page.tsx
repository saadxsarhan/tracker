import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSession, canEditDashboard, type Role } from '@/lib/auth';
import { DashboardForm } from './DashboardForm';

export default async function DashboardDetail({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) notFound();
  const session = await getSession();
  const dash = await prisma.dashboard.findUnique({
    where: { id },
    include: { deOwner: true, biOwner: true, milestones: { orderBy: { stage: 'asc' } } }
  });
  if (!dash) notFound();

  const canEdit = canEditDashboard(session.role as Role, { de: dash.deOwnerId, bi: dash.biOwnerId }, session.userId!);
  const users = await prisma.user.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } });

  // last 6 periods of opt actuals for trend
  const recentActuals = await prisma.opsSLAActual.findMany({
    where: { dashboardId: id },
    orderBy: { period: 'desc' },
    take: 60
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portfolio" className="text-sm text-navy hover:underline">← Portfolio</Link>
        <h1 className="text-2xl font-bold text-navy mt-2">{dash.name}</h1>
        <p className="text-sm text-slate-500">ID #{dash.id} · {dash.domain} · {dash.status} · {dash.tier}</p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Governance</h2>
        <DashboardForm dashboard={dash} users={users} canEdit={canEdit && session.role === 'ADMIN'} />
      </div>

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Ops SLA history (last 60 records)</h2>
        {recentActuals.length === 0 ? (
          <p className="text-sm text-slate-500">No actuals recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Period</th><th>KPI</th><th>Actual</th></tr></thead>
              <tbody>
                {recentActuals.map(a => (
                  <tr key={a.id}><td className="font-mono">{a.period}</td><td>{a.kpiKey}</td><td>{a.actualValue}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
