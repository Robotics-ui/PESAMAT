/**
 * Intelligent Load Balancer Worker
 *
 * Runs every 30 seconds.
 *
 * Responsibilities:
 *  1. Find all active subscribers (active or free_trial) who have no Distribution
 *     Master binding yet.
 *  2. Score every ONLINE Distribution Master using a composite Health Score (0–100):
 *       - Capacity headroom  (40 pts) — higher remaining capacity = more pts
 *       - Latency            (20 pts) — lower latency = more pts
 *       - Online status      (20 pts) — ONLINE = 20, else 0
 *       - Connection health  (10 pts) — MetaApi connectionStatus CONNECTED = 10
 *       - Sync health        (10 pts) — MetaApi synchronizationStatus SYNCHRONIZED = 10
 *  3. Apply bonus scores for broker match (+15) and region match (+10).
 *  4. Assign each unbound subscriber to the highest-scoring master.
 *  5. Never exceed Maximum Capacity − Reserved Capacity to leave headroom for
 *     reconnects and unexpected spikes.  Reserved% comes from system_settings
 *     MASTER_RESERVED_CAPACITY_PERCENT (default 10%).
 */

import { db, distributionMastersTable, masterBindingsTable, subscriptionsTable, slaveAccountsTable, usersTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { registerWorker, workerTickStart, workerTickComplete, workerTickFailed } from "./workerRegistry";
import { getSystemSettingFloat, getSystemSettingBool } from "./systemSettings";

const LOAD_BALANCER_INTERVAL_MS = 30_000;

// ── Health Score Calculator ───────────────────────────────────────────────────

function calculateHealthScore(
  master: typeof distributionMastersTable.$inferSelect,
  reservedPercent: number,
): number {
  if (master.status !== "ONLINE") return 0;

  const maxAssignable = Math.floor(master.capacity * (1 - reservedPercent / 100));
  if (maxAssignable <= 0) return 0;

  const remaining = maxAssignable - master.currentLoad;
  if (remaining <= 0) return 0;

  // Capacity headroom: 0–40 pts
  const capacityScore = Math.round((remaining / maxAssignable) * 40);

  // Latency: 0–20 pts (0 pts at ≥500ms, 20 pts at 0ms)
  const latency = master.latencyMs ?? 999;
  const latencyScore = Math.max(0, Math.round(20 - latency / 25));

  // Online presence: 20 pts
  const onlineScore = 20;

  // MetaApi connection: 0–10 pts
  const connScore = (master.connectionStatus ?? "").toUpperCase() === "CONNECTED" ? 10 : 0;

  // CopyFactory sync: 0–10 pts
  const syncScore = (master.synchronizationStatus ?? "").toUpperCase() === "SYNCHRONIZED" ? 10 : 0;

  return capacityScore + latencyScore + onlineScore + connScore + syncScore;
}

function applyContextBonus(
  baseScore: number,
  master: typeof distributionMastersTable.$inferSelect,
  userBroker: string | null,
  userRegion: string | null,
): number {
  let bonus = 0;
  if (userBroker && master.broker && master.broker.toLowerCase() === userBroker.toLowerCase()) {
    bonus += 15; // Broker match — improves execution quality
  }
  if (userRegion && master.region && master.region.toLowerCase() === userRegion.toLowerCase()) {
    bonus += 10; // Region match — reduces latency
  }
  return baseScore + bonus;
}

// ── Main Tick ─────────────────────────────────────────────────────────────────

export async function runLoadBalancerTick(): Promise<void> {
  const startedAt = new Date().toISOString();
  workerTickStart("load-balancer");

  const errors: string[] = [];
  let assigned = 0;
  let skipped = 0;

  try {
    const [reservedPercent, autoAssign] = await Promise.all([
      getSystemSettingFloat("MASTER_RESERVED_CAPACITY_PERCENT", 10),
      getSystemSettingBool("AUTO_ASSIGN_MASTER", true),
    ]);

    if (!autoAssign) {
      logger.debug("Load balancer: AUTO_ASSIGN_MASTER is disabled — skipping tick");
      workerTickComplete("load-balancer", { startedAt, jobsProcessed: 0, errors });
      return;
    }

    // All ONLINE masters
    const onlineMasters = await db
      .select()
      .from(distributionMastersTable)
      .where(eq(distributionMastersTable.status, "ONLINE"));

    // Filter to assignable masters (have remaining capacity after reservation)
    const assignableMasters = onlineMasters.filter((m) => {
      const maxAssignable = Math.floor(m.capacity * (1 - reservedPercent / 100));
      return m.currentLoad < maxAssignable;
    });

    if (assignableMasters.length === 0) {
      logger.warn("Load balancer: no ONLINE Distribution Masters with assignable capacity");
      workerTickComplete("load-balancer", { startedAt, jobsProcessed: 0, errors });
      return;
    }

    // Pre-score all masters (base scores without user context)
    const scoredMasters = assignableMasters.map((m) => ({
      master: m,
      baseScore: calculateHealthScore(m, reservedPercent),
    }));

    // Find active subscribers without a master binding
    const [activeSubs, freeTrialSubs] = await Promise.all([
      db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, "active")),
      db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, "free_trial")),
    ]);

    const allActiveSubs = [...activeSubs, ...freeTrialSubs];
    if (allActiveSubs.length === 0) {
      workerTickComplete("load-balancer", { startedAt, jobsProcessed: 0, errors });
      return;
    }

    // Get all existing active bindings for these users in one query
    const userIds = allActiveSubs.map((s) => s.userId);
    const existingBindings = await db
      .select({ userId: masterBindingsTable.userId })
      .from(masterBindingsTable)
      .where(
        and(
          inArray(masterBindingsTable.userId, userIds),
          eq(masterBindingsTable.status, "active"),
        ),
      );
    const boundUserIds = new Set(existingBindings.map((b) => b.userId));

    // Get slave account brokers for unbound users (for broker-aware assignment)
    const unboundSubs = allActiveSubs.filter((s) => !boundUserIds.has(s.userId));
    if (unboundSubs.length === 0) {
      workerTickComplete("load-balancer", { startedAt, jobsProcessed: 0, errors });
      return;
    }

    const unboundUserIds = unboundSubs.map((s) => s.userId);
    const slaveAccounts = await db
      .select({
        userId: slaveAccountsTable.userId,
        broker: slaveAccountsTable.broker,
      })
      .from(slaveAccountsTable)
      .where(inArray(slaveAccountsTable.userId, unboundUserIds));

    // Map userId → broker (use first slave account's broker as heuristic)
    const userBrokerMap = new Map<number, string>();
    for (const sa of slaveAccounts) {
      if (!userBrokerMap.has(sa.userId)) userBrokerMap.set(sa.userId, sa.broker);
    }

    // Running load tracker (in-memory for this tick)
    const loadTracker = new Map<number, number>(
      scoredMasters.map(({ master }) => [master.id, master.currentLoad]),
    );

    for (const sub of unboundSubs) {
      try {
        const userBroker = userBrokerMap.get(sub.userId) ?? null;

        // Score with user context (broker/region bonus)
        const best = scoredMasters
          .map(({ master, baseScore }) => {
            const currentLoad = loadTracker.get(master.id) ?? master.currentLoad;
            const maxAssignable = Math.floor(master.capacity * (1 - reservedPercent / 100));
            if (currentLoad >= maxAssignable) return null;
            const score = applyContextBonus(baseScore, master, userBroker, null);
            return { master, score };
          })
          .filter((x): x is { master: typeof distributionMastersTable.$inferSelect; score: number } => x !== null)
          .sort((a, b) => b.score - a.score)[0];

        if (!best) {
          logger.warn({ userId: sub.userId }, "Load balancer: no master with capacity — skipping user");
          skipped++;
          continue;
        }

        // Create the binding
        await db
          .insert(masterBindingsTable)
          .values({
            userId: sub.userId,
            distributionMasterId: best.master.id,
            subscriptionId: sub.id,
            status: "active",
          })
          .onConflictDoNothing();

        // Track load in-memory for this tick
        loadTracker.set(best.master.id, (loadTracker.get(best.master.id) ?? 0) + 1);

        // Persist the incremented load
        await db
          .update(distributionMastersTable)
          .set({
            currentLoad: sql`${distributionMastersTable.currentLoad} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(distributionMastersTable.id, best.master.id));

        assigned++;
        logger.info(
          {
            userId: sub.userId,
            masterId: best.master.id,
            masterName: best.master.name,
            score: best.score,
            userBroker,
            masterBroker: best.master.broker,
          },
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
    name: "Intelligent Load Balancer",
    description:
      "Scores Distribution Masters by health (capacity, latency, connection, sync) and assigns unbound subscribers to the highest-scoring master — runs every 30 s",
    intervalMs: LOAD_BALANCER_INTERVAL_MS,
    staleThresholdMs: 5 * 60_000,
    restartFn: () => { void runLoadBalancerTick(); },
  });

  setInterval(() => { void runLoadBalancerTick(); }, LOAD_BALANCER_INTERVAL_MS);

  logger.info({ intervalMs: LOAD_BALANCER_INTERVAL_MS }, "Intelligent load balancer worker started");
}
