import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

const CreateSchema = z.object({
  listName: z.string().min(1),
  valueEn: z.string().min(1),
  valueAr: z.string().nullable().optional()
});

export async function POST(req: Request) {
  const session = await getSession();
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  const max = await prisma.lookupValue.aggregate({
    where: { listName: parsed.data.listName },
    _max: { sortOrder: true }
  });
  const created = await prisma.lookupValue.create({
    data: { ...parsed.data, sortOrder: (max._max.sortOrder ?? -1) + 1 }
  });
  await audit({ userId: session.userId!, action: 'CREATE', entityType: 'LookupValue', entityId: created.id, after: created });
  return NextResponse.json(created);
}
