'use client';
import { useState } from 'react';
import { canEditMilestone, type Role } from '@/lib/permissions';
import { STAGES } from '@/lib/kpi-config';

interface MilestoneCell { stage: number; planned: string | null; actual: string | null; }
interface Row {
  dashboardId: number; name: string; domain: string; status: string;
  deOwnerId: string | null; biOwnerId: string | null;
  milestones: MilestoneCell[]; pct: number; derivedStatus: string;
}

export function DeliveryGrid({ rows: initialRows, stages, userId, role }: {
  rows: Row[]; stages: typeof STAGES; userId: string; role: Role;
}) {
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  function pctClass(pct: number) {
    if (pct === 1) return 'rag-green';
    if (pct >= 0.5) return 'rag-amber';
    return 'rag-red';
  }
  function lateClass(planned: string | null, actual: string | null) {
    if (!planned || !actual) return '';
    return new Date(actual).getTime() > new Date(planned).getTime() ? 'bg-red-50' : '';
  }

  async function update(dashboardId: number, stage: number, field: 'planned' | 'actual', value: string) {
    const k = `${dashboardId}-${stage}-${field}`;
    setSavingKey(k); setError(null);
    const r = await fetch('/api/milestones', {
      method: 'POST',
      body: JSON.stringify({ dashboardId, stage, [field]: value || null }),
      headers: { 'content-type': 'application/json' }
    });
    setSavingKey(null);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b.error ?? 'Save failed');
      return;
    }
    // Update local state and recompute pct/status
    setRows(prev => prev.map(row => {
      if (row.dashboardId !== dashboardId) return row;
      const newMs = row.milestones.map(m => m.stage === stage ? { ...m, [field]: value || null } : m);
      const filled = newMs.filter(m => m.actual).length;
      const pct = filled / 7;
      let derivedStatus = 'Not Started';
      for (let i = 7; i >= 1; i--) {
        const m = newMs.find(x => x.stage === i);
        if (m?.actual) {
          derivedStatus = i === 7 ? 'In Production' : i === 6 ? 'UAT Complete'
            : i === 5 ? 'Visual Complete' : i === 4 ? 'Pipeline Complete'
            : i === 3 ? 'Data Model Complete' : i === 2 ? 'Design Approved' : 'BRD Complete';
          break;
        }
      }
      return { ...row, milestones: newMs, pct, derivedStatus };
    }));
  }

  return (
    <div>
      {error && <div className="card text-red-600 text-sm mb-3">⚠ {error}</div>}
      <div className="overflow-x-auto card p-0">
        <table className="table">
          <thead>
            <tr>
              <th rowSpan={2}>ID</th>
              <th rowSpan={2}>Dashboard</th>
              <th rowSpan={2}>Domain</th>
              {stages.map(s => <th key={s.id} colSpan={2} className="text-center">{`S${s.id}: ${s.name}`}</th>)}
              <th rowSpan={2}>Status</th>
              <th rowSpan={2}>% Complete</th>
            </tr>
            <tr>
              {stages.map(s => (
                <>
                  <th key={s.id + '-p'} className="text-xs">Planned</th>
                  <th key={s.id + '-a'} className="text-xs">Actual</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.dashboardId}>
                <td className="font-mono text-xs">{r.dashboardId}</td>
                <td className="font-medium whitespace-nowrap">{r.name}</td>
                <td>{r.domain}</td>
                {stages.map(s => {
                  const m = r.milestones.find(x => x.stage === s.id) ?? { stage: s.id, planned: null, actual: null };
                  const editable = canEditMilestone(role, s.id, { de: r.deOwnerId, bi: r.biOwnerId }, userId);
                  return (
                    <>
                      <td key={`${s.id}-p`} className="bg-yellow-50">
                        <input type="date" defaultValue={m.planned ?? ''} disabled={!editable}
                          className="px-1 py-0.5 text-xs border border-slate-300 rounded disabled:bg-slate-50"
                          onBlur={(e) => { if ((e.target.defaultValue ?? '') !== e.target.value) update(r.dashboardId, s.id, 'planned', e.target.value); }} />
                      </td>
                      <td key={`${s.id}-a`} className={lateClass(m.planned, m.actual) || 'bg-yellow-50'}>
                        <input type="date" defaultValue={m.actual ?? ''} disabled={!editable}
                          className="px-1 py-0.5 text-xs border border-slate-300 rounded disabled:bg-slate-50"
                          onBlur={(e) => { if ((e.target.defaultValue ?? '') !== e.target.value) update(r.dashboardId, s.id, 'actual', e.target.value); }} />
                      </td>
                    </>
                  );
                })}
                <td className="whitespace-nowrap text-xs">{r.derivedStatus}</td>
                <td><span className={`rag-pill ${pctClass(r.pct)}`}>{(r.pct * 100).toFixed(0)}%</span></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4 + stages.length * 2} className="text-center py-8 text-slate-500">No dashboards in delivery.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-500 mt-2">
        Yellow cells: input dates. Red highlight: actual date later than planned.
      </div>
    </div>
  );
}
