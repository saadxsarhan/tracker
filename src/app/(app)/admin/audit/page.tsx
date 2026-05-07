import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function AuditPage({ searchParams }: { searchParams: { entity?: string; userId?: string } }) {
  const session = await getSession();
  if (session.role !== 'ADMIN') redirect('/overview');

  const where: any = {};
  if (searchParams.entity) where.entityType = searchParams.entity;
  if (searchParams.userId) where.userId = searchParams.userId;

  const logs = await prisma.auditLog.findMany({
    where, orderBy: { timestamp: 'desc' }, take: 200,
    include: { user: true }
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Audit Log</h1>
      <p className="text-sm text-slate-500">Last 200 entries. Immutable. 7-year retention per BRD §5.6.</p>
      <div className="card p-0 overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th><th>Diff</th></tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td className="text-xs whitespace-nowrap">{new Date(l.timestamp).toISOString().slice(0, 19).replace('T', ' ')}</td>
                <td>{l.user?.name ?? '—'}</td>
                <td><span className={`rag-pill ${l.action === 'CREATE' ? 'rag-green' : l.action === 'DELETE' ? 'rag-red' : 'rag-amber'}`}>{l.action}</span></td>
                <td className="font-mono text-xs">{l.entityType}</td>
                <td className="font-mono text-xs">{l.entityId}</td>
                <td className="text-xs"><pre className="max-w-md overflow-hidden text-xs whitespace-pre-wrap">{l.fieldDiff?.slice(0, 200) ?? ''}</pre></td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-500">No entries.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
