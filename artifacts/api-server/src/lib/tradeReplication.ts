/**
 * Trade Replication Engine
 *
 * Manages CopyFactory subscriptions that link every ONLINE Distribution Master
 * to the Trading Master's strategy.  When the Trading Master opens, modifies,
 * or closes a trade, CopyFactory automatically mirrors it on every Distribution
 * Master — which then copies it on to its own slave subscriber group.
 *
 * Responsibilities:
 *  - For every ONLINE Distribution Master: ensure it is subscribed to the
 *    Trading Master's CopyFactory strategy.
 *  - Re-subscribe on failure with exponential backoff (via RetryQueue).
 *  - Track failed / successful replications for the analytics worker.
 *  - Never block the API — all work is fire-and-forget / queued.
 */

import { db, distributionMastersTable, masterAccountsTable, strategiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import { RetryQueue } from "./retryQueue";
import { copyfactoryFetch, getMetaApiToken, callMetaApi, PROVISIONING_API, getCopyFactoryApiBase } from "./metaapi";

// ── In-memory stats (read by analytics worker) ────────────────────────────────
interface ReplicationStats {
  totalAttempts: number;
  totalSucceeded: number;
  totalFailed: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

const stats: ReplicationStats = {
  totalAttempts: 0,
  totalSucceeded: 0,
  totalFailed: 0,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
};

export function getReplicationStats(): ReplicationStats {
  return { ...stats };
}

// ── Replication job payload ───────────────────────────────────────────────────
interface ReplicationJob {
  distributionMasterId: number;
  distributionMasterMetaApiId: string;
  tradingStrategyId: string;     // CopyFactory strategy ID of the Trading Master
  region: string;
}

// ── RetryQueue — one queue for all replication subscriptions ─────────────────
const replicationQueue = new RetryQueue<ReplicationJob>(
  "trade-replication",
  async (job) => {
    const token = await getMetaApiToken();
    if (!token) {
      throw new Error("METAAPI_TOKEN not configured — skipping replication");
    }

    const base = getCopyFactoryApiBase(job.region);

    // Build or update the CopyFactory subscriber configuration for this
    // Distribution Master so it subscribes to the Trading Master's strategy.
    const subscriptionBody = {
      subscriptions: [
        {
          strategyId: job.tradingStrategyId,
          multiplier: 1,
          skipPendingOrders: false,
          maxTradeRisk: 0.1,
        },
      ],
    };

    const url = `${base}/users/current/configuration/subscribers/${job.distributionMasterMetaApiId}`;
    const result = await copyfactoryFetch<unknown>("PUT", url, token, subscriptionBody);

    stats.totalAttempts++;
    stats.lastAttemptAt = new Date().toISOString();

    if (!result.ok) {
      stats.totalFailed++;
      stats.lastError = `HTTP ${result.status} for dist master ${job.distributionMasterId}`;

      // Increment failed replication counter in DB
      await db
        .update(distributionMastersTable)
        .set({
          failedReplications: db
            .select({ v: distributionMastersTable.failedReplications })
            .from(distributionMastersTable)
            .where(eq(distributionMastersTable.id, job.distributionMasterId))
            .limit(1)
            .then((r) => (r[0]?.v ?? 0) + 1) as unknown as number,
        })
        .where(eq(distributionMastersTable.id, job.distributionMasterId));

      throw new Error(`CopyFactory subscription PUT failed: HTTP ${result.status}`);
    }

    stats.totalSucceeded++;
    stats.lastSuccessAt = new Date().toISOString();
    logger.info(
      { distributionMasterId: job.distributionMasterId, strategyId: job.tradingStrategyId },
      "Trade replication: Distribution Master subscribed to Trading Master strategy",
    );
  },
  { baseDelayMs: 2000 },
);

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Enqueue a replication subscription job for a single Distribution Master.
 * Safe to call multiple times — the queue deduplicates by job ID.
 */
export function enqueueReplication(distributionMasterId: number): void {
  void resolveAndEnqueue(distributionMasterId);
}

async function resolveAndEnqueue(distributionMasterId: number): Promise<void> {
  try {
    // Fetch the distribution master
    const [dm] = await db
      .select()
      .from(distributionMastersTable)
      .where(eq(distributionMastersTable.id, distributionMasterId))
      .limit(1);

    if (!dm || dm.status !== "ONLINE") {
      logger.debug({ distributionMasterId }, "Replication skipped — master not ONLINE");
      return;
    }

    if (!dm.metaapiAccountId) {
      logger.warn({ distributionMasterId }, "Replication skipped — no MetaApi account ID");
      return;
    }

    // Find the active Trading Master strategy
    const tradingMaster = await getActiveTradingMasterStrategy();
    if (!tradingMaster) {
      logger.warn("Replication skipped — no active Trading Master strategy found");
      return;
    }

    replicationQueue.enqueue(
      `replicate:${distributionMasterId}:${tradingMaster.strategyId}`,
      `Subscribe dist master #${distributionMasterId} to trading strategy`,
      {
        distributionMasterId,
        distributionMasterMetaApiId: dm.metaapiAccountId,
        tradingStrategyId: tradingMaster.strategyId,
        region: tradingMaster.region ?? "london",
      },
      5, // maxAttempts
    );
  } catch (err) {
    logger.error({ err, distributionMasterId }, "Failed to enqueue replication job");
  }
}

interface TradingMasterStrategy {
  strategyId: string;
  region: string | null;
}

async function getActiveTradingMasterStrategy(): Promise<TradingMasterStrategy | null> {
  // Find master accounts that are connected (active trading masters)
  const masterAccounts = await db
    .select()
    .from(masterAccountsTable)
    .where(eq(masterAccountsTable.status, "active"))
    .limit(10);

  for (const ma of masterAccounts) {
    // Find its strategy
    const [strategy] = await db
      .select()
      .from(strategiesTable)
      .where(
        and(
          eq(strategiesTable.masterAccountId, ma.id),
          eq(strategiesTable.status, "active"),
        ),
      )
      .limit(1);

    if (strategy?.copyfactoryStrategyId) {
      return {
        strategyId: strategy.copyfactoryStrategyId,
        region: ma.metaapiRegion,
      };
    }
  }

  return null;
}

/**
 * Sync replication subscriptions for ALL ONLINE Distribution Masters.
 * Called at startup and when a new master comes ONLINE.
 */
export async function syncAllReplicationSubscriptions(): Promise<void> {
  try {
    const onlineMasters = await db
      .select()
      .from(distributionMastersTable)
      .where(eq(distributionMastersTable.status, "ONLINE"));

    logger.info(
      { count: onlineMasters.length },
      "Trade replication: syncing subscriptions for all ONLINE distribution masters",
    );

    for (const dm of onlineMasters) {
      enqueueReplication(dm.id);
    }
  } catch (err) {
    logger.error({ err }, "Trade replication: failed to sync all subscriptions");
  }
}
