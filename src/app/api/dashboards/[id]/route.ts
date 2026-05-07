import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession, canEditDashboard, type Role } from '@/lib/auth';
import { audit } from '@/lib/audit';

const UpdateSchema = z.object({
  name: z.string().optional(),
  domain: z.string().optional(),
  status: z.string().optional(),
  tier: z.string().optional(),
  deOwnerId: z.string().nullable().optional(),
  biOwnerId: z.string().nullable().optional(),
  sourceSystem: z.string().nullable().optional(),
  refreshFrequency: z.string().nullable().optional(),
  refreshWindow: z.string().nullable().optional(),
  businessSponsor: z.string().nullable().optional(),
  dataOwner: z.string().nullable().optional(),
  changeApprover: z.string().nullable().optional(),
  escalationContact: z.string().nullable().optional(),
  stakeholderGroup: z.string().nullable().optional(),
  accessRule: z.string().nullable().optional(),
  changeControlRule: z.string().nullable().optional(),
  dataSensitivity: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
}).strict();

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const id = parseInt(params.id, 10);
  const dash = await prisma.dashboard.findUnique({ where: { id } });
  if (!dash) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const role = session.role as Role;
  if (!canEditDashboard(role, { de: dash.deOwnerId, bi: dash.biOwnerId }, session.userId!)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 });

  // Non-admin: limit to source/frequency/window only
  let updateData: any = parsed.data;
  if (role !== 'ADMIN') {
    const allowed = ['sourceSystem', 'refreshFrequency', 'refreshWindow'];
    updateData = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => allowed.includes(k)));
  }

  // Empty strings → null for FK fields
  for (const k of ['deOwnerId', 'biOwnerId']) {
    if (updateData[k] === '') updateData[k] = null;
  }
  updateData.updatedBy = session.userId;

  const updated = await prisma.dashboard.update({ where: { id }, data: updateData });
  await audit({ userId: session.userId!, action: 'UPDATE', entityType: 'Dashboard', entityId: id, before: dash, after: updated });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = parseInt(params.id, 10);
  const dash = await prisma.dashboard.findUnique({ where: { id } });
  if (!dash) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Soft-delete
  const updated = await prisma.dashboard.update({ where: { id }, data: { archivedAt: new Date(), updatedBy: session.userId } });
  await audit({ userId: session.userId!, action: 'DELETE', entityType: 'Dashboard', entityId: id, before: dash, after: updated });
  return NextResponse.json({ ok: true });
}
