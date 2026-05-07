import type { Metadata } from 'next';
import './globals.css';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Remat D&A KPI Tracker',
  description: 'Operations SLA + Delivery KPI tracking for Remat Al-Riyadh Data & Analytics'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const locale = session.locale ?? 'en';
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
