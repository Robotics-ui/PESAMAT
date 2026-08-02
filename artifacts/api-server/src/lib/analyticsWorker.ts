/**
 * Analytics Worker
 *
 * Runs every 5 minutes. Collects platform-wide metrics and caches the result
 * in memory for instant reads via GET /api/admin/analytics.
 */

import { db, subscriptionsTable, distributionMastersTable, masterBindingsTable,
  usersTable, paymentsTable, slaveAccountsTable, tradeAuditLogsTable } from "@workspace/db";
import { eq, sql, and, gte, count, sum } from "drizzle-orm";
import { logger } from "./logger";
import { registerWorker, workerTickStart, workerTickComplete, workerTickFailed } from "./workerRegistry";
import { getReplicationStats } from "./tradeReplication";

export interface PlatformAnalytics {
  collectedAt: string;
  // ── Subscribers ────────────────────────────────────────────────────────────
  totalSubscribers: number;
  activeSubscribers: number;
  freeTrialSubscribers: number;
  /** Alias: all paying subscribers */
  vipSubscribers: number;
  proSubscribers: number;
  totalActiveSubscriptions: number;
  // ── Users ─────────────────────────────────────────────────────────────────
  totalUsers: number;
  newUsersToday: number;
  /** (active subs / total users) * 100 */
  conversionRate: number;
  demoToLiveConversionRate: number;
  // ── Masters ───────────────────────────────────────────────────────────────
  totalMasters: number;
  onlineMasters: number;
  offlineMasters: number;
  maintenanceMasters: number;
  activeMasters: number;
  averageLoadPercent: number;
  highestLoadPercent: number;
  lowestLoadPercent: number;
  totalCapacity: number;
  totalCurrentLoad: number;
  masterUtilizationPercent: number;
  masterHealthPercent: number;
  // ── Replication ───────────────────────────────────────────────────────────
  failedReplications: number;
  totalReplicationAttempts: number;
  replicationSuccessRate: number;
  averageReplicationLatencyMs: number;
  totalCopiedTradesToday: number;
  totalSignalsToday: number;
  // ── Accounts ──────────────────────────────────────────────────────────────
  totalSlaveAccounts: number;
  demoAccounts: number;
  liveAccounts: number;
  // ── Revenue ───────────────────────────────────────────────────────────────
  revenueToday: number;
  monthlyRevenue: number;
  // ── System ────────────────────────────────────────────────────────────────
  systemHealthPercent: number;
  // ── Broker distribution ───────────────────────────────────────────────────
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
    const [
      [totalSubsResult],
      [activeSubsResult],
      [freeTrialResult],
    ] = await Promise.all([
      db.select({ count: count() }).from(subscriptionsTable),
      db.select({ count: count() }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "active")),
      db.select({ count: count() }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "free_trial")),
    ]);

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
    const masterUtilizationPercent = totalCapacity > 0 ? Math.round((totalCurrentLoad / totalCapacity) * 100) : 0;

    // ── Replication stats ─────────────────────────────────────────────────────
    const repStats = getReplicationStats();
    const successRate = repStats.totalAttempts > 0
      ? Math.round((repStats.totalSucceeded / repStats.totalAttempts) * 100)
      : 100;

    // ── Trade audit (today) ───────────────────────────────────────────────────
    let totalCopiedTradesToday = 0;
    let averageReplicationLatencyMs = 0;
    try {
      const [todayTradesResult] = await db
        .select({ count: count() })
        .from(tradeAuditLogsTable)
        .where(and(
          eq(tradeAuditLogsTable.status, "SUCCESS"),
          gte(tradeAuditLogsTable.createdAt, todayStart),
        ));
      totalCopiedTradesToday = Number(todayTradesResult?.count ?? 0);

      const [latencyResult] = await db
        .select({ avg: sql<string>`avg(${tradeAuditLogsTable.replicationLatencyMs})` })
        .from(tradeAuditLogsTable)
        .where(gte(tradeAuditLogsTable.createdAt, new Date(Date.now() - 60 * 60_000))); // last hour
      averageReplicationLatencyMs = Math.round(parseFloat(latencyResult?.avg ?? "0") || 0);
    } catch {
      // table may be empty — non-fatal
    }

    // ── Slave accounts ────────────────────────────────────────────────────────
    const [[totalSlavesResult], [demoResult], [liveResult]] = await Promise.all([
      db.select({ count: count() }).from(slaveAccountsTable),
      db.select({ count: count() }).from(slaveAccountsTable)
        .where(sql`lower(${slaveAccountsTable.server}) like '%demo%'`),
      db.select({ count: count() }).from(slaveAccountsTable)
        .where(sql`lower(${slaveAccountsTable.server}) not like '%demo%'`),
    ]);

    const totalSlaves = Number(totalSlavesResult?.count ?? 0);
    const demoCount = Number(demoResult?.count ?? 0);
    const liveCount = Number(liveResult?.count ?? 0);

    // ── Users ─────────────────────────────────────────────────────────────────
    const [[totalUsersResult], [dailyNewUsersResult]] = await Promise.all([
      db.select({ count: count() }).from(usersTable),
      db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, todayStart)),
    ]);

    const totalUsers = Number(totalUsersResult?.count ?? 0);
    const activeSubCount = Number(activeSubsResult?.count ?? 0);
    const freeTrialCount = Number(freeTrialResult?.count ?? 0);
    const conversionRate = totalUsers > 0 ? Math.round((activeSubCount / totalUsers) * 100) : 0;
    const demoToLiveConversionRate = (demoCount + liveCount) > 0
      ? Math.round((liveCount / (demoCount + liveCount)) * 100)
      : 0;

    // ── Revenue ───────────────────────────────────────────────────────────────
    const [[monthlyRevenueResult], [todayRevenueResult]] = await Promise.all([
      db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable)
        .where(and(eq(paymentsTable.status, "completed"), gte(paymentsTable.createdAt, monthStart))),
      db.select({ total: sum(paymentsTable.amount) }).from(paymentsTable)
        .where(and(eq(paymentsTable.status, "completed"), gte(paymentsTable.createdAt, todayStart))),
    ]);

    // ── Broker distribution ───────────────────────────────────────────────────
    const brokerRows = await db
      .select({ broker: slaveAccountsTable.broker, count: count() })
      .from(slaveAccountsTable)
      .groupBy(slaveAccountsTable.broker)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    // ── System health (composite) ─────────────────────────────────────────────
    const masterHealthPct = masters.length > 0
      ? Math.round((onlineMasters.length / masters.length) * 100)
      : 0;
    const systemHealthPercent = Math.round(
      (masterHealthPct * 0.6 + successRate * 0.4),
    );

    cachedAnalytics = {
      collectedAt: new Date().toISOString(),
      // Subscribers
      totalSubscribers: Number(totalSubsResult?.count ?? 0),
      activeSubscribers: activeSubCount,
      freeTrialSubscribers: freeTrialCount,
      vipSubscribers: activeSubCount,
      proSubscribers: 0, // PRO tier not yet differentiated in subscription status
      totalActiveSubscriptions: activeSubCount + freeTrialCount,
      // Users
      totalUsers,
      newUsersToday: Number(dailyNewUsersResult?.count ?? 0),
      conversionRate,
      demoToLiveConversionRate,
      // Masters
      totalMasters: masters.length,
      onlineMasters: onlineMasters.length,
      offlineMasters: offlineMasters.length,
      maintenanceMasters: maintenanceMasters.length,
      activeMasters: onlineMasters.length,
      averageLoadPercent: Math.round(avgLoad),
      highestLoadPercent: Math.round(highLoad),
      lowestLoadPercent: Math.round(lowLoad),
      totalCapacity,
      totalCurrentLoad,
      masterUtilizationPercent,
      masterHealthPercent: masterHealthPct,
      // Replication
      failedReplications: totalFailedReplications,
      totalReplicationAttempts: repStats.totalAttempts,
      replicationSuccessRate: successRate,
      averageReplicationLatencyMs,
      totalCopiedTradesToday,
      totalSignalsToday: repStats.totalAttempts,
      // Accounts
      totalSlaveAccounts: totalSlaves,
      demoAccounts: demoCount,
      liveAccounts: liveCount,
      // Revenue
      revenueToday: parseFloat(String(todayRevenueResult?.total ?? "0")),
      monthlyRevenue: parseFloat(String(monthlyRevenueResult?.total ?? "0")),
      // System
      systemHealthPercent,
      // Broker
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
    description: "Collects platform-wide metrics every 5 minutes — subscriber counts, master health, revenue, replication stats",
    intervalMs: 5 * 60_000,
    staleThresholdMs: 20 * 60_000,
    restartFn: () => { void runAnalyticsTick(); },
  });

  setInterval(() => { void runAnalyticsTick(); }, 5 * 60_000);
  void runAnalyticsTick();

  logger.info({ intervalMs: 300_000 }, "Analytics worker started (every 5 minutes)");
}
