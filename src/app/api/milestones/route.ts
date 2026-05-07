import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession, canEditMilestone, type Role } from '@/lib/auth';
import { audit } from '@/lib/audit';

const Schema = z.object({
  dashboardId: z.number(),
  stage: z.number().min(1).max(7),
  planned: z.string().nullable().optional(),
  actual: z.string().nullable().optional()
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
  if (!canEditMilestone(role, parsed.data.stage, { de: dash.deOwnerId, bi: dash.biOwnerId }, session.userId!)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const before = await prisma.deliveryMilestone.findUnique({
    where: { dashboardId_stage: { dashboardId: parsed.data.dashboardId, stage: parsed.data.stage } }
  });

  const data: any = { updatedById: session.userId };
  if ('planned' in parsed.data) data.plannedDate = parsed.data.planned ? new Date(parsed.data.planned) : null;
  if ('actual' in parsed.data) data.actualDate = parsed.data.actual ? new Date(parsed.data.actual) : null;

  const saved = await prisma.deliveryMilestone.upsert({
    where: { dashboardId_stage: { dashboardId: parsed.data.dashboardId, stage: parsed.data.stage } },
    update: data,
    create: {
      dashboardId: parsed.data.dashboardId,
      stage: parsed.data.stage,
      plannedDate: parsed.data.planned ? new Date(parsed.data.planned) : null,
      actualDate: parsed.data.actual ? new Date(parsed.data.actual) : null,
      updatedById: session.userId
    }
  });

  await audit({
    userId: session.userId!, action: before ? 'UPDATE' : 'CREATE',
    entityType: 'DeliveryMilestone', entityId: saved.id, before, after: saved
  });

  // Auto-promote to Live when stage 7 actual is set
  if (parsed.data.stage === 7 && saved.actualDate && dash.status !== 'Live') {
    await prisma.dashboard.update({
      where: { id: dash.id },
      data: { status: 'Live', updatedBy: session.userId }
    });
    await audit({
      userId: session.userId!, action: 'UPDATE', entityType: 'Dashboard', entityId: dash.id,
      before: { status: dash.status }, after: { status: 'Live' }
    });
  }

  return NextResponse.json(saved);
}
