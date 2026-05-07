import { fetchScorecard, currentPeriod } from '@/lib/scorecard-server';
import { getSession } from '@/lib/auth';
import { toCSV } from '@/lib/csv';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.userId) return new Response('Unauthenticated', { status: 401 });
  const url = new URL(req.url);
  const period = url.searchParams.get('period') ?? currentPeriod();
  const { scorecard } = await fetchScorecard(period);
  const rows: Record<string, unknown>[] = [];
  const sections = [
    { section: 'Ops · Yasir',     s: scorecard.ops.yasir },
    { section: 'Ops · Ahmad',     s: scorecard.ops.ahmad },
    { section: 'Delivery · Joint',s: scorecard.delivery.joint },
    { section: 'Delivery · Yasir',s: scorecard.delivery.yasir },
    { section: 'Delivery · Ahmad',s: scorecard.delivery.ahmad }
  ];
  for (const sec of sections) {
    for (const r of sec.s.rows) {
      rows.push({
        period, section: sec.section,
        kpi: r.kpi.name, owner: r.kpi.owner, direction: r.kpi.direction,
        unit: r.kpi.unit, target: r.target, weight: r.weight,
        actual: r.actual ?? '', score: r.scoreVal ?? '', rag: r.rag ?? ''
      });
    }
    rows.push({ period, section: sec.section, kpi: '— Weighted —', actual: '', score: sec.s.weightedScore ?? '', rag: sec.s.rag ?? '' });
  }
  rows.push({ period, section: 'Overall · Yasir', score: scorecard.overall.yasir.score ?? '', rag: scorecard.overall.yasir.rag ?? '' });
  rows.push({ period, section: 'Overall · Ahmad', score: scorecard.overall.ahmad.score ?? '', rag: scorecard.overall.ahmad.rag ?? '' });

  return new Response(toCSV(rows, ['period', 'section', 'kpi', 'owner', 'direction', 'unit', 'target', 'weight', 'actual', 'score', 'rag']), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="scorecard-${period}.csv"`
    }
  });
}
