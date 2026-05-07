import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function UsersPage() {
  const session = await getSession();
  if (session.role !== 'ADMIN') redirect('/overview');
  const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Users</h1>
      <div className="card p-0 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td>{u.email}</td>
                <td className="font-mono text-xs">{u.role}</td>
                <td>{u.status}</td>
                <td className="text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().slice(0, 16).replace('T', ' ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Phase 2: invite/disable/SSO mapping. Phase 1 ships seeded demo accounts.</p>
    </div>
  );
}
