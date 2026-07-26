import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const fundingVerificationAttemptsTable = pgTable("funding_verification_attempts", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
  userId: integer("user_id").notNull(),
  brokerName: text("broker_name").notNull(),
  mt5AccountNumber: text("mt5_account_number").notNull(),
  mt5Server: text("mt5_server").notNull(),
  resultStatus: text("result_status").notNull(), // verified | failed
  result: text("result").notNull(),
  metaapiAccountId: text("metaapi_account_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("funding_verification_attempts_application_id_idx").on(table.applicationId),
  index("funding_verification_attempts_user_id_idx").on(table.userId),
]);

export type FundingVerificationAttempt = typeof fundingVerificationAttemptsTable.$inferSelect;