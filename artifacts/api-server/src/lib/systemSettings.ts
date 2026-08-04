/**
 * System Settings Helper
 *
 * Provides typed access to the system_settings key-value table with a
 * 60-second in-memory cache so workers can call getSystemSetting() on every
 * tick without hammering the database.
 *
 * Usage:
 *   const trialDays = await getSystemSettingInt("FREE_TRIAL_DAYS", 7);
 *   const trialEnabled = await getSystemSettingBool("TRIAL_ENABLED", true);
 */

import { db, systemSettingsTable } from "@workspace/db";
import { logger } from "./logger";

// ── Defaults ──────────────────────────────────────────────────────────────────
export const SYSTEM_SETTING_DEFAULTS: Record<string, string> = {
  FREE_TRIAL_DAYS: "7",
  TRIAL_ENABLED: "true",
  PHONE_VERIFICATION_REQUIRED: "true",
  AUTO_ASSIGN_MASTER: "true",
  AUTO_BIND_AFTER_VERIFICATION: "false",
  MAX_USERS_PER_MASTER: "2000",
  MASTER_RESERVED_CAPACITY_PERCENT: "10",
  AUTO_REBALANCE: "true",
};

// ── In-memory cache ───────────────────────────────────────────────────────────
let cache: Map<string, string> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

async function loadCache(): Promise<Map<string, string>> {
  try {
    const rows = await db.select().from(systemSettingsTable);
    const m = new Map<string, string>(
      Object.entries(SYSTEM_SETTING_DEFAULTS),
    );
    for (const row of rows) {
      m.set(row.settingKey, row.settingValue);
    }
    cache = m;
    cacheLoadedAt = Date.now();
    return m;
  } catch (err) {
    logger.warn({ err }, "systemSettings: failed to load from DB — using defaults");
    const m = new Map<string, string>(Object.entries(SYSTEM_SETTING_DEFAULTS));
    return m;
  }
}

async function getCache(): Promise<Map<string, string>> {
  if (cache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return cache;
  return loadCache();
}

/** Force-invalidate the cache (call after PUT /admin/settings) */
export function invalidateSystemSettingsCache(): void {
  cache = null;
  cacheLoadedAt = 0;
}

// ── Typed getters ─────────────────────────────────────────────────────────────

export async function getSystemSetting(
  key: string,
  defaultValue = "",
): Promise<string> {
  const m = await getCache();
  return m.get(key) ?? defaultValue;
}

export async function getSystemSettingInt(
  key: string,
  defaultValue: number,
): Promise<number> {
  const raw = await getSystemSetting(key, String(defaultValue));
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

export async function getSystemSettingFloat(
  key: string,
  defaultValue: number,
): Promise<number> {
  const raw = await getSystemSetting(key, String(defaultValue));
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : defaultValue;
}

export async function getSystemSettingBool(
  key: string,
  defaultValue: boolean,
): Promise<boolean> {
  const raw = await getSystemSetting(key, defaultValue ? "true" : "false");
  return raw.toLowerCase() === "true";
}

// ── Bulk read (for admin GET endpoint) ───────────────────────────────────────

export async function getAllSystemSettings(): Promise<Record<string, string>> {
  const m = await getCache();
  // Only return keys that are currently recognised — prevents stale DB rows
  // from being loaded into the admin UI and re-submitted on save.
  return Object.fromEntries(
    [...m.entries()].filter(([k]) => k in SYSTEM_SETTING_DEFAULTS),
  );
}

// ── Upsert (for admin PUT endpoint) ──────────────────────────────────────────

export async function upsertSystemSettings(
  updates: Record<string, string>,
): Promise<void> {
  for (const [key, value] of Object.entries(updates)) {
    await db
      .insert(systemSettingsTable)
      .values({ settingKey: key, settingValue: value })
      .onConflictDoUpdate({
        target: systemSettingsTable.settingKey,
        set: { settingValue: value, updatedAt: new Date() },
      });
  }
  invalidateSystemSettingsCache();
  logger.info({ keys: Object.keys(updates) }, "System settings updated");
}
