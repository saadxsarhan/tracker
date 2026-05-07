import Link from 'next/link';
import { fetchOpsTrackerRows } from '@/lib/scorecard-server';
import { prisma } from '@/lib/db';
import { getSession, type Role } from '@/lib/auth';
import { OPS_KPIS } from '@/lib/kpi-config';
import { OpsTrackerGrid } from './OpsTrackerGrid';
import { PeriodPicker } from '@/components/PeriodPicker';

function currentPeriod() { return new Date().toISOString().slice(0, 7); }

export default async function OpsPage({ searchParams }: { searchParams: { period?: string; status?: string; owner?: string } }) {
  const session = await getSession();
  const period = searchParams.period ?? currentPeriod();
  const allRows = await fetchOpsTrackerRows(period);

  // Apply filters
  let rows = allRows;
  if (searchParams.status) rows = rows.filter(r => r.dashboard.status === searchParams.status);
  if (searchParams.owner === 'me' && session.userId) {
    rows = rows.filter(r => r.dashboard.deOwnerId === session.userId || r.dashboard.biOwnerId === session.userId);
  }

  const lock = await prisma.periodLock.findUnique({ where: { period } });
  const locked = !!lock;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Ops SLA Tracker</h1>
          <p className="text-sm text-slate-500">Targets pull from SLA Tiers based on each dashboard's tier. Inline-edit Actuals; auto-saves.</p>
        </div>
        <div className="flex gap-2 items-center">
          <PeriodPicker value={period} basePath="/ops" />
          {locked
            ? <span className="rag-pill rag-red">PERIOD LOCKED</span>
            : <span className="text-xs text-slate-400">Period unlocked</span>}
          {session.role === 'ADMIN' && (
            <form method="post" action={`/api/period-lock/${period}/${locked ? 'unlock' : 'lock'}`}>
              <button className="btn-secondary text-sm" type="submit">{locked ? 'Unlock' : 'Lock period'}</button>
            </form>
          )}
        </div>
      </div>

      <form className="card flex gap-3 flex-wrap items-end" method="get">
        <input type="hidden" name="period" value={period} />
        <div>
          <label className="label">Status</label>
          <select className="input w-40" name="status" defaultValue={searchParams.status ?? ''}>
            <option value="">All</option>
            {['Live', 'In Build', 'In Scoping', 'Not Started', 'Retired'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Owner</label>
          <select className="input w-40" name="owner" defaultValue={searchParams.owner ?? ''}>
            <option value="">All</option>
            <option value="me">Mine only</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">Filter</button>
        <Link href={`/ops?period=${period}&status=Live`} className="btn-ghost text-sm">Live only</Link>
      </form>

      <OpsTrackerGrid
        rows={rows.map(r => ({
          dashboardId: r.dashboard.id,
          name: r.dashboard.name,
          status: r.dashboard.status,
          tier: r.dashboard.tier,
          deOwnerId: r.dashboard.deOwnerId,
          biOwnerId: r.dashboard.biOwnerId,
          targets: r.targets,
          actuals: r.actuals
        }))}
        kpis={OPS_KPIS}
        period={period}
        locked={locked}
        userId={session.userId!}
        role={session.role as Role}
      />
    </div>
  );
}
