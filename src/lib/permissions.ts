// Pure permission helpers — safe to import from client components.
// (auth.ts imports next/headers and is server-only.)

export type Role = 'ADMIN' | 'DATA_ENGINEER' | 'BI_DEVELOPER' | 'STAKEHOLDER' | 'EXECUTIVE';

export function canEditDashboard(role: Role, ownerIds: { de?: string | null; bi?: string | null }, userId: string) {
  if (role === 'ADMIN') return true;
  if (role === 'DATA_ENGINEER' && ownerIds.de === userId) return true;
  if (role === 'BI_DEVELOPER' && ownerIds.bi === userId) return true;
  return false;
}

export function canEditOpsActual(role: Role, ownerIds: { de?: string | null; bi?: string | null }, userId: string) {
  return canEditDashboard(role, ownerIds, userId);
}

export function canEditMilestone(role: Role, stage: number, ownerIds: { de?: string | null; bi?: string | null }, userId: string) {
  if (role === 'ADMIN') return true;
  if (role === 'DATA_ENGINEER' && ownerIds.de === userId && [1, 3, 4, 6, 7].includes(stage)) return true;
  if (role === 'BI_DEVELOPER' && ownerIds.bi === userId && [1, 2, 5, 6, 7].includes(stage)) return true;
  return false;
}

export function canManageReferenceData(role: Role) { return role === 'ADMIN'; }
export function canViewAuditLog(role: Role) { return role === 'ADMIN'; }
export function visibleToStakeholder(role: Role): boolean { return role === 'STAKEHOLDER' || role === 'EXECUTIVE'; }
