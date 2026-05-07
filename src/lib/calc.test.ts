import { describe, it, expect } from 'vitest';
import {
  score, rag, rowRag, tierTarget, weightedScore,
  aggregateOpsActuals, pctComplete, deliveryStatus, deliveryKPIs,
  buildScorecard
} from './calc';
import { OPS_KPIS, DELIVERY_KPIS } from './kpi-config';

// ------------------------------------------------------------
// Score formula: H direction = MIN(actual/target, 1.2)
//                L direction = MIN(target/actual, 1.2)
// ------------------------------------------------------------
describe('score', () => {
  it('H direction: actual at target → 1', () => {
    expect(score(0.99, 0.99, 'H')).toBeCloseTo(1, 5);
  });
  it('H direction: actual above target → capped at 1.2', () => {
    expect(score(2.0, 1.0, 'H')).toBeCloseTo(1.2, 5);
  });
  it('H direction: actual below target → ratio', () => {
    expect(score(0.81, 0.90, 'H')).toBeCloseTo(0.9, 5);
  });
  it('L direction: actual below target → score > 1, capped 1.2', () => {
    expect(score(2, 4, 'L')).toBeCloseTo(1.2, 5);
    expect(score(3.5, 4, 'L')).toBeCloseTo(4 / 3.5, 5);
  });
  it('L direction: actual above target → < 1', () => {
    expect(score(5, 4, 'L')).toBeCloseTo(0.8, 5);
  });
  it('null actual → null', () => {
    expect(score(null, 1, 'H')).toBeNull();
  });
  it('zero target H direction → null', () => {
    expect(score(1, 0, 'H')).toBeNull();
  });
  it('zero actual L direction → 1.2 (perfect, no incidents/failures)', () => {
    expect(score(0, 2, 'L')).toBe(1.2);
  });
});

// ------------------------------------------------------------
// RAG buckets: ≥1 Green, ≥0.9 Amber, else Red
// ------------------------------------------------------------
describe('rag', () => {
  it('1.0 → Green', () => expect(rag(1.0)).toBe('Green'));
  it('1.05 → Green', () => expect(rag(1.05)).toBe('Green'));
  it('0.95 → Amber', () => expect(rag(0.95)).toBe('Amber'));
  it('0.9 → Amber (boundary)', () => expect(rag(0.9)).toBe('Amber'));
  it('0.89 → Red', () => expect(rag(0.89)).toBe('Red'));
  it('null → null', () => expect(rag(null)).toBeNull());
});

// ------------------------------------------------------------
// Per-row Ops RAG (different thresholds: H uses ×0.9, L uses ×1.1)
// ------------------------------------------------------------
describe('rowRag', () => {
  it('H: actual >= target → Green', () => expect(rowRag(0.99, 0.99, 'H')).toBe('Green'));
  it('H: actual >= target*0.9 → Amber', () => expect(rowRag(0.92, 1.0, 'H')).toBe('Amber'));
  it('H: actual < target*0.9 → Red', () => expect(rowRag(0.85, 1.0, 'H')).toBe('Red'));
  it('L: actual <= target → Green', () => expect(rowRag(2, 4, 'L')).toBe('Green'));
  it('L: actual <= target*1.1 → Amber', () => expect(rowRag(4.3, 4, 'L')).toBe('Amber'));
  it('L: actual > target*1.1 → Red', () => expect(rowRag(5, 4, 'L')).toBe('Red'));
});

// ------------------------------------------------------------
// Tier target HLOOKUP
// ------------------------------------------------------------
describe('tierTarget', () => {
  it('P1', () => expect(tierTarget('P1', 0.999, 0.995, 0.99)).toBe(0.999));
  it('P2', () => expect(tierTarget('P2', 0.999, 0.995, 0.99)).toBe(0.995));
  it('P3', () => expect(tierTarget('P3', 0.999, 0.995, 0.99)).toBe(0.99));
  it('unknown', () => expect(tierTarget('P9', 1, 1, 1)).toBeNull());
});

