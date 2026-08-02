---
name: System Settings Module
description: How the new system_settings key-value table and helper work; cache invalidation pattern; which settings exist.
---

# System Settings Module

## What it is
A runtime-configurable key-value store for all platform business rules that would otherwise be hardcoded. Lives in `lib/db/src/schema/systemSettings.ts` (table: `system_settings`, unique index on `setting_key`).

## Helper file
`artifacts/api-server/src/lib/systemSettings.ts`
- `getSystemSetting(key, default)` — string
- `getSystemSettingInt(key, default)` — integer
- `getSystemSettingFloat(key, default)` — float
- `getSystemSettingBool(key, default)` — boolean
- `getAllSystemSettings()` — Record<string, string>
- `upsertSystemSettings(updates)` — bulk upsert + cache invalidation
- `invalidateSystemSettingsCache()` — call after any manual DB write

## Cache TTL
60 seconds in-memory. Workers reading on every 30s tick are safe.

## Admin API
- `GET /api/admin/settings` → `{ settings, defaults }`
- `PUT /api/admin/settings` → validates keys against SYSTEM_SETTING_DEFAULTS, bulk upserts

## Canonical keys & defaults
| Key | Default |
|-----|---------|
| FREE_TRIAL_DAYS | "7" |
| TRIAL_ENABLED | "true" |
| PHONE_VERIFICATION_REQUIRED | "true" |
| AUTO_ASSIGN_MASTER | "true" |
| AUTO_BIND_AFTER_VERIFICATION | "false" |
| VIP_MONTHLY_PRICE | "3000" |
| PRO_MONTHLY_PRICE | "5000" |
| MAX_USERS_PER_MASTER | "2000" |
| MASTER_RESERVED_CAPACITY_PERCENT | "10" |
| AUTO_REBALANCE | "true" |

**Why:** Adding a new key requires adding it to `SYSTEM_SETTING_DEFAULTS` in `systemSettings.ts` — the PUT endpoint validates against that map and rejects unknown keys.

## Admin UI
`/admin/settings` → `artifacts/pesamatrix/src/pages/admin/system-settings.tsx`
