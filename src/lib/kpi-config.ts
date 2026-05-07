// Canonical KPI configuration - mirrors source-tracker.xlsx (SLA Tiers + Scorecard sheets).
// When this file and the Excel disagree, the Excel wins (per BRD Appendix A).

export type Direction = 'H' | 'L'; // Higher-is-better | Lower-is-better
export type RAG = 'Green' | 'Amber' | 'Red';
export type RoleKey = 'Yasir' | 'Ahmad' | 'Joint';

// 10 Operations KPIs — feed from Ops SLA Tracker, target by tier.
export interface OpsKPIDef {
  key: string;
  name: string;
  owner: 'Yasir' | 'Ahmad';
  direction: Direction;
  unit: string;
  // Aggregation across "Live" dashboards for the period:
  //   AVG: AVERAGEIFS  |  SUM: SUMIFS
  aggregation: 'AVG' | 'SUM';
  weight: number;        // weight inside its (owner) Ops sub-pillar
  sortOrder: number;
}

export const OPS_KPIS: OpsKPIDef[] = [
  { key: 'pipeline_availability',    name: 'Pipeline availability',     owner: 'Yasir', direction: 'H', unit: '%',          aggregation: 'AVG', weight: 0.25, sortOrder: 1 },
  { key: 'data_freshness',           name: 'Data freshness % met',      owner: 'Yasir', direction: 'H', unit: '%',          aggregation: 'AVG', weight: 0.25, sortOrder: 2 },
  { key: 'pipeline_failures',        name: 'Pipeline failures / month', owner: 'Yasir', direction: 'L', unit: 'Count',      aggregation: 'SUM', weight: 0.15, sortOrder: 3 },
  { key: 'incident_mttr',            name: 'Incident MTTR (hours)',     owner: 'Yasir', direction: 'L', unit: 'Hours',      aggregation: 'AVG', weight: 0.15, sortOrder: 4 },
  { key: 'dq_pass_rate',             name: 'Data quality pass rate',    owner: 'Yasir', direction: 'H', unit: '%',          aggregation: 'AVG', weight: 0.20, sortOrder: 5 },
  { key: 'dashboard_availability',   name: 'Dashboard availability',    owner: 'Ahmad', direction: 'H', unit: '%',          aggregation: 'AVG', weight: 0.25, sortOrder: 6 },
  { key: 'report_load_time',         name: 'Avg report load time (sec)', owner: 'Ahmad', direction: 'L', unit: 'Seconds',   aggregation: 'AVG', weight: 0.15, sortOrder: 7 },
  { key: 'p1_defect_resolution',     name: 'P1 defect resolution (hrs)', owner: 'Ahmad', direction: 'L', unit: 'Hours',     aggregation: 'AVG', weight: 0.20, sortOrder: 8 },
  { key: 'active_user_adoption',     name: 'Active user adoption',      owner: 'Ahmad', direction: 'H', unit: '%',          aggregation: 'AVG', weight: 0.20, sortOrder: 9 },
  { key: 'user_csat',                name: 'User CSAT (1-5)',           owner: 'Ahmad', direction: 'H', unit: 'Score 1-5',  aggregation: 'AVG', weight: 0.20, sortOrder: 10 }
];

// 11 Delivery KPIs — split across Joint, DE (Yasir), BI (Ahmad).
// Some pull from Delivery Tracker computations; others are manually entered.
export type DeliverySource =
  | 'PORTFOLIO_PCT_COMPLETE'      // T27 - avg %complete
  | 'ON_TIME_DELIVERY'            // T28
  | 'AVG_CYCLE_TIME'              // T29
  | 'BRD_ON_TIME'                 // T30
  | 'DESIGN_FIRST_PASS'           // T31
  | 'SIGNOFF_CYCLE_DAYS'          // T32
  | 'PIPELINE_HIT_RATE'           // T33
  | 'VISUAL_HIT_RATE'             // T34
  | 'UAT_FIRST_PASS'              // T35
  | 'MANUAL';                     // entered by user

export interface DeliveryKPIDef {
  key: string;
  name: string;
  owner: RoleKey;
  direction: Direction;
  target: number;
  weight: number;          // weight inside its (owner) Delivery sub-pillar
  source: DeliverySource;
  sortOrder: number;
  unit: string;
}