// ------------------------------------------------------------
// Weighted score: SUMPRODUCT(score, weight) / SUMPRODUCT(non-empty, weight)
// ------------------------------------------------------------
describe('weightedScore', () => {
  it('all present → weighted average', () => {
    const ws = weightedScore([
      { score: 1.0, weight: 0.5 },
      { score: 0.9, weight: 0.5 }
    ]);
    expect(ws).toBeCloseTo(0.95, 5);
  });
  it('empty score skipped from numerator AND denominator', () => {
    // If only one KPI has a score with weight 0.5 and value 1.0, weighted = 1.0
    const ws = weightedScore([
      { score: 1.0, weight: 0.5 },
      { score: null, weight: 0.5 }
    ]);
    expect(ws).toBeCloseTo(1.0, 5);
  });
  it('all empty → null', () => {
    expect(weightedScore([{ score: null, weight: 0.3 }])).toBeNull();
  });
  it('matches Excel I15 with sample Yasir Ops scores', () => {
    // Yasir Ops weights: 0.25, 0.25, 0.15, 0.15, 0.20  (sum 1.0)
    const ws = weightedScore([
      { score: 1.10, weight: 0.25 },
      { score: 1.00, weight: 0.25 },
      { score: 0.80, weight: 0.15 },
      { score: 1.20, weight: 0.15 },
      { score: 1.00, weight: 0.20 }
    ]);
    // = 0.275 + 0.25 + 0.12 + 0.18 + 0.20 = 1.025
    expect(ws).toBeCloseTo(1.025, 5);
  });
});

// ------------------------------------------------------------
// AVERAGEIFS / SUMIFS aggregation across Live dashboards
// ------------------------------------------------------------
describe('aggregateOpsActuals', () => {
  it('AVG only across Live', () => {
    const out = aggregateOpsActuals([
      { actual: 0.99, status: 'Live' },
      { actual: 0.98, status: 'Live' },
      { actual: 0.50, status: 'In Build' }
    ], 'AVG');
    expect(out).toBeCloseTo(0.985, 5);
  });
  it('SUM only across Live', () => {
    const out = aggregateOpsActuals([
      { actual: 1, status: 'Live' },
      { actual: 2, status: 'Live' },
      { actual: 99, status: 'Retired' }
    ], 'SUM');
    expect(out).toBe(3);
  });
  it('null when no Live actuals', () => {
    expect(aggregateOpsActuals([{ actual: null, status: 'Live' }], 'AVG')).toBeNull();
  });
});

// ------------------------------------------------------------
// Delivery Tracker computations (Excel: Delivery Tracker T-column)
// ------------------------------------------------------------
function ms(stage: number, planned: string | null, actual: string | null) {
  return {
    stage,
    planned: planned ? new Date(planned) : null,
    actual: actual ? new Date(actual) : null
  };
}

describe('Delivery: pctComplete', () => {
  it('all 7 actuals → 1.0', () => {
    const row = {
      milestones: [1, 2, 3, 4, 5, 6, 7].map(s => ms(s, '2026-01-01', '2026-01-05'))
    };
    expect(pctComplete(row)).toBe(1);
  });
  it('3 actuals → 3/7', () => {
    const row = {
      milestones: [
        ms(1, '2026-01-01', '2026-01-05'),
        ms(2, '2026-01-15', '2026-01-20'),
        ms(3, '2026-02-01', '2026-02-05'),
        ms(4, '2026-02-20', null),
        ms(5, '2026-03-15', null),
        ms(6, '2026-04-01', null),
        ms(7, '2026-04-20', null)
      ]
    };
    expect(pctComplete(row)).toBeCloseTo(3 / 7, 5);
  });
});

