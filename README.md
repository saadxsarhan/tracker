# Remat Al-Riyadh — D&A KPI Tracker

Web application that replaces the multi-sheet Excel KPI tracker used by the Data & Analytics function. Operations SLA + Delivery KPI tracking with role-based access, audit log, and historical reporting.

## What's in this build

This is a working **Phase 1 foundation** — all 7 modules from the BRD are present and functional with real CRUD against a SQLite database. Calculation engine matches the source Excel exactly (50 unit tests pinning parity).

### Modules
1. **Overview** — Role-aware landing page with KPI tiles, RAG summary, recent activity feed
2. **Scorecard** — Monthly KPI scorecard, all 21 KPIs, weighted role rollup, period selector
3. **Dashboard Portfolio** — 31 dashboards seeded from Excel; filter, search, edit
4. **Ops SLA Tracker** — Per-dashboard monthly SLA with tier-driven targets, inline edit, period lock
5. **Delivery Tracker** — 7-stage milestones, auto status, % complete, late-cell highlighting
6. **Reports** — CSV exports (scorecard, portfolio, SLA history, delivery)
7. **Admin** — SLA Tiers, Lookups (EN/AR), Users, Audit Log

### Roles & RBAC
| Role | Permissions |
|---|---|
| ADMIN (Saad) | Full CRUD on everything |
| DATA_ENGINEER (Yasir) | Edit Ops SLA + DE-stage milestones for owned dashboards |
| BI_DEVELOPER (Ahmad) | Edit Ops SLA + BI-stage milestones for owned dashboards |
| STAKEHOLDER (CSSO) | Read-only access |
| EXECUTIVE (CEO) | Read-only Scorecard summary |

RBAC enforced at the API layer (not just UI). Every write produces an audit-log entry with field-level diff.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Initialize database (SQLite, file ./prisma/dev.db)
npm run db:reset    # creates schema + seeds 31 dashboards, 10 KPIs, lookups, demo users

# 3. Start dev server
npm run dev         # http://localhost:3000

# 4. Run unit tests (50 tests verifying calculation engine matches Excel)
npm test
```

### Demo accounts (password: `demo1234`)

| Email | Role |
|---|---|
| saad@remat.sa | ADMIN |
| yasir@remat.sa | DATA_ENGINEER |
| ahmad@remat.sa | BI_DEVELOPER |
| cfo@remat.sa | STAKEHOLDER |
| ceo@remat.sa | EXECUTIVE |

## Architecture

- **Frontend & backend**: Next.js 14 (App Router), React, TypeScript
- **Database**: SQLite via Prisma ORM (production: swap `provider = "postgresql"` in `prisma/schema.prisma`)
- **Auth**: Email + password using `iron-session` (Phase 2: Azure AD SSO)
- **Calc engine**: `src/lib/calc.ts` — pure TypeScript, fully tested
- **i18n**: Lightweight scaffold in `src/lib/i18n.ts`. RTL layout flips automatically when locale = `ar`
- **Branding**: Navy `#1F2D5A` + Gold `#C9A94F` per brand spec (BRD §7)

### Calculation engine parity

The KPI calculation engine in `src/lib/calc.ts` is the heart of the system. Every formula in the source Excel has been ported and pinned by tests:

- **Score** (`Scorecard!I-column`): `MIN(actual/target, 1.2)` for H, `MIN(target/actual, 1.2)` for L
- **RAG** (`Scorecard!J-column`): Green ≥1, Amber ≥0.9, Red <0.9
- **Per-row Ops RAG** (`Ops SLA Tracker H/N…`): different thresholds for L (×1.1) vs H (×0.9)
- **Tier target** (HLOOKUP): looks up P1/P2/P3 column for each KPI
- **Section weighted score** (`Scorecard!I15,I23,I33,I39,I45`): SUMPRODUCT(score, weight) ÷ SUMPRODUCT(non-empty, weight)
- **Delivery KPIs** (`Delivery Tracker T27..T35`): Pct complete, on-time at each stage, cycle time, sign-off cycle
- **Role rollup**: 0.6 × own-Ops + 0.3 × own-Delivery + 0.1 × Joint-Delivery

Run `npm test` to verify all 50 calculation tests pass.

## Excel → Web mapping

| Excel sheet | Web module | Notes |
|---|---|---|
| Scorecard | `/scorecard` | All 21 KPIs, weighted role roll-up, period selector |
| Dashboard Portfolio | `/portfolio` | 31 dashboards seeded; full governance fields preserved |
| SLA Tiers | `/admin/tiers` | KPI × Tier matrix, version-tracked |
| Ops SLA Tracker | `/ops` | Inline-edit grid, tier targets pulled live |
| Delivery Tracker | `/delivery` | 7-stage milestones with date pickers |
| Lookups | `/admin/lookups` | EN/AR values, archive-not-delete |
| README (Excel) | `/` (Overview) | Replaced by interactive landing page |

## Deferred to Phase 2 (per BRD §3 + §12)

- Azure AD SSO + MFA (Phase 1 ships email+password fallback)
- Branded PDF rendering (CSV export in place)
- Scheduled email notifications (SLA reminders, weekly digest)
- Gantt chart view for delivery
- File attachments on milestones
- Bulk CSV import UI
- Power BI / Oracle Fusion / Azure DevOps integrations
- Full Arabic translation of every UI string (scaffold present, ~30 keys translated)
- Penetration test, axe-core full sweep, Lighthouse 90+ verification

## Testing

```bash
npm test              # vitest run, 50 tests
npm run typecheck     # tsc --noEmit
npm run build         # next build (full prod compile)
```

## Project structure

```
prisma/
  schema.prisma       # Data model (User, Dashboard, SLATier, OpsSLAActual, DeliveryMilestone, ...)
  seed.ts             # Seeds DB from Excel-extracted JSON
scripts/
  seed-data.json      # Extracted from source-tracker.xlsx
src/
  app/
    (app)/            # Authenticated app shell
      overview/
      scorecard/
      portfolio/
      ops/
      delivery/
      reports/
      admin/{tiers,lookups,users,audit}/
    api/              # API routes (auth, dashboards, ops-actuals, milestones, sla-tiers, lookups, exports)
    login/
  components/         # AppShell, Sidebar, TopBar, RagPill, PeriodPicker
  lib/
    auth.ts           # iron-session + RBAC helpers
    audit.ts          # field-level diff audit logger
    calc.ts           # Calculation engine (Excel parity)
    calc.test.ts      # 50 tests
    csv.ts
    db.ts
    i18n.ts
    kpi-config.ts     # Canonical KPI definitions (10 Ops + 11 Delivery)
    scorecard-server.ts # DB-backed scorecard composition
```
