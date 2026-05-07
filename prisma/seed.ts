import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { OPS_KPIS, DELIVERY_KPIS } from '../src/lib/kpi-config';

const prisma = new PrismaClient();

interface SeedDashboard {
  ID: number;
  'Dashboard Name': string;
  Domain: string;
  Status: string;
  Tier: string;
  'DE Owner'?: string;
  'BI Owner'?: string;
  'Source System'?: string;
  'Refresh Frequency'?: string;
  'Refresh Window'?: string;
  'Business Sponsor'?: string;
  'Data Owner'?: string;
  'Change Approver'?: string;
  'Escalation Contact'?: string;
  'Stakeholder Group'?: string;
  'Access Rule'?: string;
  'Change Control Rule'?: string;
  'Data Sensitivity'?: string;
  Notes?: string;
}

interface SeedDelivery {
  name: string;
  domain: string;
  milestones: { stage: number; planned: string | null; actual: string | null }[];
}

interface SeedTier {
  kpi: string;
  p1: number;
  p2: number;
  p3: number;
  direction: string;
  unit: string;
  notes: string | null;
}

async function main() {
  console.log('🌱 Seeding database...');

  // ---- Users ----
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const users = [
    { email: 'saad@remat.sa',  name: 'Saad',  role: 'ADMIN' },
    { email: 'yasir@remat.sa', name: 'Yasir', role: 'DATA_ENGINEER' },
    { email: 'ahmad@remat.sa', name: 'Ahmad', role: 'BI_DEVELOPER' },
    { email: 'cfo@remat.sa',   name: 'CFO',   role: 'STAKEHOLDER' },
    { email: 'ceo@remat.sa',   name: 'CEO',   role: 'EXECUTIVE' }
  ];
  const userIdByName: Record<string, string> = {};
  for (const u of users) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash }
    });
    userIdByName[u.name] = created.id;
  }
  console.log(`  ✓ Users: ${users.length}`);

  // ---- Lookups ----
  const lookups: { listName: string; values: { en: string; ar?: string }[] }[] = [
    { listName: 'Tiers', values: [{ en: 'P1', ar: 'الأولوية 1' }, { en: 'P2', ar: 'الأولوية 2' }, { en: 'P3', ar: 'الأولوية 3' }] },
    { listName: 'Status', values: [
      { en: 'Live', ar: 'مباشر' }, { en: 'In Build', ar: 'قيد البناء' },
      { en: 'In Scoping', ar: 'قيد التحديد' }, { en: 'Not Started', ar: 'لم يبدأ' },
      { en: 'Retired', ar: 'متقاعد' }
    ]},
    { listName: 'Domain', values: [
      { en: 'Finance' }, { en: 'Procurement' }, { en: 'HCM' }, { en: 'IT SM' },
      { en: 'Strategy' }, { en: 'Operations' }, { en: 'Compliance' }, { en: 'TBD' }
    ]},
    { listName: 'RefreshFrequency', values: [
      { en: 'Real-time' }, { en: 'Hourly' }, { en: 'Daily' }, { en: 'Weekly' },
      { en: 'Monthly' }, { en: 'Quarterly' }
    ]},
    { listName: 'SourceSystem', values: [
      { en: 'Oracle Fusion (Finance)' }, { en: 'Oracle Fusion (Procurement)' },
      { en: 'Oracle Fusion (HCM)' }, { en: 'Service Desk Tool' },
      { en: 'Azure DevOps' }, { en: 'Mixed (Fusion + Manual)' },
      { en: 'Manual / Excel' }, { en: 'TBD' }
    ]},
    { listName: 'DataSensitivity', values: [
      { en: 'Public' }, { en: 'Internal' }, { en: 'Confidential' }, { en: 'Restricted' }
    ]},
    { listName: 'RAG', values: [{ en: 'Green' }, { en: 'Amber' }, { en: 'Red' }] }
  ];
  for (const l of lookups) {
    for (let i = 0; i < l.values.length; i++) {
      const v = l.values[i];
      await prisma.lookupValue.upsert({
        where: { listName_valueEn: { listName: l.listName, valueEn: v.en } },
        update: { valueAr: v.ar, sortOrder: i },
        create: { listName: l.listName, valueEn: v.en, valueAr: v.ar, sortOrder: i }
      });
    }
  }
  console.log(`  ✓ Lookups: ${lookups.reduce((a, l) => a + l.values.length, 0)} values`);

  // ---- SLA Tiers (10 KPIs) ----
  for (const k of OPS_KPIS) {
    await prisma.sLATier.upsert({
      where: { kpiKey: k.key },
      update: {},
      create: {
        kpiKey: k.key,
        kpiName: k.name,
        // Defaults from Excel SLA Tiers sheet
        p1Target: TIER_DEFAULTS[k.key].p1,
        p2Target: TIER_DEFAULTS[k.key].p2,
        p3Target: TIER_DEFAULTS[k.key].p3,
        direction: k.direction,
        unit: k.unit,
        notes: TIER_DEFAULTS[k.key].notes,
        sortOrder: k.sortOrder
      }
    });
  }
  console.log(`  ✓ SLA Tiers: ${OPS_KPIS.length} KPIs`);

  // ---- Dashboards (31 from Excel) ----
  const seedPath = path.join(process.cwd(), 'scripts', 'seed-data.json');
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8')) as {
    dashboards: SeedDashboard[];
    delivery: SeedDelivery[];
    tiers: SeedTier[];
  };

  for (const d of seed.dashboards) {
    const ownerId = (n?: string) => (n && userIdByName[n]) ? userIdByName[n] : null;
    await prisma.dashboard.upsert({
      where: { id: d.ID },
      update: {},
      create: {
        id: d.ID,
        name: d['Dashboard Name'],
        domain: d.Domain,
        status: d.Status,
        tier: d.Tier,
        deOwnerId: ownerId(d['DE Owner']),
        biOwnerId: ownerId(d['BI Owner']),
        sourceSystem: d['Source System'] ?? null,
        refreshFrequency: d['Refresh Frequency'] ?? null,
        refreshWindow: d['Refresh Window'] ?? null,
        businessSponsor: d['Business Sponsor'] ?? null,
        dataOwner: d['Data Owner'] ?? null,
        changeApprover: d['Change Approver'] ?? null,
        escalationContact: d['Escalation Contact'] ?? null,
        stakeholderGroup: d['Stakeholder Group'] ?? null,
        accessRule: d['Access Rule'] ?? null,
        changeControlRule: d['Change Control Rule'] ?? null,
        dataSensitivity: d['Data Sensitivity'] ?? null,
        notes: d.Notes ?? null,
        createdBy: userIdByName['Saad'],
        updatedBy: userIdByName['Saad']
      }
    });
  }
  console.log(`  ✓ Dashboards: ${seed.dashboards.length}`);

  // ---- Delivery milestones ----
  const dashboardByName = await prisma.dashboard.findMany();
  for (const dRow of seed.delivery) {
    const match = dashboardByName.find(x => x.name === dRow.name);
    if (!match) continue;
    for (const m of dRow.milestones) {
      await prisma.deliveryMilestone.upsert({
        where: { dashboardId_stage: { dashboardId: match.id, stage: m.stage } },
        update: {
          plannedDate: m.planned ? new Date(m.planned) : null,
          actualDate: m.actual ? new Date(m.actual) : null
        },
        create: {
          dashboardId: match.id,
          stage: m.stage,
          plannedDate: m.planned ? new Date(m.planned) : null,
          actualDate: m.actual ? new Date(m.actual) : null,
          updatedById: userIdByName['Yasir']
        }
      });
    }
  }
  console.log(`  ✓ Delivery milestones for ${seed.delivery.length} in-flight dashboards`);

  // ---- Sample Ops SLA Actuals for current period (so Scorecard renders meaningfully) ----
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const liveDashboards = dashboardByName.filter(d => d.status === 'Live');
  // Generate plausible synthetic actuals near targets for visual verification
  const sampleByKpi: Record<string, () => number> = {
    pipeline_availability: () => 0.992 + Math.random() * 0.007,
    data_freshness: () => 0.93 + Math.random() * 0.05,
    pipeline_failures: () => Math.floor(Math.random() * 3),
    incident_mttr: () => 2 + Math.random() * 3,
    dq_pass_rate: () => 0.96 + Math.random() * 0.03,
    dashboard_availability: () => 0.992 + Math.random() * 0.007,
    report_load_time: () => 3 + Math.random() * 3,
    p1_defect_resolution: () => 4 + Math.random() * 6,
    active_user_adoption: () => 0.6 + Math.random() * 0.25,
    user_csat: () => 4 + Math.random() * 0.6
  };
  for (const d of liveDashboards) {
    for (const k of OPS_KPIS) {
      const val = sampleByKpi[k.key]();
      await prisma.opsSLAActual.upsert({
        where: { dashboardId_period_kpiKey: { dashboardId: d.id, period, kpiKey: k.key } },
        update: { actualValue: val },
        create: {
          dashboardId: d.id, period, kpiKey: k.key,
          actualValue: val, recordedById: userIdByName['Yasir']
        }
      });
    }
  }
  console.log(`  ✓ Sample Ops SLA Actuals for period ${period} (${liveDashboards.length} live dashboards × ${OPS_KPIS.length} KPIs)`);

  // ---- Sample manual Delivery KPI actuals (4 manual KPIs) ----
  const manualSamples: Record<string, number> = {
    estimation_accuracy: 0.82,
    defect_escape_rate: 1.6,
    fusion_coverage: 0.93,
    preprod_dq_pass: 0.96
  };
  for (const [kpiKey, val] of Object.entries(manualSamples)) {
    await prisma.deliveryKPIActual.upsert({
      where: { period_kpiKey: { period, kpiKey } },
      update: { actualValue: val },
      create: { period, kpiKey, actualValue: val }
    });
  }
  console.log(`  ✓ Manual Delivery KPI actuals: ${Object.keys(manualSamples).length}`);

  console.log('\n✓ Seed complete.');
  console.log('  Login as any of:');
  for (const u of users) console.log(`    ${u.email}  /  demo1234   (${u.role})`);
}

