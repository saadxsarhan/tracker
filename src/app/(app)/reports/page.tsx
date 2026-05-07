import Link from 'next/link';
import { currentPeriod } from '@/lib/scorecard-server';

export default function ReportsPage() {
  const period = currentPeriod();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Reports & Exports</h1>
      <p className="text-sm text-slate-500">Branded PDF rendering and scheduled email delivery are Phase 2. CSV exports are live.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold text-navy">Monthly Scorecard</h2>
          <p className="text-sm text-slate-500 mt-1">All 21 KPIs, weighted role scores, RAG.</p>
          <Link href={`/api/exports/scorecard.csv?period=${period}`} className="btn-primary mt-3 text-sm inline-block">Download CSV ({period})</Link>
        </div>
        <div className="card">
          <h2 className="font-semibold text-navy">Portfolio Inventory</h2>
          <p className="text-sm text-slate-500 mt-1">All dashboards with full governance fields.</p>
          <Link href="/api/exports/portfolio.csv" className="btn-primary mt-3 text-sm inline-block">Download CSV</Link>
        </div>
        <div className="card">
          <h2 className="font-semibold text-navy">Per-Dashboard SLA History</h2>
          <p className="text-sm text-slate-500 mt-1">Last 12 months of Ops actuals.</p>
          <Link href="/api/exports/sla-history.csv" className="btn-primary mt-3 text-sm inline-block">Download CSV</Link>
        </div>
        <div className="card">
          <h2 className="font-semibold text-navy">Delivery Status</h2>
          <p className="text-sm text-slate-500 mt-1">Current state of in-flight dashboards.</p>
          <Link href="/api/exports/delivery.csv" className="btn-primary mt-3 text-sm inline-block">Download CSV</Link>
        </div>
      </div>
    </div>
  );
}
