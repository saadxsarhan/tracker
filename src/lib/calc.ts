// KPI calculation engine — exact replication of source-tracker.xlsx formulas.
// Every public function is verified by tests in src/lib/calc.test.ts.
//
// Excel cross-references:
//   Score formula:  Scorecard!I10..I44   (MIN(Actual/Target,1.2)  for H direction)
//                                        (MIN(Target/Actual,1.2)  for L direction, requires Actual>0)
//   RAG formula:    Scorecard!J10..J44   (Green ≥1, Amber ≥0.9, Red <0.9)
//   Section roll:   Scorecard!I15,I23,I33,I39,I45 (SUMPRODUCT weight × score / SUMPRODUCT weight)
//   Tier target:    Ops SLA Tracker!F7   HLOOKUP(tier, 'SLA Tiers'!C4:E14, row, FALSE)
//   Per-row Ops RAG:Ops SLA Tracker!H7   thresholds differ by direction (×0.9 for H, ×1.1 for L)
//   Delivery KPIs:  Delivery Tracker!T27..T35 (SUMPRODUCT-based ratios over date arrays)

import type { Direction, RAG, RoleKey, OpsKPIDef, DeliveryKPIDef } from './kpi-config';
import { OPS_KPIS, DELIVERY_KPIS, ROLE_ROLLUP_WEIGHTS, STAGES } from './kpi-config';

// --- Score (Excel: Scorecard!I-column) ----------------------------------
// Returns a 0..1.2 ratio, or null if not computable.
export function score(actual: number | null | undefined, target: number, direction: Direction): number | null {
  if (actual === null || actual === undefined || Number.isNaN(actual)) return null;
  if (direction === 'H') {
    if (target === 0) return null;
    return Math.min(actual / target, 1.2);
  }
  // direction === 'L' — Excel guard: only score when Actual > 0
  if (actual <= 0) {
    // Excel guards `AND(E="L", H>0)`. If actual==0 on a lower-is-better KPI, treat as perfect (cap 1.2).
    return 1.2;
  }
  return Math.min(target / actual, 1.2);
}

// --- RAG (Excel: Scorecard!J-column) ------------------------------------
// Tiny epsilon absorbs IEEE-754 rounding when scores compose via SUMPRODUCT.
const RAG_EPSILON = 1e-9;
export function rag(scoreVal: number | null): RAG | null {
  if (scoreVal === null) return null;
  if (scoreVal >= 1 - RAG_EPSILON) return 'Green';
  if (scoreVal >= 0.9 - RAG_EPSILON) return 'Amber';
  return 'Red';
}

// --- Per-row Ops RAG (Excel: Ops SLA Tracker H/N columns) ---------------
// H direction:  Green if actual >= target;  Amber if actual >= target*0.9;  else Red.
// L direction:  Green if actual <= target;  Amber if actual <= target*1.1;  else Red.
export function rowRag(actual: number | null, target: number | null, direction: Direction): RAG | null {
  if (actual === null || target === null) return null;
  if (direction === 'H') {
    if (actual >= target) return 'Green';
    if (actual >= target * 0.9) return 'Amber';
    return 'Red';
  }
  if (actual <= target) return 'Green';
  if (actual <= target * 1.1) return 'Amber';
  return 'Red';
}

// --- Tier target lookup (Excel: HLOOKUP) --------------------------------
export function tierTarget(tier: string, p1: number, p2: number, p3: number): number | null {
  if (tier === 'P1') return p1;
  if (tier === 'P2') return p2;
  if (tier === 'P3') return p3;
  return null;
}

// --- Weighted section score (Excel: Scorecard!I15,I23,I33,I39,I45) ------
// SUMPRODUCT(IF(score="",0,score), weight) / SUMPRODUCT(IF(score="",0,1), weight)
// Skips KPIs with null score in both numerator and denominator (matches Excel).
export function weightedScore(items: Array<{ score: number | null; weight: number }>): number | null {
  let num = 0, denom = 0;
  for (const { score: s, weight: w } of items) {
    if (s === null) continue;
    num += s * w;
    denom += w;
  }
  if (denom === 0) return null;
  return num / denom;
}

