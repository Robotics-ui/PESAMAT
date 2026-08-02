import { pgTable, serial, integer, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Trade Audit Journal — immutable log of every copied trade.
 *
 * Populated by the CopyFactory webhook handler whenever a trade is
 * replicated from a Trading Master to a subscriber account.
 */
export const tradeAuditLogsTable = pgTable("trade_audit_logs", {
  id: serial("id").primaryKey(),
  /** FK → master_accounts.id (the source Trading Master) */
  tradingMasterId: integer("trading_master_id"),
  /** FK → distribution_masters.id (the Distribution Master that relayed the signal) */
  distributionMasterId: integer("distribution_master_id"),
  /** FK → slave_accounts.id (the subscriber account) */
  subscriberId: integer("subscriber_id"),
  broker: text("broker"),
  /** "DEMO" | "LIVE" */
  accountType: text("account_type"),
  /** "OPEN" | "CLOSE" | "MODIFY" */
  tradeAction: text("trade_action"),
  symbol: text("symbol"),
  entryPrice: numeric("entry_price", { precision: 20, scale: 8 }),
  stopLoss: numeric("stop_loss", { precision: 20, scale: 8 }),
  takeProfit: numeric("take_profit", { precision: 20, scale: 8 }),
  /** Wall-clock time when the trade was executed on the subscriber account */
  executionTime: timestamp("execution_time", { withTimezone: true }),
  /** Milliseconds between signal emission and subscriber fill */
  replicationLatencyMs: integer("replication_latency_ms"),
  /** "SUCCESS" | "FAILED" | "PARTIAL" */
  status: text("status").notNull().default("SUCCESS"),
  failureReason: text("failure_reason"),
  /** Raw CopyFactory trade ticket on subscriber account */
  ticket: text("ticket"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("trade_audit_created_idx").on(table.createdAt),
  index("trade_audit_subscriber_idx").on(table.subscriberId),
  index("trade_audit_dist_master_idx").on(table.distributionMasterId),
  index("trade_audit_trading_master_idx").on(table.tradingMasterId),
  index("trade_audit_symbol_idx").on(table.symbol),
  index("trade_audit_status_idx").on(table.status),
  index("trade_audit_broker_idx").on(table.broker),
]);

export const insertTradeAuditLogSchema = createInsertSchema(tradeAuditLogsTable).omit({ id: true, createdAt: true });
export type InsertTradeAuditLog = z.infer<typeof insertTradeAuditLogSchema>;
export type TradeAuditLog = typeof tradeAuditLogsTable.$inferSelect;
