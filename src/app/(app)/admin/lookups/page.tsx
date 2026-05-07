import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { LookupEditor } from './LookupEditor';

export default async function LookupsPage() {
  const session = await getSession();
  if (session.role !== 'ADMIN') redirect('/overview');
  const all = await prisma.lookupValue.findMany({ orderBy: [{ listName: 'asc' }, { sortOrder: 'asc' }] });
  const grouped: Record<string, typeof all> = {};
  for (const v of all) {
    grouped[v.listName] = grouped[v.listName] || [];
    grouped[v.listName].push(v);
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">Lookups</h1>
        <p className="text-sm text-slate-500">Reference data — single source for all dropdowns.</p>
      </div>
      {Object.entries(grouped).map(([list, values]) => (
        <div key={list} className="card">
          <h2 className="font-semibold text-navy mb-3">{list}</h2>
          <LookupEditor listName={list} values={values} />
        </div>
      ))}
    </div>
  );
}
