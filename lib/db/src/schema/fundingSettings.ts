import { pgTable, serial, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fundingSettingsTable = pgTable("funding_settings", {
  id: serial("id").primaryKey(),
  applicationFee: numeric("application_fee", { precision: 10, scale: 2 }).notNull().default("5000"),
  maxFundingAccounts: integer("max_funding_accounts").notNull().default(10),
  fundingEnabled: boolean("funding_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFundingSettingsSchema = createInsertSchema(fundingSettingsTable).omit({ id: true });
export type InsertFundingSettings = z.infer<typeof insertFundingSettingsSchema>;
export type FundingSettings = typeof fundingSettingsTable.$inferSelect;