describe('Delivery: status derivation', () => {
  it('no actuals → Not Started', () => {
    const row = { milestones: [1, 2, 3, 4, 5, 6, 7].map(s => ms(s, '2026-01-01', null)) };
    expect(deliveryStatus(row)).toBe('Not Started');
  });
  it('only BRD → BRD Complete', () => {
    const row = {
      milestones: [
        ms(1, '2026-01-01', '2026-01-03'),
        ms(2, '2026-02-01', null), ms(3, null, null), ms(4, null, null),
        ms(5, null, null), ms(6, null, null), ms(7, null, null)
      ]
    };
    expect(deliveryStatus(row)).toBe('BRD Complete');
  });
  it('production filled → In Production', () => {
    const row = { milestones: [1, 2, 3, 4, 5, 6, 7].map(s => ms(s, '2026-01-01', '2026-01-05')) };
    expect(deliveryStatus(row)).toBe('In Production');
  });
});

describe('Delivery KPIs (T28..T35)', () => {
  // Build dataset matching first 3 rows of Excel Delivery Tracker for sanity:
  //   row1 (Procurement Spend): all 7 stages filled, all actuals on or after planned
  //   row2 (Supplier Perf): 6 of 7 filled (no production), some late
  //   row3 (PR/PO Cycle): 4 of 7 filled
  const rows = [
    {
      milestones: [
        ms(1, '2026-01-15', '2026-01-20'),
        ms(2, '2026-02-01', '2026-02-05'),
        ms(3, '2026-02-20', '2026-02-25'),
        ms(4, '2026-03-15', '2026-03-20'),
        ms(5, '2026-04-05', '2026-04-10'),
        ms(6, '2026-04-25', '2026-05-01'),
        ms(7, '2026-05-15', '2026-05-15')
      ]
    },
    {
      milestones: [
        ms(1, '2026-01-30', '2026-02-03'),
        ms(2, '2026-02-15', '2026-02-20'),
        ms(3, '2026-03-05', '2026-03-10'),
        ms(4, '2026-03-25', '2026-04-02'),
        ms(5, '2026-04-20', '2026-05-05'),
        ms(6, '2026-05-15', null),
        ms(7, '2026-06-01', null)
      ]
    },
    {
      milestones: [
        ms(1, '2026-02-01', '2026-02-05'),
        ms(2, '2026-02-20', '2026-02-28'),
        ms(3, '2026-03-15', '2026-03-20'),
        ms(4, '2026-04-10', '2026-05-03'),
        ms(5, '2026-04-30', null),
        ms(6, '2026-05-20', null),
        ms(7, '2026-06-05', null)
      ]
    }
  ];

  it('portfolio % complete = avg of pctComplete', () => {
    // (7/7 + 5/7 + 4/7) / 3
    const expected = (7 / 7 + 5 / 7 + 4 / 7) / 3;
    expect(deliveryKPIs(rows).portfolio_pct_complete).toBeCloseTo(expected, 5);
  });
  it('on_time_delivery: only row1 has prod filled, was on-time → 1.0', () => {
    expect(deliveryKPIs(rows).on_time_delivery).toBeCloseTo(1.0, 5);
  });
  it('brd_on_time: 0/3 (all actuals later than planned)', () => {
    expect(deliveryKPIs(rows).brd_on_time).toBeCloseTo(0, 5);
  });
  it('design_first_pass: 0/3', () => {
    // row1 design actual 02-05 > planned 02-01 → late
    // row2 design actual 02-20 > 02-15 → late
    // row3 design actual 02-28 > 02-20 → late
    expect(deliveryKPIs(rows).design_first_pass).toBeCloseTo(0, 5);
  });
  it('uat_first_pass: 1/1 (only row1 has UAT both dates; actual 05-01 > planned 04-25 → late, so 0)', () => {
    expect(deliveryKPIs(rows).uat_first_pass).toBeCloseTo(0, 5);
  });
  it('avg_cycle_time: row1 only has prod actual; days(2026-05-15 - 2026-01-20)', () => {
    const days = (new Date('2026-05-15').getTime() - new Date('2026-01-20').getTime()) / 86400000;
    expect(deliveryKPIs(rows).avg_cycle_time).toBeCloseTo(days, 5);
  });
});

