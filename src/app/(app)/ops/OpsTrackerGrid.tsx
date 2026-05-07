'use client';
import { useState } from 'react';
import type { Role } from '@/lib/permissions';
import type { OpsKPIDef } from '@/lib/kpi-config';
import { rowRag } from '@/lib/calc';
import { RagPill } from '@/components/RagPill';

interface Row {
  dashboardId: number;
  name: string;
  status: string;
  tier: string;
  deOwnerId: string | null;
  biOwnerId: string | null;
  targets: Record<string, number | null>;
  actuals: Record<string, number | null>;
}

export function OpsTrackerGrid({
  rows: initialRows, kpis, period, locked, userId, role
}: {
  rows: Row[]; kpis: OpsKPIDef[]; period: string; locked: boolean; userId: string; role: Role;
}) {
  const [rows, setRows] = useState(initialRows);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function canEditRow(r: Row) {
    if (locked) return role === 'ADMIN';
    if (role === 'ADMIN') return true;
    if (role === 'DATA_ENGINEER') return r.deOwnerId === userId;
    if (role === 'BI_DEVELOPER') return r.biOwnerId === userId;
    return false;
  }

  function fmtTarget(v: number | null, unit: string) {
    if (v === null) return '—';
    if (unit === '%') return (v * 100).toFixed(1) + '%';
    return v.toString();
  }

  async function persist(dashboardId: number, kpiKey: string, raw: string) {
    if (raw.trim() === '') return; // skip empty
    const v = Number(raw);
    if (!Number.isFinite(v)) { setError('Not a number'); return; }
    setSaving(`${dashboardId}-${kpiKey}`);
    setError(null);
    const r = await fetch('/api/ops-actuals', {
      method: 'POST',
      body: JSON.stringify({ dashboardId, period, kpiKey, actualValue: v }),
      headers: { 'content-type': 'application/json' }
    });
    setSaving(null);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b.error ?? 'Save failed');
    }
  }

  function updateLocal(dashboardId: number, kpiKey: string, raw: string) {
    setRows(rows.map(r => r.dashboardId === dashboardId
      ? { ...r, actuals: { ...r.actuals, [kpiKey]: raw === '' ? null : Number(raw) } }
      : r));
  }

  return (
    <div>
      {error && <div className="card text-sm text-red-600 mb-3">⚠ {error}</div>}
      <div className="overflow-x-auto card p-0">
        <table className="table">
          <thead>
            <tr>
              <th rowSpan={2}>ID</th>
              <th rowSpan={2}>Dashboard</th>
              <th rowSpan={2}>Status</th>
              <th rowSpan={2}>Tier</th>
              {kpis.map(k => <th key={k.key} colSpan={3} className="text-center">{k.name}</th>)}
            </tr>
            <tr>
              {kpis.map(k => (
                <>
                  <th key={k.key + '-t'} className="text-xs">Target</th>
                  <th key={k.key + '-a'} className="text-xs">Actual</th>
                  <th key={k.key + '-r'} className="text-xs">RAG</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const editable = canEditRow(r);
              return (
                <tr key={r.dashboardId}>
                  <td className="font-mono text-xs">{r.dashboardId}</td>
                  <td className="font-medium whitespace-nowrap">{r.name}</td>
                  <td>{r.status}</td>
                  <td>{r.tier}</td>
                  {kpis.map(k => {
                    const target = r.targets[k.key];
                    const actual = r.actuals[k.key];
                    const rag = rowRag(actual ?? null, target, k.direction);
                    const isLive = r.status === 'Live';
                    const missing = isLive && actual === null;
                    return (
                      <>
                        <td key={k.key + '-t'} className="text-xs whitespace-nowrap">{fmtTarget(target, k.unit)}</td>
                        <td key={k.key + '-a'} className={missing ? 'bg-red-50' : ''}>
                          {isLive ? (
                            <input
                              type="number"
                              step="any"
                              defaultValue={actual ?? ''}
                              disabled={!editable}
                              onBlur={async (e) => {
                                if (e.currentTarget.value === '') return;
                                updateLocal(r.dashboardId, k.key, e.currentTarget.value);
                                await persist(r.dashboardId, k.key, e.currentTarget.value);
                              }}
                              className="w-24 px-2 py-1 border border-slate-300 rounded text-sm font-mono disabled:bg-slate-50 disabled:text-slate-500"
                            />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                          {saving === `${r.dashboardId}-${k.key}` && <span className="text-xs text-slate-400 ml-1">…</span>}
                        </td>
                        <td key={k.key + '-r'}><RagPill rag={rag} /></td>
                      </>
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={4 + kpis.length * 3} className="text-center py-8 text-slate-500">No dashboards match filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-500 mt-2">
        Tip: Targets show only for Live dashboards (per Excel rule). Empty cells on Live dashboards highlighted in red.
        {locked && <span className="ml-2 text-rag-red font-semibold">Period is locked — editing disabled for non-admins.</span>}
      </div>
    </div>
  );
}
