/**
 * Analytics Worker
 *
 * Runs every 5 minutes. Collects platform-wide metrics and caches the result
 * in memory for instant reads via GET /api/admin/analytics.
 *
 * Metrics collected:
 *  - Total subscribers / masters / average load / highest / lowest load
 *  - Failed replications / master uptime / health % / replication latency
 *  - VIP vs FREE subscribers, broker distribution, demo/live accounts
 *  - Conversion rate, daily new users, monthly revenue
 */

import { db, subscriptionsTable, distributionMastersTable, masterBindingsTable,
  usersTable, paymentsTable, slaveAccountsTable } from "@workspace/db";
import { eq, sql, and, gte, count, sum } from "drizzle-orm";
import { logger } from "./logger";
import { registerWorker, workerTickStart, workerTickComplete, workerTickFailed } from "./workerRegistry";
import { getReplicationStats } from "./tradeReplication";

export interface PlatformAnalytics {
  collectedAt: string;
  // Subscribers
  totalSubscribers: number;
  activeSubscribers: number;
  freeTrialSubscribers: number;
  vipSubscribers: number;
  // Masters
  totalMasters: number;
  onlineMasters: number;
  offlineMasters: number;
  maintenanceMasters: number;
  averageLoadPercent: number;
  highestLoadPercent: number;
  lowestLoadPercent: number;
  totalCapacity: number;
  totalCurrentLoad: number;
  // Replication
  failedReplications: number;
  totalReplicationAttempts: number;
  replicationSuccessRate: number;
  // Accounts
  totalSlaveAccounts: number;
  demoAccounts: number;
  liveAccounts: number;
  // Users
  totalUsers: number;
  dailyNewUsers: number;
  conversionRate: number;       // (active subs / total users) * 100
  // Revenue
  monthlyRevenue: number;
  // Master health summary
  masterHealthPercent: number;  // (onlineMasters / totalMasters) * 100
  // Broker distribution top-5
  brokerDistribution: { broker: string; count: number }[];
}

// ── In-memory cache ───────────────────────────────────────────────────────────
let cachedAnalytics: PlatformAnalytics | null = null;

export function getCachedAnalytics(): PlatformAnalytics | null {
  return cachedAnalytics;
}

