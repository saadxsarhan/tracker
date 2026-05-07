import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession, canEditOpsActual, type Role } from '@/lib/auth';
import { audit } from '@/lib/audit';

const Schema = z.object({
  dashboardId: z.number(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  kpiKey: z.string(),
  actualValue: z.number()
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const dash = await prisma.dashboard.findUnique({ where: { id: parsed.data.dashboardId } });
  if (!dash) return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });

  const role = session.role as Role;
  if (!canEditOpsActual(role, { de: dash.deOwnerId, bi: dash.biOwnerId }, session.userId!)) {
    return NextResponse.json({ error: 'Forbidden — you do not own this dashboard' }, { status: 403 });
  }

  const lock = await prisma.periodLock.findUnique({ where: { period: parsed.data.period } });
  if (lock && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Period is locked' }, { status: 403 });
  }

  const before = await prisma.opsSLAActual.findUnique({
    where: { dashboardId_period_kpiKey: { dashboardId: parsed.data.dashboardId, period: parsed.data.period, kpiKey: parsed.data.kpiKey } }
  });

  const saved = await prisma.opsSLAActual.upsert({
    where: { dashboardId_period_kpiKey: { dashboardId: parsed.data.dashboardId, period: parsed.data.period, kpiKey: parsed.data.kpiKey } },
    update: { actualValue: parsed.data.actualValue, recordedById: session.userId },
    create: { ...parsed.data, recordedById: session.userId }
  });

  await audit({
    userId: session.userId!,
    action: before ? 'UPDATE' : 'CREATE',
    entityType: 'OpsSLAActual',
    entityId: saved.id,
    before, after: saved
  });

  return NextResponse.json(saved);
}
