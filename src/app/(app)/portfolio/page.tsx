import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export default async function PortfolioPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getSession();
  const filter: any = { archivedAt: null };
  if (searchParams.status) filter.status = searchParams.status;
  if (searchParams.tier) filter.tier = searchParams.tier;
  if (searchParams.domain) filter.domain = searchParams.domain;
  if (searchParams.q) filter.name = { contains: searchParams.q };

  const dashboards = await prisma.dashboard.findMany({
    where: filter,
    orderBy: { id: 'asc' },
    include: { deOwner: true, biOwner: true }
  });

  const domains = Array.from(new Set(dashboards.map(d => d.domain))).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dashboard Portfolio</h1>
          <p className="text-sm text-slate-500">Master register of all dashboards. Tier here drives SLA targets.</p>
        </div>
        <div className="flex gap-2">
          {session.role === 'ADMIN' && (
            <Link href="/portfolio/new" className="btn-primary text-sm">+ New dashboard</Link>
          )}
          <Link href="/api/exports/portfolio.csv" className="btn-secondary text-sm">Export CSV</Link>
        </div>
      </div>

      <form className="card flex gap-3 flex-wrap items-end" method="get">
        <div>
          <label className="label">Search</label>
          <input className="input w-64" name="q" defaultValue={searchParams.q ?? ''} placeholder="Name…" />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input w-40" name="status" defaultValue={searchParams.status ?? ''}>
            <option value="">All</option>
            {['Live', 'In Build', 'In Scoping', 'Not Started', 'Retired'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tier</label>
          <select className="input w-32" name="tier" defaultValue={searchParams.tier ?? ''}>
            <option value="">All</option>
            <option>P1</option><option>P2</option><option>P3</option>
          </select>
        </div>
        <div>
          <label className="label">Domain</label>
          <select className="input w-44" name="domain" defaultValue={searchParams.domain ?? ''}>
            <option value="">All</option>
            {domains.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary">Filter</button>
        <Link href="/portfolio" className="btn-ghost text-sm">Reset</Link>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th><th>Name</th><th>Domain</th><th>Status</th><th>Tier</th>
              <th>DE Owner</th><th>BI Owner</th><th>Source</th><th>Sensitivity</th><th></th>
            </tr>
          </thead>
          <tbody>
            {dashboards.map(d => (
              <tr key={d.id}>
                <td className="font-mono text-xs">{d.id}</td>
                <td className="font-medium">{d.name}</td>
                <td>{d.domain}</td>
                <td>{statusBadge(d.status)}</td>
                <td>{tierBadge(d.tier)}</td>
                <td>{d.deOwner?.name ?? '—'}</td>
                <td>{d.biOwner?.name ?? '—'}</td>
                <td className="text-xs">{d.sourceSystem ?? '—'}</td>
                <td className="text-xs">{d.dataSensitivity ?? '—'}</td>
                <td><Link className="text-navy hover:underline text-sm" href={`/portfolio/${d.id}`}>View</Link></td>
              </tr>
            ))}
            {dashboards.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-slate-500">No dashboards match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-sm text-slate-500">{dashboards.length} dashboards</div>
    </div>
  );
}

function statusBadge(status: string) {
  const cls = status === 'Live' ? 'rag-green' : status === 'Retired' ? 'rag-red' : 'rag-amber';
  return <span className={`rag-pill ${cls}`}>{status}</span>;
}
function tierBadge(tier: string) {
  const cls = tier === 'P1' ? 'rag-red' : tier === 'P2' ? 'rag-amber' : 'rag-green';
  return <span className={`rag-pill ${cls}`}>{tier}</span>;
}
