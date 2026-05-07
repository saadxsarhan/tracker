import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toCSV } from '@/lib/csv';

export async function GET() {
  const session = await getSession();
  if (!session.userId) return new Response('Unauthenticated', { status: 401 });
  const ds = await prisma.dashboard.findMany({
    where: { archivedAt: null },
    include: { milestones: { orderBy: { stage: 'asc' } } },
    orderBy: { id: 'asc' }
  });
  const rows = ds.map(d => {
    const ms = (s: number) => d.milestones.find(m => m.stage === s);
    const fmt = (v: Date | null | undefined) => v ? v.toISOString().slice(0, 10) : '';
    return {
      id: d.id, name: d.name, domain: d.domain, status: d.status,
      brd_planned: fmt(ms(1)?.plannedDate), brd_actual: fmt(ms(1)?.actualDate),
      design_planned: fmt(ms(2)?.plannedDate), design_actual: fmt(ms(2)?.actualDate),
      datamodel_planned: fmt(ms(3)?.plannedDate), datamodel_actual: fmt(ms(3)?.actualDate),
      pipeline_planned: fmt(ms(4)?.plannedDate), pipeline_actual: fmt(ms(4)?.actualDate),
      visual_planned: fmt(ms(5)?.plannedDate), visual_actual: fmt(ms(5)?.actualDate),
      uat_planned: fmt(ms(6)?.plannedDate), uat_actual: fmt(ms(6)?.actualDate),
      production_planned: fmt(ms(7)?.plannedDate), production_actual: fmt(ms(7)?.actualDate),
      pct_complete: d.milestones.filter(m => m.actualDate).length / 7
    };
  });
  return new Response(toCSV(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="delivery.csv"'
    }
  });
}
