'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LookupEditor({ listName, values }: { listName: string; values: any[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newEn, setNewEn] = useState('');
  const [newAr, setNewAr] = useState('');

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch('/api/lookups', {
      method: 'POST',
      body: JSON.stringify({ listName, valueEn: newEn, valueAr: newAr || null }),
      headers: { 'content-type': 'application/json' }
    });
    setBusy(false); setNewEn(''); setNewAr('');
    router.refresh();
  }

  async function archive(id: number, archived: boolean) {
    await fetch(`/api/lookups/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ archived }),
      headers: { 'content-type': 'application/json' }
    });
    router.refresh();
  }

  return (
    <div>
      <table className="table">
        <thead><tr><th>EN</th><th>AR</th><th>Order</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {values.map(v => (
            <tr key={v.id} className={v.archived ? 'opacity-60' : ''}>
              <td>{v.valueEn}</td>
              <td className="font-arabic">{v.valueAr ?? '—'}</td>
              <td className="font-mono text-xs">{v.sortOrder}</td>
              <td>{v.archived ? 'Archived' : 'Active'}</td>
              <td>
                <button onClick={() => archive(v.id, !v.archived)} className="text-navy text-sm hover:underline">
                  {v.archived ? 'Restore' : 'Archive'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={add} className="flex gap-2 items-end mt-3 pt-3 border-t border-slate-200">
        <div>
          <label className="label">English</label>
          <input className="input w-48" value={newEn} onChange={e => setNewEn(e.target.value)} required />
        </div>
        <div>
          <label className="label">Arabic</label>
          <input className="input w-48 font-arabic" value={newAr} onChange={e => setNewAr(e.target.value)} />
        </div>
        <button disabled={busy || !newEn} className="btn-primary text-sm">Add</button>
      </form>
    </div>
  );
}
