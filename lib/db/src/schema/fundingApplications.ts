import { pgTable, serial, integer, text, numeric, timestamp, index } from "drizzle-orm/pg-core";

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Status flow: pending_payment → verification_pending → under_review → approved | rejected → funded
export const FUNDING_APPLICATION_STATUSES = [
  "pending_payment",
  "verification_pending",
  "under_review",
  "approved",
  "rejected",
  "funded",
] as const;

export type FundingApplicationStatus = (typeof FUNDING_APPLICATION_STATUSES)[number];

export const fundingApplicationsTable = pgTable("funding_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  country: text("country").notNull(),
  tradingExperience: text("trading_experience").notNull(),
  brokerName: text("broker_name"),
  mt5AccountNumber: text("mt5_account_number"),
  accountType: text("account_type").notNull().default("Live"), // Demo | Live
  tradingStrategy: text("trading_strategy").notNull(),
  additionalNotes: text("additional_notes"),
  applicationFee: numeric("application_fee", { precision: 10, scale: 2 }).notNull(),
  checkoutRequestId: text("checkout_request_id"),
  mpesaReceipt: text("mpesa_receipt"),
  paymentStatus: text("payment_status").notNull().default("pending"), // pending | completed | failed
  status: text("status").notNull().default("pending_payment"),
  mt5Server: text("mt5_server"),
  investorPasswordEncrypted: text("investor_password_encrypted"),
  mt5VerificationStatus: text("mt5_verification_status").notNull().default("pending"), // pending | verified | failed
  mt5VerificationDate: timestamp("mt5_verification_date", { withTimezone: true }),
  mt5VerificationResult: text("mt5_verification_result"),
  mt5VerificationAttempts: integer("mt5_verification_attempts").notNull().default(0),
  metaapiVerificationAccountId: text("metaapi_verification_account_id"),
  metaapiVerificationRegion: text("metaapi_verification_region"),
  adminNotes: text("admin_notes"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: integer("reviewed_by"),
  // Funded account activation: tracks when a funded application was converted to a slave account
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  linkedSlaveAccountId: integer("linked_slave_account_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("funding_applications_user_id_idx").on(table.userId),
  index("funding_applications_status_idx").on(table.status),
  index("funding_applications_email_idx").on(table.email),
]);

export const insertFundingApplicationSchema = createInsertSchema(fundingApplicationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFundingApplication = z.infer<typeof insertFundingApplicationSchema>;
export type FundingApplication = typeof fundingApplicationsTable.$inferSelect;