// Defaults from SLA Tiers sheet
const TIER_DEFAULTS: Record<string, { p1: number; p2: number; p3: number; notes: string }> = {
  pipeline_availability:  { p1: 0.999, p2: 0.995, p3: 0.99,  notes: 'Calendar month, excludes planned maintenance' },
  data_freshness:         { p1: 0.99,  p2: 0.95,  p3: 0.90,  notes: 'Window varies per dashboard; set in Portfolio.Refresh Window' },
  pipeline_failures:      { p1: 0,     p2: 2,     p3: 5,     notes: 'Excludes retries that succeed within 30 minutes' },
  incident_mttr:          { p1: 2,     p2: 4,     p3: 8,     notes: 'From incident detection to resolution' },
  dq_pass_rate:           { p1: 0.99,  p2: 0.98,  p3: 0.95,  notes: 'Across all DQ test cases' },
  dashboard_availability: { p1: 0.999, p2: 0.995, p3: 0.99,  notes: 'Power BI service uptime' },
  report_load_time:       { p1: 3,     p2: 5,     p3: 8,     notes: 'Top dashboards in tier' },
  p1_defect_resolution:   { p1: 4,     p2: 8,     p3: 24,    notes: 'From ticket open to fix deployed' },
  active_user_adoption:   { p1: 0.8,   p2: 0.7,   p3: 0.5,   notes: 'Monthly active vs target audience size' },
  user_csat:              { p1: 4.3,   p2: 4.0,   p3: 3.8,   notes: 'Quarterly survey average' }
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
