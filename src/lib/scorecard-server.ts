// Server-side scorecard composition: pulls actuals + targets from DB and runs the calc engine.

import { prisma } from './db';
import { OPS_KPIS, DELIVERY_KPIS } from './kpi-config';
import {
  buildScorecard, aggregateOpsActuals, tierTarget, deliveryKPIs, type DeliveryRow
} from './calc';

export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function fetchScorecard(period: string) {
  // 1. Targets per tier (from SLA Tiers table)
  const tiers = await prisma.sLATier.findMany();
  const tierMap = new Map(tiers.map(t => [t.kpiKey, t]));

  // 2. All Live dashboards + their actuals for period
  const dashboards = await prisma.dashboard.findMany({
    where: { archivedAt: null }
  });
  const liveDashIds = new Set(dashboards.filter(d => d.status === 'Live').map(d => d.id));

  const actuals = await prisma.opsSLAActual.findMany({ where: { period } });

  // 3. For each Ops KPI: aggregate over Live dashboards (AVG/SUM matching Excel)
  const opsAggregates: Record<string, { actual: number | null; target: number }> = {};
  for (const k of OPS_KPIS) {
    const tier = tierMap.get(k.key);
    // Target: weighted avg of tier targets across Live dashboards is not what Excel does.
    // Excel: each row's target is HLOOKUP(tier).  Aggregated KPI target is typically the P2 (median tier).
    // We use the ACTUAL target as the median tier of Live dashboards weighted by count.
    // But the Scorecard sheet specifically pulls F10 = 'SLA Tiers'!D5 (the P2 target column).
    // So we mirror that: aggregated KPI target = P2 target for the KPI.
    const target = tier?.p2Target ?? 0;
    const rows = dashboards
      .filter(d => liveDashIds.has(d.id))
      .map(d => {
        const a = actuals.find(x => x.dashboardId === d.id && x.kpiKey === k.key);
        return { actual: a?.actualValue ?? null, status: d.status };
      });
    const aggregated = aggregateOpsActuals(rows, k.aggregation);
    opsAggregates[k.key] = { actual: aggregated, target };
  }

  // 4. Delivery: compute from milestones, plus pull manual KPIs.
  const milestones = await prisma.deliveryMilestone.findMany();
  const inflightDashes = dashboards.filter(d => d.status === 'In Build' || d.status === 'In Scoping' || d.status === 'Not Started');
  const deliveryRows: DeliveryRow[] = inflightDashes.map(d => ({
    milestones: [1, 2, 3, 4, 5, 6, 7].map(stage => {
      const m = milestones.find(m => m.dashboardId === d.id && m.stage === stage);
      return {
        stage,
        planned: m?.plannedDate ?? null,
        actual: m?.actualDate ?? null
      };
    })
  }));
  const computedDel = deliveryKPIs(deliveryRows);

  const manualEntries = await prisma.deliveryKPIActual.findMany({ where: { period } });
  const manualMap = new Map(manualEntries.map(e => [e.kpiKey, e.actualValue]));

  const deliveryActuals: Record<string, number | null> = {};
  for (const k of DELIVERY_KPIS) {
    const v: number | null = (() => {
      switch (k.source) {
        case 'PORTFOLIO_PCT_COMPLETE': return computedDel.portfolio_pct_complete;
        case 'ON_TIME_DELIVERY':       return computedDel.on_time_delivery;
        case 'AVG_CYCLE_TIME':         return computedDel.avg_cycle_time;
        case 'BRD_ON_TIME':            return computedDel.brd_on_time;
        case 'DESIGN_FIRST_PASS':      return computedDel.design_first_pass;
        case 'SIGNOFF_CYCLE_DAYS':     return computedDel.signoff_cycle;
        case 'PIPELINE_HIT_RATE':      return computedDel.pipeline_hit_rate;
        case 'VISUAL_HIT_RATE':        return computedDel.visual_hit_rate;
        case 'UAT_FIRST_PASS':         return computedDel.uat_first_pass;
        case 'MANUAL':                 return manualMap.get(k.key) ?? null;
        default: return null;
      }
    })();
    deliveryActuals[k.key] = v;
  }

  return {
    scorecard: buildScorecard({ opsAggregates, deliveryActuals }),
    deliverySummary: computedDel,
    period,
    counts: {
      total: dashboards.length,
      live: liveDashIds.size,
      inflight: inflightDashes.length
    }
  };
}

export async function fetchOpsTrackerRows(period: string) {
  const tiers = await prisma.sLATier.findMany();
  const tierMap = new Map(tiers.map(t => [t.kpiKey, t]));
  const dashboards = await prisma.dashboard.findMany({
    where: { archivedAt: null },
    orderBy: { id: 'asc' },
    include: { deOwner: true, biOwner: true }
  });
  const actuals = await prisma.opsSLAActual.findMany({ where: { period } });

  return dashboards.map(d => {
    const targets: Record<string, number | null> = {};
    const actualsByKpi: Record<string, number | null> = {};
    for (const k of OPS_KPIS) {
      const t = tierMap.get(k.key);
      targets[k.key] = t && d.status === 'Live'
        ? tierTarget(d.tier, t.p1Target, t.p2Target, t.p3Target)
        : null;
      const a = actuals.find(x => x.dashboardId === d.id && x.kpiKey === k.key);
      actualsByKpi[k.key] = a?.actualValue ?? null;
    }
    return { dashboard: d, targets, actuals: actualsByKpi };
  });
}
