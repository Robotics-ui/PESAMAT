import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * System Settings — runtime-configurable key-value store.
 *
 * All platform business rules that would otherwise be hardcoded live here
 * so that administrators can change them from the Admin Settings page
 * without any code deployment.
 *
 * Default values are defined in lib/systemSettings.ts on the API server
 * so the system works even before any rows are inserted.
 *
 * Keys (canonical names):
 *   FREE_TRIAL_DAYS                — integer, trial duration in days
 *   TRIAL_ENABLED                  — "true" | "false"
 *   PHONE_VERIFICATION_REQUIRED    — "true" | "false"
 *   AUTO_ASSIGN_MASTER             — "true" | "false"
 *   AUTO_BIND_AFTER_VERIFICATION   — "true" | "false"
 *   VIP_MONTHLY_PRICE              — numeric string (KES)
 *   PRO_MONTHLY_PRICE              — numeric string (KES)
 *   MAX_USERS_PER_MASTER           — integer
 *   MASTER_RESERVED_CAPACITY_PERCENT — integer 0–100
 *   AUTO_REBALANCE                 — "true" | "false"
 */
export const systemSettingsTable = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull(),
  settingValue: text("setting_value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("system_settings_key_idx").on(table.settingKey),
]);

export const insertSystemSettingSchema = createInsertSchema(systemSettingsTable).omit({ id: true });
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettingsTable.$inferSelect;
