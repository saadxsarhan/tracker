import 'server-only';
import { cookies } from 'next/headers';
import { getIronSession, type SessionOptions } from 'iron-session';
import bcrypt from 'bcryptjs';
import { prisma } from './db';
export type { Role } from './permissions';
import type { Role } from './permissions';
export {
  canEditDashboard, canEditOpsActual, canEditMilestone,
  canManageReferenceData, canViewAuditLog, visibleToStakeholder
} from './permissions';

export interface SessionData {
  userId?: string;
  email?: string;
  name?: string;
  role?: Role;
  locale?: 'en' | 'ar';
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'dev-only-change-me-to-32-bytes-of-randomness-please',
  cookieName: 'remat_kpi_session',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
};

export async function getSession() {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}

export async function requireUser() {
  const s = await getSession();
  if (!s.userId) throw new Error('UNAUTHENTICATED');
  return s;
}

export async function requireRole(roles: Role[]) {
  const s = await requireUser();
  if (!s.role || !roles.includes(s.role)) throw new Error('FORBIDDEN');
  return s;
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'active') return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