// --- Aggregation across Live dashboards (Excel: AVERAGEIFS / SUMIFS) ----
// rows = list of { actual: number|null, status: string } for the period.
// Filters to status === "Live" and applies AVG or SUM.
export function aggregateOpsActuals(
  rows: Array<{ actual: number | null; status: string }>,
  agg: 'AVG' | 'SUM'
): number | null {
  const live = rows.filter(r => r.status === 'Live' && r.actual !== null && r.actual !== undefined);
  if (live.length === 0) return null;
  const vals = live.map(r => r.actual as number);
  if (agg === 'SUM') return vals.reduce((a, b) => a + b, 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// --- Delivery Tracker computations (Excel: Delivery Tracker!T27..T35) ---
// Row schema: 7 milestones per dashboard (planned & actual dates, possibly null).
export interface DeliveryRow {
  milestones: Array<{ stage: number; planned: Date | null; actual: Date | null }>;
}

function getStage(row: DeliveryRow, stage: number) {
  return row.milestones.find(m => m.stage === stage) ?? { stage, planned: null, actual: null };
}

function bothFilled(row: DeliveryRow, stage: number): boolean {
  const s = getStage(row, stage);
  return s.planned !== null && s.actual !== null;
}

function onTime(row: DeliveryRow, stage: number): boolean | null {
  const s = getStage(row, stage);
  if (s.planned === null || s.actual === null) return null;
  return s.actual.getTime() <= s.planned.getTime();
}

function daysBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

// % Complete = COUNTA(actuals)/7  (Excel: T7:T21)
export function pctComplete(row: DeliveryRow): number {
  const filled = row.milestones.filter(m => m.actual !== null).length;
  return filled / 7;
}

// Status (Excel: S column nested IF)
export function deliveryStatus(row: DeliveryRow): string {
  const has = (s: number) => getStage(row, s).actual !== null;
  if (has(7)) return 'In Production';
  if (has(6)) return 'UAT Complete';
  if (has(5)) return 'Visual Complete';
  if (has(4)) return 'Pipeline Complete';
  if (has(3)) return 'Data Model Complete';
  if (has(2)) return 'Design Approved';
  if (has(1)) return 'BRD Complete';
  return 'Not Started';
}

// Avg of pctComplete across all rows (Excel: T23/T27)
export function portfolioPctComplete(rows: DeliveryRow[]): number | null {
  if (rows.length === 0) return null;
  return rows.reduce((sum, r) => sum + pctComplete(r), 0) / rows.length;
}

// On-time rate at a given stage (Excel: T28/T30/T31/T33/T34/T35 pattern)
function onTimeRateAtStage(rows: DeliveryRow[], stage: number): number | null {
  const considered = rows.filter(r => bothFilled(r, stage));
  if (considered.length === 0) return null;
  const ok = considered.filter(r => onTime(r, stage) === true).length;
  return ok / considered.length;
}

// Avg cycle time (days), BRD actual → Production actual (Excel: T29)
export function avgCycleTime(rows: DeliveryRow[]): number | null {
  const considered = rows.filter(r => {
    const brd = getStage(r, 1).actual;
    const prod = getStage(r, 7).actual;
    return brd !== null && prod !== null;
  });
  if (considered.length === 0) return null;
  const sum = considered.reduce((acc, r) => {
    const brd = getStage(r, 1).actual!;
    const prod = getStage(r, 7).actual!;
    return acc + daysBetween(prod, brd);
  }, 0);
  return sum / considered.length;
}

// Avg sign-off cycle (Design Approval planned → actual, days) (Excel: T32)
export function avgSignoffCycle(rows: DeliveryRow[]): number | null {
  const considered = rows.filter(r => bothFilled(r, 2));
  if (considered.length === 0) return null;
  const sum = considered.reduce((acc, r) => {
    const s = getStage(r, 2);
    return acc + daysBetween(s.actual!, s.planned!);
  }, 0);
  return sum / considered.length;
}

export function deliveryKPIs(rows: DeliveryRow[]) {
  return {
    portfolio_pct_complete: portfolioPctComplete(rows),
    on_time_delivery:       onTimeRateAtStage(rows, 7),  // T28
    avg_cycle_time:         avgCycleTime(rows),          // T29
    brd_on_time:            onTimeRateAtStage(rows, 1),  // T30
    design_first_pass:      onTimeRateAtStage(rows, 2),  // T31
    signoff_cycle:          avgSignoffCycle(rows),       // T32
    pipeline_hit_rate:      onTimeRateAtStage(rows, 4),  // T33
    visual_hit_rate:        onTimeRateAtStage(rows, 5),  // T34
    uat_first_pass:         onTimeRateAtStage(rows, 6)   // T35
  };
}

// --- Full Scorecard composition ----------------------------------------
export interface ScorecardRow {
  kpi: OpsKPIDef | DeliveryKPIDef;
  target: number;
  actual: number | null;
  scoreVal: number | null;
  rag: RAG | null;
  weight: number;
}

export interface ScorecardSection {
  title: string;
  rows: ScorecardRow[];
  weightedScore: number | null;
  rag: RAG | null;
}

export interface FullScorecard {
  ops: { yasir: ScorecardSection; ahmad: ScorecardSection };
  delivery: { joint: ScorecardSection; yasir: ScorecardSection; ahmad: ScorecardSection };
  overall: {
    yasir: { score: number | null; rag: RAG | null };
    ahmad: { score: number | null; rag: RAG | null };
  };
}

export function buildScorecard(args: {
  // Operations: per-KPI per-Live-dashboard actuals + targets.
  opsAggregates: Record<string, { actual: number | null; target: number }>;
  // Delivery: computed metrics + manual entries
  deliveryActuals: Record<string, number | null>;
}): FullScorecard {
  const opsRow = (def: OpsKPIDef): ScorecardRow => {
    const agg = args.opsAggregates[def.key];
    const actual = agg?.actual ?? null;
    const target = agg?.target ?? 0;
    const s = target ? score(actual, target, def.direction) : null;
    return { kpi: def, target, actual, scoreVal: s, rag: rag(s), weight: def.weight };
  };
  const delRow = (def: DeliveryKPIDef): ScorecardRow => {
    const actual = args.deliveryActuals[def.key] ?? null;
    const s = score(actual, def.target, def.direction);
    return { kpi: def, target: def.target, actual, scoreVal: s, rag: rag(s), weight: def.weight };
  };

  const yasirOpsRows = OPS_KPIS.filter(k => k.owner === 'Yasir').map(opsRow);
  const ahmadOpsRows = OPS_KPIS.filter(k => k.owner === 'Ahmad').map(opsRow);
  const jointDelRows = DELIVERY_KPIS.filter(k => k.owner === 'Joint').map(delRow);
  const yasirDelRows = DELIVERY_KPIS.filter(k => k.owner === 'Yasir').map(delRow);
  const ahmadDelRows = DELIVERY_KPIS.filter(k => k.owner === 'Ahmad').map(delRow);

  const section = (title: string, rows: ScorecardRow[]): ScorecardSection => {
    const ws = weightedScore(rows.map(r => ({ score: r.scoreVal, weight: r.weight })));
    return { title, rows, weightedScore: ws, rag: rag(ws) };
  };

  const yasirOps = section('Operations · Data Engineering (Yasir)', yasirOpsRows);
  const ahmadOps = section('Operations · BI (Ahmad)', ahmadOpsRows);
  const jointDel = section('Delivery · Joint', jointDelRows);
  const yasirDel = section('Delivery · Data Engineering (Yasir)', yasirDelRows);
  const ahmadDel = section('Delivery · BI (Ahmad)', ahmadDelRows);

  const W = ROLE_ROLLUP_WEIGHTS;
  const rollup = (ops: number | null, del: number | null, joint: number | null) => {
    // Per BRD: 0.6×Ops_own + 0.3×Delivery_own + 0.1×Delivery_joint
    if (ops === null && del === null && joint === null) return null;
    return (ops ?? 0) * W.ownOps + (del ?? 0) * W.ownDelivery + (joint ?? 0) * W.jointDelivery;
  };
  const yasirOverall = rollup(yasirOps.weightedScore, yasirDel.weightedScore, jointDel.weightedScore);
  const ahmadOverall = rollup(ahmadOps.weightedScore, ahmadDel.weightedScore, jointDel.weightedScore);

  return {
    ops: { yasir: yasirOps, ahmad: ahmadOps },
    delivery: { joint: jointDel, yasir: yasirDel, ahmad: ahmadDel },
    overall: {
      yasir: { score: yasirOverall, rag: rag(yasirOverall) },
      ahmad: { score: ahmadOverall, rag: rag(ahmadOverall) }
    }
  };
}

export { OPS_KPIS, DELIVERY_KPIS, STAGES };
