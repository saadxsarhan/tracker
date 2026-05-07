import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

const Schema = z.object({
  valueEn: z.string().optional(),
  valueAr: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  archived: z.boolean().optional()
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = parseInt(params.id, 10);
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  const before = await prisma.lookupValue.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const updated = await prisma.lookupValue.update({ where: { id }, data: parsed.data });
  await audit({ userId: session.userId!, action: 'UPDATE', entityType: 'LookupValue', entityId: id, before, after: updated });
  return NextResponse.json(updated);
}
