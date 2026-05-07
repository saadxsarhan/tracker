import { prisma } from '@/lib/db';
import { getSession, type Role } from '@/lib/auth';
import { STAGES } from '@/lib/kpi-config';
import { pctComplete, deliveryStatus, type DeliveryRow } from '@/lib/calc';
import { DeliveryGrid } from './DeliveryGrid';

export default async function DeliveryPage({ searchParams }: { searchParams: { domain?: string; status?: string } }) {
  const session = await getSession();

  const dashboards = await prisma.dashboard.findMany({
    where: { archivedAt: null, status: { in: ['In Build', 'In Scoping', 'Not Started', 'Live'] } },
    include: { milestones: { orderBy: { stage: 'asc' } }, deOwner: true, biOwner: true },
    orderBy: { id: 'asc' }
  });

  // Show only those that have at least one milestone OR are in build (i.e. delivery-tracked)
  const inflight = dashboards.filter(d =>
    d.status !== 'Live' || d.milestones.some(m => m.plannedDate || m.actualDate)
  );

  let filtered = inflight;
  if (searchParams.domain) filtered = filtered.filter(d => d.domain === searchParams.domain);
  if (searchParams.status) filtered = filtered.filter(d => d.status === searchParams.status);

  const rows = filtered.map(d => {
    const dr: DeliveryRow = {
      milestones: [1, 2, 3, 4, 5, 6, 7].map(stage => {
        const m = d.milestones.find(x => x.stage === stage);
        return { stage, planned: m?.plannedDate ?? null, actual: m?.actualDate ?? null };
      })
    };
    return {
      dashboardId: d.id,
      name: d.name,
      domain: d.domain,
      status: d.status,
      deOwnerId: d.deOwnerId,
      biOwnerId: d.biOwnerId,
      milestones: dr.milestones.map(m => ({
        stage: m.stage,
        planned: m.planned ? m.planned.toISOString().slice(0, 10) : null,
        actual: m.actual ? m.actual.toISOString().slice(0, 10) : null
      })),
      pct: pctComplete(dr),
      derivedStatus: deliveryStatus(dr)
    };
  });

  const domains = Array.from(new Set(inflight.map(d => d.domain))).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Delivery Tracker</h1>
          <p className="text-sm text-slate-500">7-stage delivery: BRD → Design → Data Model → Pipeline → Visual → UAT → Production.</p>
        </div>
      </div>

      <form className="card flex gap-3 flex-wrap items-end" method="get">
        <div>
          <label className="label">Domain</label>
          <select className="input w-48" name="domain" defaultValue={searchParams.domain ?? ''}>
            <option value="">All</option>
            {domains.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input w-44" name="status" defaultValue={searchParams.status ?? ''}>
            <option value="">All</option>
            {['In Build', 'In Scoping', 'Not Started', 'Live'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary">Filter</button>
      </form>

      <DeliveryGrid rows={rows} stages={STAGES} userId={session.userId!} role={session.role as Role} />
    </div>
  );
}
