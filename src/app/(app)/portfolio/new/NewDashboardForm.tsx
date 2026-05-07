'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NewDashboardForm({ users }: { users: any[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', domain: 'Finance', status: 'Not Started', tier: 'P3',
    deOwnerId: '', biOwnerId: '', sourceSystem: '', refreshFrequency: 'Daily', dataSensitivity: 'Internal'
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await fetch('/api/dashboards', {
      method: 'POST', body: JSON.stringify(form), headers: { 'content-type': 'application/json' }
    });
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b.error ?? 'Save failed');
      setBusy(false);
      return;
    }
    const created = await r.json();
    router.push(`/portfolio/${created.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Name *</label>
        <input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Domain</label>
          <select className="input" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}>
            {['Finance', 'Procurement', 'HCM', 'IT SM', 'Strategy', 'Operations', 'Compliance', 'TBD'].map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            {['Live', 'In Build', 'In Scoping', 'Not Started', 'Retired'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tier</label>
          <select className="input" value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })}>
            <option>P1</option><option>P2</option><option>P3</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">DE Owner</label>
          <select className="input" value={form.deOwnerId} onChange={e => setForm({ ...form, deOwnerId: e.target.value })}>
            <option value="">—</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
        <div>
          <label className="label">BI Owner</label>
          <select className="input" value={form.biOwnerId} onChange={e => setForm({ ...form, biOwnerId: e.target.value })}>
            <option value="">—</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create'}</button>
      </div>
    </form>
  );
}