// ------------------------------------------------------------
// Full Scorecard composition + role rollup
// ------------------------------------------------------------
describe('buildScorecard', () => {
  // Build sample input: every Ops KPI hits target exactly; every delivery KPI hits target exactly.
  const opsAggregates: Record<string, { actual: number | null; target: number }> = {};
  for (const k of OPS_KPIS) {
    // synthesize target reasonable; for L direction, actual at target == score 1
    const target = k.direction === 'H' ? 0.95 : 4;
    opsAggregates[k.key] = { actual: target, target };
  }
  const deliveryActuals: Record<string, number | null> = {};
  for (const k of DELIVERY_KPIS) {
    deliveryActuals[k.key] = k.target;
  }

  const sc = buildScorecard({ opsAggregates, deliveryActuals });

  it('all-on-target produces weighted score 1.0 per section', () => {
    expect(sc.ops.yasir.weightedScore).toBeCloseTo(1, 5);
    expect(sc.ops.ahmad.weightedScore).toBeCloseTo(1, 5);
    expect(sc.delivery.joint.weightedScore).toBeCloseTo(1, 5);
    expect(sc.delivery.yasir.weightedScore).toBeCloseTo(1, 5);
    expect(sc.delivery.ahmad.weightedScore).toBeCloseTo(1, 5);
  });
  it('all-on-target: overall = 0.6×1 + 0.3×1 + 0.1×1 = 1.0', () => {
    expect(sc.overall.yasir.score).toBeCloseTo(1, 5);
    expect(sc.overall.ahmad.score).toBeCloseTo(1, 5);
    expect(sc.overall.yasir.rag).toBe('Green');
  });
  it('Yasir Ops weights sum to 1.0', () => {
    const sum = OPS_KPIS.filter(k => k.owner === 'Yasir').reduce((a, k) => a + k.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
  it('Ahmad Ops weights sum to 1.0', () => {
    const sum = OPS_KPIS.filter(k => k.owner === 'Ahmad').reduce((a, k) => a + k.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
  it('Joint Delivery weights sum to 1.0', () => {
    const sum = DELIVERY_KPIS.filter(k => k.owner === 'Joint').reduce((a, k) => a + k.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
  it('Yasir Delivery weights sum to 1.0', () => {
    const sum = DELIVERY_KPIS.filter(k => k.owner === 'Yasir').reduce((a, k) => a + k.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
  it('Ahmad Delivery weights sum to 1.0', () => {
    const sum = DELIVERY_KPIS.filter(k => k.owner === 'Ahmad').reduce((a, k) => a + k.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  // Mixed scenario: each section different, verify rollup
  it('rollup formula: 0.6×ownOps + 0.3×ownDelivery + 0.1×Joint', () => {
    const sc2 = buildScorecard({
      opsAggregates: Object.fromEntries(
        OPS_KPIS.map(k => [k.key, { actual: k.direction === 'H' ? 0.95 * 0.9 : 4 / 0.9, target: k.direction === 'H' ? 0.95 : 4 }])
      ),
      // → every score = 0.9 → weighted Ops score = 0.9
      deliveryActuals: Object.fromEntries(DELIVERY_KPIS.map(k => [k.key, k.direction === 'H' ? k.target * 0.8 : k.target / 0.8]))
      // → every score = 0.8 → weighted Delivery = 0.8 each
    });
    // 0.6*0.9 + 0.3*0.8 + 0.1*0.8 = 0.54 + 0.24 + 0.08 = 0.86
    expect(sc2.overall.yasir.score).toBeCloseTo(0.86, 5);
    expect(sc2.overall.yasir.rag).toBe('Red');
  });
});
