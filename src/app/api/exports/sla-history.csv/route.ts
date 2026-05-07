import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toCSV } from '@/lib/csv';

export async function GET() {
  const session = await getSession();
  if (!session.userId) return new Response('Unauthenticated', { status: 401 });
  const acts = await prisma.opsSLAActual.findMany({
    include: { dashboard: true }, orderBy: [{ period: 'desc' }, { dashboardId: 'asc' }]
  });
  const rows = acts.map(a => ({
    period: a.period, dashboard_id: a.dashboardId, dashboard: a.dashboard.name,
    tier: a.dashboard.tier, status: a.dashboard.status,
    kpi: a.kpiKey, actual: a.actualValue, recorded_at: a.recordedAt
  }));
  return new Response(toCSV(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="sla-history.csv"'
    }
  });
}