// ── Collect ───────────────────────────────────────────────────────────────────
export async function runAnalyticsTick(): Promise<void> {
  const startedAt = new Date().toISOString();
  workerTickStart("analytics-worker");

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Subscriptions ─────────────────────────────────────────────────────────
    const [totalSubsResult] = await db
      .select({ count: count() })
      .from(subscriptionsTable);

    const [activeSubsResult] = await db
      .select({ count: count() })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.status, "active"));

    const [freeTrialResult] = await db
      .select({ count: count() })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.status, "free_trial"));

    // ── Distribution Masters ──────────────────────────────────────────────────
    const masters = await db.select().from(distributionMastersTable);

    const onlineMasters = masters.filter((m) => m.status === "ONLINE");
    const offlineMasters = masters.filter((m) => m.status === "OFFLINE");
    const maintenanceMasters = masters.filter((m) => m.status === "MAINTENANCE");

    const loadPercents = masters.map((m) => (m.capacity > 0 ? (m.currentLoad / m.capacity) * 100 : 0));
    const avgLoad = loadPercents.length > 0 ? loadPercents.reduce((a, b) => a + b, 0) / loadPercents.length : 0;
    const highLoad = loadPercents.length > 0 ? Math.max(...loadPercents) : 0;
    const lowLoad = loadPercents.length > 0 ? Math.min(...loadPercents) : 0;
    const totalCapacity = masters.reduce((s, m) => s + m.capacity, 0);
    const totalCurrentLoad = masters.reduce((s, m) => s + m.currentLoad, 0);
    const totalFailedReplications = masters.reduce((s, m) => s + m.failedReplications, 0);

    // ── Replication stats ─────────────────────────────────────────────────────
    const repStats = getReplicationStats();
    const successRate = repStats.totalAttempts > 0
      ? Math.round((repStats.totalSucceeded / repStats.totalAttempts) * 100)
      : 100;

    // ── Slave accounts ────────────────────────────────────────────────────────
    const [totalSlavesResult] = await db.select({ count: count() }).from(slaveAccountsTable);

    // MT5 demo accounts typically have logins starting with specific ranges —
    // use the `server` field containing "demo" as a heuristic
    const [demoResult] = await db
      .select({ count: count() })
      .from(slaveAccountsTable)
      .where(sql`lower(${slaveAccountsTable.server}) like '%demo%'`);

    // ── Users ─────────────────────────────────────────────────────────────────
    const [totalUsersResult] = await db.select({ count: count() }).from(usersTable);

    const [dailyNewUsersResult] = await db
      .select({ count: count() })
      .from(usersTable)
      .where(gte(usersTable.createdAt, todayStart));

    const totalUsers = Number(totalUsersResult.count);
    const activeSubCount = Number(activeSubsResult.count);
    const conversionRate = totalUsers > 0 ? Math.round((activeSubCount / totalUsers) * 100) : 0;

    // ── Revenue ───────────────────────────────────────────────────────────────
    const [monthlyRevenueResult] = await db
      .select({ total: sum(paymentsTable.amount) })
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.status, "completed"),
          gte(paymentsTable.createdAt, monthStart),
        ),
      );

    // ── Broker distribution ───────────────────────────────────────────────────
    const brokerRows = await db
      .select({
        broker: slaveAccountsTable.broker,
        count: count(),
      })
      .from(slaveAccountsTable)
      .groupBy(slaveAccountsTable.broker)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    const demoCount = Number(demoResult.count);
    const totalSlaves = Number(totalSlavesResult.count);

    cachedAnalytics = {
      collectedAt: new Date().toISOString(),
      totalSubscribers: Number(totalSubsResult.count),
      activeSubscribers: activeSubCount,
      freeTrialSubscribers: Number(freeTrialResult.count),
      vipSubscribers: activeSubCount, // All paying are "VIP" in current model
      totalMasters: masters.length,
      onlineMasters: onlineMasters.length,
      offlineMasters: offlineMasters.length,
      maintenanceMasters: maintenanceMasters.length,
      averageLoadPercent: Math.round(avgLoad),
      highestLoadPercent: Math.round(highLoad),
      lowestLoadPercent: Math.round(lowLoad),
      totalCapacity,
      totalCurrentLoad,
      failedReplications: totalFailedReplications,
      totalReplicationAttempts: repStats.totalAttempts,
      replicationSuccessRate: successRate,
      totalSlaveAccounts: totalSlaves,
      demoAccounts: demoCount,
      liveAccounts: totalSlaves - demoCount,
      totalUsers,
      dailyNewUsers: Number(dailyNewUsersResult.count),
      conversionRate,
      monthlyRevenue: parseFloat(String(monthlyRevenueResult.total ?? "0")),
      masterHealthPercent: masters.length > 0 ? Math.round((onlineMasters.length / masters.length) * 100) : 0,
      brokerDistribution: brokerRows.map((r) => ({ broker: r.broker, count: Number(r.count) })),
    };

    logger.debug({ collectedAt: cachedAnalytics.collectedAt }, "Analytics worker: metrics collected");
    workerTickComplete("analytics-worker", { startedAt, jobsProcessed: 1, errors: [] });
  } catch (fatalErr) {
    const msg = `Analytics worker fatal error: ${String(fatalErr)}`;
    logger.error({ err: fatalErr }, msg);
    workerTickFailed("analytics-worker", msg, startedAt);
  }
}

export function startAnalyticsWorker(): void {
  registerWorker({
    id: "analytics-worker",
    name: "Platform Analytics",
    description: "Collects platform-wide metrics every 5 minutes — subscriber counts, master health, revenue",
    intervalMs: 5 * 60_000,
    staleThresholdMs: 20 * 60_000,
    restartFn: () => { void runAnalyticsTick(); },
  });

  setInterval(() => { void runAnalyticsTick(); }, 5 * 60_000);

  // Collect immediately on startup
  void runAnalyticsTick();

  logger.info({ intervalMs: 300_000 }, "Analytics worker started (every 5 minutes)");
}
