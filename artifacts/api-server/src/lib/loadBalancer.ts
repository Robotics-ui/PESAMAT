/**
 * Load Balancer Worker
 *
 * Runs every 30 seconds.
 *
 * Responsibilities:
 *  1. Find all active subscribers who have no Distribution Master binding yet.
 *  2. Assign each to the least-loaded ONLINE Distribution Master that still has
 *     remaining capacity (capacity - currentLoad > 0).
 *  3. Update currentLoad on the Distribution Master after each assignment.
 *  4. Never exceed a master's capacity.
 */

import cron from "node-cron";
import { db, distributionMastersTable, masterBindingsTable, subscriptionsTable } from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { logger } from "./logger";
import { registerWorker, workerTickStart, workerTickComplete, workerTickFailed } from "./workerRegistry";

const LOAD_BALANCER_INTERVAL = "*/30 * * * * *"; // every 30 seconds (cron with seconds)

export async function runLoadBalancerTick(): Promise<void> {
  const startedAt = new Date().toISOString();
  workerTickStart("load-balancer");

  const errors: string[] = [];
  let assigned = 0;
  let skipped = 0;

  try {
    // Get all ONLINE masters with remaining capacity, ordered by load ratio ASC
    const onlineMasters = await db
      .select()
      .from(distributionMastersTable)
      .where(eq(distributionMastersTable.status, "ONLINE"));

    // Filter to those with remaining capacity and sort by load ratio
    const availableMasters = onlineMasters
      .filter((m) => m.currentLoad < m.capacity)
      .sort((a, b) => a.currentLoad / a.capacity - b.currentLoad / b.capacity);

    if (availableMasters.length === 0) {
      logger.warn("Load balancer: no ONLINE Distribution Masters with available capacity");
      workerTickComplete("load-balancer", { startedAt, jobsProcessed: 0, errors });
      return;
    }

    // Find active subscribers (active or free_trial) who have no master binding
    const activeSubs = await db
      .select()
      .from(subscriptionsTable)
      .where(
        eq(subscriptionsTable.status, "active"),
      );

    const freeTrialSubs = await db
      .select()
      .from(subscriptionsTable)
      .where(
        eq(subscriptionsTable.status, "free_trial"),
      );

    const allActiveSubs = [...activeSubs, ...freeTrialSubs];

    for (const sub of allActiveSubs) {
      try {
        // Check if this user already has an active master binding
        const [existingBinding] = await db
          .select()
          .from(masterBindingsTable)
          .where(
            and(
              eq(masterBindingsTable.userId, sub.userId),
              eq(masterBindingsTable.status, "active"),
            ),
          )
          .limit(1);

        if (existingBinding) {
          skipped++;
          continue; // Already assigned
        }

        // Pick the least-loaded master with remaining capacity
        const master = availableMasters.find((m) => m.currentLoad < m.capacity);
        if (!master) {
          logger.warn({ userId: sub.userId }, "Load balancer: no master with capacity — skipping user");
          skipped++;
          continue;
        }

        // Create the binding
        await db.insert(masterBindingsTable).values({
          userId: sub.userId,
          distributionMasterId: master.id,
          subscriptionId: sub.id,
          status: "active",
        }).onConflictDoNothing();

        // Increment load on this master (in-memory for this tick)
        master.currentLoad++;

        // Persist the new currentLoad
        await db
          .update(distributionMastersTable)
          .set({
            currentLoad: sql`${distributionMastersTable.currentLoad} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(distributionMastersTable.id, master.id));

        assigned++;
        logger.info(
          { userId: sub.userId, masterId: master.id, masterName: master.name, newLoad: master.currentLoad, capacity: master.capacity },
          "Load balancer: subscriber assigned to distribution master",
        );
      } catch (userErr) {
        const msg = `Load balancer: failed to assign user ${sub.userId}: ${String(userErr)}`;
        errors.push(msg);
        logger.error({ err: userErr, userId: sub.userId }, msg);
      }
    }

    if (assigned > 0 || errors.length > 0) {
      logger.info({ assigned, skipped, errors: errors.length }, "Load balancer tick complete");
    }

    workerTickComplete("load-balancer", { startedAt, jobsProcessed: assigned, errors });
  } catch (fatalErr) {
    const msg = `Load balancer fatal error: ${String(fatalErr)}`;
    logger.error({ err: fatalErr }, msg);
    workerTickFailed("load-balancer", msg, startedAt);
  }
}

/**
 * Recalculate currentLoad for all Distribution Masters by counting active bindings.
 * Called at startup to sync the DB counter with actual binding count.
 */
export async function recalculateAllLoads(): Promise<void> {
  try {
    const masters = await db.select().from(distributionMastersTable);
    for (const master of masters) {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(masterBindingsTable)
        .where(
          and(
            eq(masterBindingsTable.distributionMasterId, master.id),
            eq(masterBindingsTable.status, "active"),
          ),
        );

      const actualLoad = result?.count ?? 0;
      if (actualLoad !== master.currentLoad) {
        await db
          .update(distributionMastersTable)
          .set({ currentLoad: actualLoad, updatedAt: new Date() })
          .where(eq(distributionMastersTable.id, master.id));
        logger.info({ masterId: master.id, oldLoad: master.currentLoad, newLoad: actualLoad }, "Load recalculated");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to recalculate distribution master loads");
  }
}

export function startLoadBalancerWorker(): void {
  registerWorker({
    id: "load-balancer",
    name: "Subscriber Load Balancer",
    description: "Assigns active subscribers to least-loaded ONLINE Distribution Masters — runs every 30 s",
    intervalMs: 30_000,
    staleThresholdMs: 5 * 60_000,
    restartFn: () => { void runLoadBalancerTick(); },
  });

  // node-cron doesn't support seconds natively in some versions, use setInterval
  setInterval(() => { void runLoadBalancerTick(); }, 30_000);

  logger.info({ intervalMs: 30_000 }, "Load balancer worker started");
}
