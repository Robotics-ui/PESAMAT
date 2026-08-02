/**
 * Rebalancer Worker
 *
 * Runs every hour. Checks utilisation across all Distribution Masters and
 * performs or suggests controlled migration of subscribers from overloaded
 * masters to underutilised masters.
 *
 * Rules:
 *  - "Overloaded" = utilisation > 90% of capacity
 *  - "Underutilised" = utilisation < 50% of capacity
 *  - Migration is only performed when autoRebalance = true (default: false)
 *  - Active trades are never interrupted — we only migrate the binding record;
 *    CopyFactory continues to serve existing trade positions until they close.
 *  - Subscription status is preserved through migration.
 *  - Each rebalance cycle migrates at most BATCH_SIZE subscribers per overloaded master
 *    to avoid thundering-herd effects.
 */

import { db, distributionMastersTable, masterBindingsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "./logger";
import { registerWorker, workerTickStart, workerTickComplete, workerTickFailed } from "./workerRegistry";
import { createNotification } from "./notificationService";

const OVERLOAD_THRESHOLD = 0.90;   // > 90% capacity
const UNDERUTIL_THRESHOLD = 0.50;  // < 50% capacity
const BATCH_SIZE = 50;             // max migrations per overloaded master per cycle

// Global toggle — can be flipped via PATCH /api/admin/distribution-masters/rebalancer/config
let autoRebalanceEnabled = false;

export function setAutoRebalance(enabled: boolean): void {
  autoRebalanceEnabled = enabled;
  logger.info({ enabled }, "Rebalancer: autoRebalance toggled");
}

export function getAutoRebalanceStatus(): boolean {
  return autoRebalanceEnabled;
}

export interface RebalanceSuggestion {
  fromMasterId: number;
  fromMasterName: string;
  toMasterId: number;
  toMasterName: string;
  suggestedMigrations: number;
  reason: string;
}

// Store last suggestions for GET /api/admin/distribution-masters/rebalancer/status
let lastSuggestions: RebalanceSuggestion[] = [];
let lastRunAt: string | null = null;

export function getRebalancerStatus() {
  return { lastRunAt, autoRebalanceEnabled, lastSuggestions };
}

export async function runRebalancerTick(): Promise<void> {
  const startedAt = new Date().toISOString();
  lastRunAt = startedAt;
  workerTickStart("rebalancer");

  const errors: string[] = [];
  let migrated = 0;
  const suggestions: RebalanceSuggestion[] = [];

  try {
    const masters = await db
      .select()
      .from(distributionMastersTable)
      .where(eq(distributionMastersTable.status, "ONLINE"));

    if (masters.length < 2) {
      // Nothing to rebalance with fewer than 2 masters
      workerTickComplete("rebalancer", { startedAt, jobsProcessed: 0, errors });
      return;
    }

    const overloaded = masters.filter((m) => m.capacity > 0 && m.currentLoad / m.capacity > OVERLOAD_THRESHOLD);
    const underutil = masters.filter((m) => m.capacity > 0 && m.currentLoad / m.capacity < UNDERUTIL_THRESHOLD);

    for (const fromMaster of overloaded) {
      const availableTarget = underutil.find(
        (m) => m.id !== fromMaster.id && m.currentLoad < m.capacity,
      );
      if (!availableTarget) continue;

      const fromUtil = Math.round((fromMaster.currentLoad / fromMaster.capacity) * 100);
      const toUtil = Math.round((availableTarget.currentLoad / availableTarget.capacity) * 100);
      const canMigrate = Math.min(
        BATCH_SIZE,
        fromMaster.currentLoad - Math.floor(fromMaster.capacity * 0.75),
        availableTarget.capacity - availableTarget.currentLoad,
      );

      if (canMigrate <= 0) continue;

      const suggestion: RebalanceSuggestion = {
        fromMasterId: fromMaster.id,
        fromMasterName: fromMaster.name,
        toMasterId: availableTarget.id,
        toMasterName: availableTarget.name,
        suggestedMigrations: canMigrate,
        reason: `Master "${fromMaster.name}" is at ${fromUtil}% capacity; "${availableTarget.name}" is at ${toUtil}%`,
      };
      suggestions.push(suggestion);

      logger.info(suggestion, "Rebalancer: migration suggested");

      if (autoRebalanceEnabled) {
        // Fetch the subscribers to migrate (pick the most recently added ones)
        const bindingsToMigrate = await db
          .select()
          .from(masterBindingsTable)
          .where(
            and(
              eq(masterBindingsTable.distributionMasterId, fromMaster.id),
              eq(masterBindingsTable.status, "active"),
            ),
          )
          .orderBy(sql`${masterBindingsTable.createdAt} DESC`)
          .limit(canMigrate);

        for (const binding of bindingsToMigrate) {
          try {
            await db
              .update(masterBindingsTable)
              .set({
                distributionMasterId: availableTarget.id,
                status: "active",
                updatedAt: new Date(),
              })
              .where(eq(masterBindingsTable.id, binding.id));

            migrated++;

            // Update load counters
            await db
              .update(distributionMastersTable)
              .set({ currentLoad: sql`${distributionMastersTable.currentLoad} - 1`, updatedAt: new Date() })
              .where(eq(distributionMastersTable.id, fromMaster.id));

            await db
              .update(distributionMastersTable)
              .set({ currentLoad: sql`${distributionMastersTable.currentLoad} + 1`, updatedAt: new Date() })
              .where(eq(distributionMastersTable.id, availableTarget.id));

          } catch (migErr) {
            const msg = `Migration failed for binding ${binding.id}: ${String(migErr)}`;
            errors.push(msg);
            logger.error({ err: migErr, bindingId: binding.id }, msg);
          }
        }

        if (migrated > 0) {
          logger.info(
            { fromMasterId: fromMaster.id, toMasterId: availableTarget.id, migrated },
            "Rebalancer: migration complete",
          );

          // Notify admins
          await notifyAdminsRebalanced(fromMaster.name, availableTarget.name, migrated);
        }
      }
    }

    lastSuggestions = suggestions;
    workerTickComplete("rebalancer", { startedAt, jobsProcessed: migrated, errors });

    if (suggestions.length > 0 && !autoRebalanceEnabled) {
      logger.info(
        { suggestions: suggestions.length },
        "Rebalancer: suggestions generated (autoRebalance is OFF — no migrations performed)",
      );
    }
  } catch (fatalErr) {
    const msg = `Rebalancer fatal error: ${String(fatalErr)}`;
    logger.error({ err: fatalErr }, msg);
    workerTickFailed("rebalancer", msg, startedAt);
  }
}

async function notifyAdminsRebalanced(
  fromName: string,
  toName: string,
  count: number,
): Promise<void> {
  try {
    const admins = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"));

    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: "rebalancer_migration",
        title: "Subscriber Migration Complete",
        message: `Rebalancer migrated ${count} subscriber(s) from "${fromName}" to "${toName}".`,
      });
    }
  } catch (err) {
    logger.error({ err }, "Failed to notify admins of rebalancer migration");
  }
}

export function startRebalancerWorker(): void {
  registerWorker({
    id: "rebalancer",
    name: "Subscriber Rebalancer",
    description: "Checks master utilisation hourly and migrates subscribers from overloaded to underutilised masters",
    intervalMs: 60 * 60_000,
    staleThresholdMs: 3 * 60 * 60_000,
    restartFn: () => { void runRebalancerTick(); },
  });

  // Run every hour
  setInterval(() => { void runRebalancerTick(); }, 60 * 60_000);

  logger.info({ intervalMs: 3600_000 }, "Rebalancer worker started (hourly)");
}
