import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { fetchScorecard, currentPeriod } from '@/lib/scorecard-server';
import { prisma } from '@/lib/db';
import { RagPill } from '@/components/RagPill';

function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return '—';
  return (n * 100).toFixed(digits) + '%';
}

function num(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(digits);
}

export default async function OverviewPage() {
  const session = await getSession();
  const period = currentPeriod();
  const { scorecard, deliverySummary, counts } = await fetchScorecard(period);

  const dashboards = await prisma.dashboard.findMany({
    where: { archivedAt: null },
    orderBy: { id: 'asc' },
    include: { deOwner: true, biOwner: true }
  });

  // Recent activity
  const recent = await prisma.auditLog.findMany({
    take: 10, orderBy: { timestamp: 'desc' },
    include: { user: true }
  });

  // For Yasir/Ahmad: which Live dashboards still need actuals this period?
  const myDashboards = dashboards.filter(d => {
    if (session.role === 'DATA_ENGINEER') return d.deOwnerId === session.userId && d.status === 'Live';
    if (session.role === 'BI_DEVELOPER') return d.biOwnerId === session.userId && d.status === 'Live';
    return false;
  });

  let pendingEntries: number | null = null;
  if (session.role === 'DATA_ENGINEER' || session.role === 'BI_DEVELOPER') {
    const have = await prisma.opsSLAActual.count({
      where: { period, dashboardId: { in: myDashboards.map(d => d.id) } }
    });
    pendingEntries = myDashboards.length * 10 - have;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Overview</h1>
        <p className="text-sm text-slate-500">Period: <span className="font-mono font-semibold">{period}</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="Yasir — overall" value={pct(scorecard.overall.yasir.score)} rag={scorecard.overall.yasir.rag} />
        <Card label="Ahmad — overall" value={pct(scorecard.overall.ahmad.score)} rag={scorecard.overall.ahmad.rag} />
        <Card label="Live dashboards" value={String(counts.live)} sub={`${counts.total} total`} />
        <Card label="In delivery" value={String(counts.inflight)} sub={`portfolio ${pct(deliverySummary.portfolio_pct_complete)} avg`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Operations pillar — at a glance</h2>
          <div className="space-y-2">
            <SectionRow title="Yasir · Data Engineering"
              score={scorecard.ops.yasir.weightedScore} rag={scorecard.ops.yasir.rag} />
            <SectionRow title="Ahmad · BI"
              score={scorecard.ops.ahmad.weightedScore} rag={scorecard.ops.ahmad.rag} />
          </div>
          <Link href="/scorecard" className="text-sm text-navy hover:underline mt-3 inline-block">View full scorecard →</Link>
        </div>

        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Delivery pillar — at a glance</h2>
          <div className="space-y-2">
            <SectionRow title="Joint" score={scorecard.delivery.joint.weightedScore} rag={scorecard.delivery.joint.rag} />
            <SectionRow title="Yasir · DE" score={scorecard.delivery.yasir.weightedScore} rag={scorecard.delivery.yasir.rag} />
            <SectionRow title="Ahmad · BI" score={scorecard.delivery.ahmad.weightedScore} rag={scorecard.delivery.ahmad.rag} />
          </div>
          <div className="text-xs text-slate-500 mt-3">
            On-time delivery: {pct(deliverySummary.on_time_delivery)} · Avg cycle: {num(deliverySummary.avg_cycle_time, 0)} days
          </div>
        </div>
      </div>

      {(session.role === 'DATA_ENGINEER' || session.role === 'BI_DEVELOPER') && (
        <div className="card">
          <h2 className="font-semibold text-navy mb-3">Your tasks</h2>
          <p className="text-sm">
            {pendingEntries !== null && pendingEntries > 0 ? (
              <span className="text-rag-red font-semibold">
                {pendingEntries} SLA actual{pendingEntries === 1 ? '' : 's'} not yet entered for this period.
              </span>
            ) : (
              <span className="text-rag-green font-semibold">All your SLA actuals are entered for this period. ✓</span>
            )}
          </p>
          <p className="text-sm text-slate-500 mt-1">{myDashboards.length} dashboards owned</p>
          <Link href="/ops" className="text-sm text-navy hover:underline mt-2 inline-block">Go to Ops SLA Tracker →</Link>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold text-navy mb-3">Recent activity</h2>
        {recent.length === 0 && <p className="text-sm text-slate-500">No activity yet.</p>}
        <ul className="divide-y divide-slate-200 text-sm">
          {recent.map(a => (
            <li key={a.id} className="py-2 flex items-center justify-between">
              <span>
                <span className="font-medium">{a.user?.name ?? 'system'}</span>
                <span className="text-slate-500"> {a.action.toLowerCase()} </span>
                <span className="font-mono text-xs">{a.entityType}#{a.entityId}</span>
              </span>
              <time className="text-xs text-slate-400">{new Date(a.timestamp).toISOString().slice(0, 16).replace('T', ' ')}</time>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Card({ label, value, sub, rag }: {
  label: string; value: string; sub?: string;
  rag?: 'Green' | 'Amber' | 'Red' | null;
}) {
  return (
    <div className="card">
      <div className="text-xs uppercase text-slate-500 font-semibold tracking-wide">{label}</div>
      <div className="flex items-baseline justify-between mt-2">
        <div className="text-3xl font-bold text-navy">{value}</div>
        {rag && <RagPill rag={rag} />}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function SectionRow({ title, score, rag }: { title: string; score: number | null; rag: 'Green' | 'Amber' | 'Red' | null }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-700">{title}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono font-semibold w-16 text-right">{score === null ? '—' : (score * 100).toFixed(1) + '%'}</span>
        <RagPill rag={rag} />
      </div>
    </div>
  );
}
