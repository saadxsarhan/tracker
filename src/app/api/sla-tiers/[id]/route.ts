import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

const Schema = z.object({
  p1Target: z.number().optional(),
  p2Target: z.number().optional(),
  p3Target: z.number().optional(),
  notes: z.string().optional()
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = parseInt(params.id, 10);
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const before = await prisma.sLATier.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const updated = await prisma.sLATier.update({
    where: { id },
    data: { ...parsed.data, version: { increment: 1 } }
  });
  await audit({ userId: session.userId!, action: 'UPDATE', entityType: 'SLATier', entityId: id, before, after: updated });
  return NextResponse.json(updated);
}
