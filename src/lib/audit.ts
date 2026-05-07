import { prisma } from './db';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export async function audit(args: {
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | number;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}) {
  const diff = args.action === 'UPDATE'
    ? computeDiff(args.before, args.after)
    : args.action === 'CREATE' ? { created: args.after } : { deleted: args.before };
  await prisma.auditLog.create({
    data: {
      userId: args.userId ?? null,
      action: args.action,
      entityType: args.entityType,
      entityId: String(args.entityId),
      fieldDiff: JSON.stringify(diff),
      ip: args.ip ?? null
    }
  });
}

function computeDiff(before: unknown, after: unknown): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const a = (before ?? {}) as Record<string, unknown>;
  const b = (after ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (k === 'updatedAt' || k === 'createdAt') continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      out[k] = { from: a[k], to: b[k] };
    }
  }
  return out;
}
