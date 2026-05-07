import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function POST(_req: Request, { params }: { params: { period: string; action: string } }) {
  const session = await getSession();
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!/^\d{4}-\d{2}$/.test(params.period)) return NextResponse.json({ error: 'Bad period' }, { status: 400 });

  if (params.action === 'lock') {
    await prisma.periodLock.upsert({
      where: { period: params.period },
      update: { lockedAt: new Date(), lockedById: session.userId },
      create: { period: params.period, lockedById: session.userId }
    });
    await audit({ userId: session.userId!, action: 'CREATE', entityType: 'PeriodLock', entityId: params.period, after: { period: params.period } });
  } else if (params.action === 'unlock') {
    await prisma.periodLock.deleteMany({ where: { period: params.period } });
    await audit({ userId: session.userId!, action: 'DELETE', entityType: 'PeriodLock', entityId: params.period });
  } else {
    return NextResponse.json({ error: 'Bad action' }, { status: 400 });
  }
  // Redirect back so the form-submit returns user to where they were
  return NextResponse.redirect(new URL(`/ops?period=${params.period}`, _req.url), { status: 303 });
}
