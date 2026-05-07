'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Role } from '@/lib/permissions';
import { t } from '@/lib/i18n';

export function TopBar({
  role,
  userName,
  userEmail,
  locale
}: {
  role: Role;
  userName: string;
  userEmail: string;
  locale: 'en' | 'ar';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleLocale() {
    setBusy(true);
    await fetch('/api/session/locale', {
      method: 'POST',
      body: JSON.stringify({ locale: locale === 'en' ? 'ar' : 'en' }),
      headers: { 'content-type': 'application/json' }
    });
    router.refresh();
    setBusy(false);
  }
  async function logout() {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <header className="bg-white border-b border-slate-200 h-14 flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="font-semibold text-navy">D&A KPI Tracker</div>
      <div className="flex items-center gap-3">
        <button onClick={toggleLocale} disabled={busy} className="btn-ghost text-sm">
          {locale === 'en' ? 'العربية' : 'English'}
        </button>
        <div className="text-sm text-slate-600 hidden sm:block">
          <span className="font-medium">{userName}</span>
          <span className="text-slate-400 mx-2">·</span>
          <span className="text-xs">{userEmail}</span>
        </div>
        <button onClick={logout} disabled={busy} className="btn-secondary text-sm">
          {t('auth.signOut', locale)}
        </button>
      </div>
    </header>
  );
}
