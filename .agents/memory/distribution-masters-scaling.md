---
name: Distribution Masters Scaling Architecture
description: New multi-master scaling layer added to PesaMatrix — three new DB tables, five new workers, one new API router, one new admin page.
---

# Distribution Masters Scaling Architecture

## What was added

Three new DB tables (no existing tables modified):
- `distribution_masters` — intermediate signal-provider accounts (ONLINE/OFFLINE/MAINTENANCE/DISABLED)
- `strategy_groups` — logical groupings (Gold VIP, Forex VIP, etc.)
- `master_bindings` — maps userId → distributionMasterId (one active binding per user)

Five new backend modules in `artifacts/api-server/src/lib/`:
- `tradeReplication.ts` — async RetryQueue that PUT-subscribes Distribution Masters to the Trading Master's CopyFactory strategy
- `distributionMasterHealth.ts` — setInterval every 10s, marks OFFLINE after 60s disconnect, notifies admins
- `loadBalancer.ts` — setInterval every 30s, assigns unbound active subscribers to least-loaded ONLINE master
- `rebalancer.ts` — setInterval every hour, suggests or auto-migrates overloaded→underutilised (autoRebalanceEnabled toggle)
- `analyticsWorker.ts` — setInterval every 5min, caches PlatformAnalytics in memory

New API router: `artifacts/api-server/src/routes/distributionMasters.ts`
- Mounted in `routes/index.ts` as `distributionMastersRouter`
- All routes require `authenticate + requireAdmin`
- Key endpoints: CRUD masters, strategy groups, subscriber lists, rebalancer config, analytics

New frontend admin page: `artifacts/pesamatrix/src/pages/admin/distribution-masters.tsx`
- Uses `AppLayout` from `@/components/layout/app-layout` (not `Layout`)
- Route: `/admin/distribution-masters`
- Added to sidebar `adminNavItems` with `Network` icon

## Critical patterns

**Why:** Existing single-master architecture hits ~2,000 slave account limit per CopyFactory strategy. Distribution Masters act as intermediate providers, each serving ~2,000 slaves, letting the platform scale to 10,000–15,000+ total.

**How replication works:** Each Distribution Master subscribes to the Trading Master's CopyFactory strategy via the CopyFactory PUT /subscribers endpoint. CopyFactory handles the actual trade mirroring automatically. The "engine" manages subscription lifecycle, not individual trades.

**Load is tracked two ways:** `distributionMasters.currentLoad` (int counter) updated on assignment/unassignment; `recalculateAllLoads()` runs at startup to reconcile from actual master_bindings count.

**Backward compatibility:** All existing tables, routes, workers, and auth untouched. `masterBindingsTable` extends (not replaces) the existing `bindingsTable` (strategy_subscribers).

**AppLayout note:** Admin pages import `AppLayout` from `@/components/layout/app-layout`, not `Layout` from `@/components/layout/layout` (the latter doesn't exist).
