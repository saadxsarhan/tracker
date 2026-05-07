import Link from 'next/link';
import { fetchScorecard, currentPeriod } from '@/lib/scorecard-server';
import { RagPill } from '@/components/RagPill';
import type { ScorecardSection, FullScorecard } from '@/lib/calc';
import { PeriodPicker } from '@/components/PeriodPicker';

function fmtActual(v: number | null, unit: string): string {
  if (v === null) return '—';
  if (unit === '%') return (v * 100).toFixed(1) + '%';
  if (unit === 'Score 1-5') return v.toFixed(2);
  if (unit === 'Days' || unit === 'Hours' || unit === 'Seconds') return v.toFixed(1);
  if (unit === 'Count') return Math.round(v).toString();
  return v.toString();
}
function fmtTarget(v: number, unit: string): string {
  if (unit === '%') return (v * 100).toFixed(1) + '%';
  if (unit === 'Score 1-5') return v.toFixed(2);
  return String(v);
}
function fmtScore(s: number | null): string {
  if (s === null) return '—';
  return (s * 100).toFixed(1) + '%';
}

export default async function ScorecardPage({ searchParams }: { searchParams: { period?: string } }) {
  const period = searchParams.period ?? currentPeriod();
  const { scorecard } = await fetchScorecard(period);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Monthly KPI Scorecard</h1>
          <p className="text-sm text-slate-500">Auto-aggregated from Ops SLA Tracker and Delivery Tracker.</p>
        </div>
        <div className="flex gap-2 items-center">
          <PeriodPicker value={period} basePath="/scorecard" />
          <Link href={`/api/exports/scorecard.csv?period=${period}`} className="btn-secondary text-sm">Export CSV</Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <RoleCard title="Yasir — Overall" score={scorecard.overall.yasir.score} rag={scorecard.overall.yasir.rag} formula="0.6 × Ops + 0.3 × Delivery + 0.1 × Joint" />
        <RoleCard title="Ahmad — Overall" score={scorecard.overall.ahmad.score} rag={scorecard.overall.ahmad.rag} formula="0.6 × Ops + 0.3 × Delivery + 0.1 × Joint" />
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-navy mb-4">Pillar 1 — Operations</h2>
        <SectionTable section={scorecard.ops.yasir} />
        <SectionTable section={scorecard.ops.ahmad} />
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-navy mb-4">Pillar 2 — Delivery</h2>
        <SectionTable section={scorecard.delivery.joint} />
        <SectionTable section={scorecard.delivery.yasir} />
        <SectionTable section={scorecard.delivery.ahmad} />
      </div>
    </div>
  );
}

function RoleCard({ title, score, rag, formula }: { title: string; score: number | null; rag: 'Green' | 'Amber' | 'Red' | null; formula: string }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{title}</div>
          <div className="text-4xl font-bold text-navy mt-1">{fmtScore(score)}</div>
        </div>
        <RagPill rag={rag} />
      </div>
      <div className="text-xs text-slate-400 mt-3">{formula}</div>
    </div>
  );
}

function SectionTable({ section }: { section: ScorecardSection }) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="font-semibold text-navy mb-2">{section.title}</h3>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>KPI</th>
              <th>Owner</th>
              <th>Dir</th>
              <th>Target</th>
              <th>Weight</th>
              <th>Actual</th>
              <th>Score</th>
              <th>RAG</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map(r => (
              <tr key={r.kpi.key}>
                <td className="font-mono text-xs">{r.kpi.sortOrder}</td>
                <td className="font-medium">{r.kpi.name}</td>
                <td>{r.kpi.owner}</td>
                <td>{r.kpi.direction}</td>
                <td>{fmtTarget(r.target, r.kpi.unit)}</td>
                <td>{(r.weight * 100).toFixed(0)}%</td>
                <td className="font-mono">{fmtActual(r.actual, r.kpi.unit)}</td>
                <td className="font-mono font-semibold">{fmtScore(r.scoreVal)}</td>
                <td><RagPill rag={r.rag} /></td>
              </tr>
            ))}
            <tr className="bg-navy-50 font-semibold">
              <td colSpan={5}></td>
              <td className="text-right">Weighted</td>
              <td></td>
              <td className="font-mono">{fmtScore(section.weightedScore)}</td>
              <td><RagPill rag={section.rag} /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
