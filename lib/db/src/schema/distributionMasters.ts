import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Distribution Masters — intermediate signal-provider accounts that sit between
 * the single Trading Master and large groups of slave accounts.
 *
 * Architecture:
 *   Trading Master → [Trade Replication Engine] → Distribution Masters → Slave groups
 *
 * Each Distribution Master has its own MetaApi account and CopyFactory strategy.
 * The Trade Replication Engine subscribes each Distribution Master to the Trading
 * Master so trades are broadcast automatically.
 */
export const distributionMastersTable = pgTable("distribution_masters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  metaapiAccountId: text("metaapi_account_id"),
  strategyId: text("strategy_id"),             // CopyFactory strategy ID this master provides
  strategyGroupId: integer("strategy_group_id"), // optional FK → strategy_groups.id
  broker: text("broker"),
  server: text("server"),
  /** ONLINE | OFFLINE | MAINTENANCE | DISABLED */
  status: text("status").notNull().default("OFFLINE"),
  capacity: integer("capacity").notNull().default(2000),
  currentLoad: integer("current_load").notNull().default(0),
  priority: integer("priority").notNull().default(0),
  /** Track how long this master has been online (cumulative seconds) */
  uptimeSeconds: integer("uptime_seconds").notNull().default(0),
  lastOnlineAt: timestamp("last_online_at", { withTimezone: true }),
  lastOfflineAt: timestamp("last_offline_at", { withTimezone: true }),
  /** Latency of last MetaApi ping in ms */
  latencyMs: integer("latency_ms"),
  /** Number of failed replication jobs for this master */
  failedReplications: integer("failed_replications").notNull().default(0),
  /** Connection/sync status from MetaApi */
  connectionStatus: text("connection_status"),
  synchronizationStatus: text("synchronization_status"),
  /**
   * Geographic region for latency-aware assignment.
   * Examples: "Africa", "Europe", "Asia", "Middle East", "North America", "South America"
   */
  region: text("region"),
  /** Internal notes for operators */
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("dist_masters_status_idx").on(table.status),
  index("dist_masters_strategy_group_idx").on(table.strategyGroupId),
  index("dist_masters_priority_idx").on(table.priority),
]);

export const insertDistributionMasterSchema = createInsertSchema(distributionMastersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDistributionMaster = z.infer<typeof insertDistributionMasterSchema>;
export type DistributionMaster = typeof distributionMastersTable.$inferSelect;
