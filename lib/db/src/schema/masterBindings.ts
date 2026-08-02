import { pgTable, serial, integer, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Master Bindings — maps every subscriber (userId) to exactly one Distribution Master.
 *
 * Assignment is automatic: the Load Balancer Worker picks the least-loaded ONLINE
 * Distribution Master and inserts a record here.
 *
 * When a subscription expires   → status set to "suspended"
 * When a subscription is renewed → status set to "active"
 *
 * This table EXTENDS the existing binding system — it does NOT replace
 * the existing strategy_subscribers (bindingsTable) which manages the actual
 * CopyFactory slave→strategy bindings.
 */
export const masterBindingsTable = pgTable("master_bindings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  distributionMasterId: integer("distribution_master_id").notNull(),
  subscriptionId: integer("subscription_id"),
  /** active | suspended | migrating */
  status: text("status").notNull().default("active"),
  /** When a migration is in progress, this is the target master */
  targetMasterId: integer("target_master_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("master_bindings_user_id_idx").on(table.userId),
  index("master_bindings_master_id_idx").on(table.distributionMasterId),
  index("master_bindings_status_idx").on(table.status),
  index("master_bindings_subscription_id_idx").on(table.subscriptionId),
  // One active binding per user at a time
  unique("master_bindings_user_unique").on(table.userId),
]);

export const insertMasterBindingSchema = createInsertSchema(masterBindingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMasterBinding = z.infer<typeof insertMasterBindingSchema>;
export type MasterBinding = typeof masterBindingsTable.$inferSelect;