export const DELIVERY_KPIS: DeliveryKPIDef[] = [
  // Joint
  { key: 'on_time_delivery',     name: 'On-time delivery vs roadmap',     owner: 'Joint', direction: 'H', target: 0.90, weight: 0.30, source: 'ON_TIME_DELIVERY',  sortOrder: 11, unit: '%' },
  { key: 'avg_cycle_time',       name: 'Avg cycle time (days)',           owner: 'Joint', direction: 'L', target: 45,   weight: 0.20, source: 'AVG_CYCLE_TIME',   sortOrder: 12, unit: 'Days' },
  { key: 'estimation_accuracy',  name: 'Estimation accuracy',             owner: 'Joint', direction: 'H', target: 0.85, weight: 0.15, source: 'MANUAL',           sortOrder: 13, unit: '%' },
  { key: 'defect_escape_rate',   name: 'Defect escape rate / dashboard',  owner: 'Joint', direction: 'L', target: 2,    weight: 0.15, source: 'MANUAL',           sortOrder: 14, unit: 'Count' },
  { key: 'uat_first_pass',       name: 'UAT first-pass rate',             owner: 'Joint', direction: 'H', target: 0.80, weight: 0.20, source: 'UAT_FIRST_PASS',   sortOrder: 15, unit: '%' },
  // DE (Yasir)
  { key: 'fusion_coverage',      name: 'Fusion semantic-layer coverage',  owner: 'Yasir', direction: 'H', target: 0.95, weight: 0.35, source: 'MANUAL',           sortOrder: 16, unit: '%' },
  { key: 'pipeline_hit_rate',    name: 'Pipeline milestone hit rate',     owner: 'Yasir', direction: 'H', target: 0.90, weight: 0.35, source: 'PIPELINE_HIT_RATE', sortOrder: 17, unit: '%' },
  { key: 'preprod_dq_pass',      name: 'Pre-prod data quality pass rate', owner: 'Yasir', direction: 'H', target: 0.95, weight: 0.30, source: 'MANUAL',           sortOrder: 18, unit: '%' },
  // BI (Ahmad)
  { key: 'visual_hit_rate',      name: 'Visual milestone hit rate',       owner: 'Ahmad', direction: 'H', target: 0.90, weight: 0.40, source: 'VISUAL_HIT_RATE',  sortOrder: 19, unit: '%' },
  { key: 'design_first_pass',    name: 'Design review first-pass rate',   owner: 'Ahmad', direction: 'H', target: 0.80, weight: 0.30, source: 'DESIGN_FIRST_PASS', sortOrder: 20, unit: '%' },
  { key: 'signoff_cycle',        name: 'Stakeholder sign-off cycle (days)', owner: 'Ahmad', direction: 'L', target: 5,  weight: 0.30, source: 'SIGNOFF_CYCLE_DAYS', sortOrder: 21, unit: 'Days' }
];

export const STAGES = [
  { id: 1, key: 'BRD',              name: 'BRD',                 owner: 'Joint' },
  { id: 2, key: 'DESIGN_APPROVAL',  name: 'Design Approval',     owner: 'Ahmad' },
  { id: 3, key: 'DATA_MODEL',       name: 'Data Model (Fusion)', owner: 'Yasir' },
  { id: 4, key: 'PIPELINE',         name: 'Pipeline (DE)',       owner: 'Yasir' },
  { id: 5, key: 'VISUAL',           name: 'Visual (BI)',         owner: 'Ahmad' },
  { id: 6, key: 'UAT',              name: 'UAT',                 owner: 'Joint' },
  { id: 7, key: 'PRODUCTION',       name: 'Production',          owner: 'Joint' }
] as const;

export const STATUS_BY_LAST_STAGE: Record<number, string> = {
  0: 'Not Started',
  1: 'BRD Complete',
  2: 'Design Approved',
  3: 'Data Model Complete',
  4: 'Pipeline Complete',
  5: 'Visual Complete',
  6: 'UAT Complete',
  7: 'In Production'
};

// Overall role rollup (per BRD Section 4.2):
// 0.6 × own-role Ops weighted score + 0.3 × own-role Delivery weighted score + 0.1 × Joint Delivery weighted score
export const ROLE_ROLLUP_WEIGHTS = {
  ownOps: 0.6,
  ownDelivery: 0.3,
  jointDelivery: 0.1
};

// Tier definitions (editable by Admin in SLA Tiers module)
export const TIER_DEFINITIONS = {
  P1: 'Critical — Dashboards used by C-level / regulatory / financial close. Outage triggers immediate response.',
  P2: 'Important — Dashboards used by department heads or for operational decisions on a weekly basis.',
  P3: 'Standard — Reference / informational dashboards used periodically. Outage handled within standard hours.'
};
