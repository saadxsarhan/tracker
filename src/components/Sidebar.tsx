import Link from 'next/link';
import type { Role } from '@/lib/permissions';
import { t } from '@/lib/i18n';

export function Sidebar({
  role,
  locale,
  currentPath
}: {
  role: Role;
  locale: 'en' | 'ar';
  currentPath: string;
}) {
  const items: Array<{ href: string; label: string; show: boolean }> = [
    { href: '/overview',   label: t('nav.overview', locale),         show: true },
    { href: '/scorecard',  label: t('nav.scorecard', locale),        show: true },
    { href: '/portfolio',  label: t('nav.portfolio', locale),        show: true },
    { href: '/ops',        label: t('nav.opsTracker', locale),       show: role !== 'EXECUTIVE' },
    { href: '/delivery',   label: t('nav.deliveryTracker', locale),  show: role !== 'EXECUTIVE' },
    { href: '/reports',    label: t('nav.reports', locale),          show: true }
  ];
  const adminItems = role === 'ADMIN' ? [
    { href: '/admin/tiers',   label: t('nav.tiers', locale) },
    { href: '/admin/lookups', label: t('nav.lookups', locale) },
    { href: '/admin/users',   label: t('nav.users', locale) },
    { href: '/admin/audit',   label: t('nav.audit', locale) }
  ] : [];

  return (
    <aside className="w-64 bg-navy text-white flex-shrink-0 hidden md:flex flex-col">
      <div className="px-6 py-5 border-b border-navy-700">
        <div className="font-bold text-lg leading-tight">{t('app.name', locale)}</div>
        <div className="text-xs text-gold mt-1">Remat Al-Riyadh</div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {items.filter(i => i.show).map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2 rounded-md text-sm transition ${
              currentPath.startsWith(item.href) ? 'bg-gold text-white font-semibold' : 'hover:bg-navy-700'
            }`}
          >
            {item.label}
          </Link>
        ))}
        {adminItems.length > 0 && (
          <>
            <div className="text-xs text-slate-400 uppercase font-semibold pt-4 pb-1 px-3">{t('nav.admin', locale)}</div>
            {adminItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-sm transition ${
                  currentPath.startsWith(item.href) ? 'bg-gold text-white font-semibold' : 'hover:bg-navy-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>
      <div className="p-3 text-xs text-slate-400 border-t border-navy-700">
        <div>v1.0.0 · {role}</div>
      </div>
    </aside>
  );
}
