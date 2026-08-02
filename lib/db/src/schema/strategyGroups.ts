import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Strategy Groups — logical groupings of Distribution Masters.
 * Examples: "Gold VIP", "Forex VIP", "Indices", "Crypto"
 *
 * Each group can have multiple Distribution Masters assigned to it.
 * When a subscriber is assigned to a group, the Load Balancer picks the
 * least-loaded ONLINE Distribution Master within that group (or any ONLINE
 * master if no group restriction is set on the user's subscription).
 */
export const strategyGroupsTable = pgTable("strategy_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  /** active | inactive */
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("strategy_groups_status_idx").on(table.status),
]);

export const insertStrategyGroupSchema = createInsertSchema(strategyGroupsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStrategyGroup = z.infer<typeof insertStrategyGroupSchema>;
export type StrategyGroup = typeof strategyGroupsTable.$inferSelect;
