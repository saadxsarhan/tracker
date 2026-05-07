import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TierEditor } from './TierEditor';

export default async function TiersPage() {
  const session = await getSession();
  if (session.role !== 'ADMIN') redirect('/overview');
  const tiers = await prisma.sLATier.findMany({ orderBy: { sortOrder: 'asc' } });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">SLA Tiers</h1>
        <p className="text-sm text-slate-500">Single source of truth for tier-driven SLA targets. Changes affect all Live dashboards.</p>
      </div>
      <div className="card p-0 overflow-x-auto">
        <TierEditor tiers={tiers.map(t => ({ ...t, effectiveFrom: t.effectiveFrom.toISOString(), updatedAt: t.updatedAt.toISOString() }))} />
      </div>
      <div className="card">
        <h2 className="font-semibold text-navy mb-2">Tier definitions</h2>
        <ul className="space-y-2 text-sm">
          <li><span className="rag-pill rag-red mr-2">P1</span> Critical — C-level / regulatory / financial close.</li>
          <li><span className="rag-pill rag-amber mr-2">P2</span> Important — Department heads, weekly operational decisions.</li>
          <li><span className="rag-pill rag-green mr-2">P3</span> Standard — Reference / informational, periodic use.</li>
        </ul>
      </div>
    </div>
  );
}
