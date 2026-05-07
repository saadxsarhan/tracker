'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Tier {
  id: number; kpiKey: string; kpiName: string;
  p1Target: number; p2Target: number; p3Target: number;
  direction: string; unit: string; notes: string | null;
}

export function TierEditor({ tiers: initial }: { tiers: Tier[] }) {
  const router = useRouter();
  const [tiers, setTiers] = useState(initial);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(t: Tier, field: 'p1Target' | 'p2Target' | 'p3Target', value: string) {
    const v = Number(value);
    if (!Number.isFinite(v)) { setError('Not a number'); return; }
    if (!confirm(`Change ${t.kpiName} ${field.slice(0, 2).toUpperCase()} target from ${t[field]} to ${v}?\nThis affects all Live dashboards in that tier.`)) return;
    setSavingId(t.id); setError(null);
    const r = await fetch(`/api/sla-tiers/${t.id}`, {
      method: 'PUT',
      body: JSON.stringify({ [field]: v }),
      headers: { 'content-type': 'application/json' }
    });
    setSavingId(null);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b.error ?? 'Save failed');
      return;
    }
    setTiers(tiers.map(x => x.id === t.id ? { ...x, [field]: v } : x));
    router.refresh();
  }

  return (
    <table className="table">
      <thead>
        <tr><th>KPI</th><th>Direction</th><th>Unit</th><th>P1</th><th>P2</th><th>P3</th><th>Notes</th></tr>
      </thead>
      <tbody>
        {tiers.map(t => (
          <tr key={t.id}>
            <td className="font-medium">{t.kpiName}</td>
            <td>{t.direction}</td>
            <td>{t.unit}</td>
            <td><EditNum value={t.p1Target} onCommit={v => save(t, 'p1Target', v)} /></td>
            <td><EditNum value={t.p2Target} onCommit={v => save(t, 'p2Target', v)} /></td>
            <td><EditNum value={t.p3Target} onCommit={v => save(t, 'p3Target', v)} /></td>
            <td className="text-xs text-slate-500">{t.notes}</td>
          </tr>
        ))}
      </tbody>
      {error && (
        <tfoot><tr><td colSpan={7} className="text-red-600 text-sm p-2">⚠ {error}</td></tr></tfoot>
      )}
    </table>
  );
}

function EditNum({ value, onCommit }: { value: number; onCommit: (v: string) => void }) {
  return (
    <input type="number" step="any" defaultValue={value}
      className="w-24 px-2 py-1 border border-slate-300 rounded text-sm font-mono"
      onBlur={e => { if (Number(e.target.value) !== value) onCommit(e.target.value); }} />
  );
}
