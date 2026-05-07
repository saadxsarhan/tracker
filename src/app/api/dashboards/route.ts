import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

const CreateSchema = z.object({
  name: z.string().min(1),
  domain: z.string(),
  status: z.string(),
  tier: z.string(),
  deOwnerId: z.string().optional().nullable(),
  biOwnerId: z.string().optional().nullable(),
  sourceSystem: z.string().optional(),
  refreshFrequency: z.string().optional(),
  refreshWindow: z.string().optional(),
  dataSensitivity: z.string().optional()
});

export async function POST(req: Request) {
  const session = await getSession();
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 });
  const data: any = { ...parsed.data };
  if (data.deOwnerId === '') data.deOwnerId = null;
  if (data.biOwnerId === '') data.biOwnerId = null;
  data.createdBy = session.userId;
  data.updatedBy = session.userId;
  const dash = await prisma.dashboard.create({ data });
  await audit({ userId: session.userId!, action: 'CREATE', entityType: 'Dashboard', entityId: dash.id, after: dash });
  return NextResponse.json(dash);
}
