/**
 * Distribution Master Health Worker
 *
 * Runs every 10 seconds. Pings every Distribution Master via MetaApi and
 * monitors connection, synchronisation, and latency.
 *
 * Rules:
 *  - If a master is ONLINE and MetaApi shows it disconnected for > 60 s →
 *      mark OFFLINE, stop assigning subscribers, notify admin.
 *  - If a master is OFFLINE and MetaApi shows it healthy again →
 *      mark ONLINE, resume assignments.
 *  - MAINTENANCE / DISABLED masters are skipped (admin-controlled).
 */

import cron from "node-cron";
import { db, distributionMastersTable, usersTable } from "@workspace/db";
import { eq, and, inArray, notInArray } from "drizzle-orm";
import { logger } from "./logger";
import { getMetaApiToken, callMetaApi, PROVISIONING_API, mapMetaApiState } from "./metaapi";
import { registerWorker, workerTickStart, workerTickComplete, workerTickFailed } from "./workerRegistry";
import { createNotification } from "./notificationService";
import { enqueueReplication } from "./tradeReplication";

const HEALTH_INTERVAL_MS = 10_000;
const OFFLINE_THRESHOLD_MS = 60_000;

// Track when each master first showed as disconnected (key = distributionMasterId)
const disconnectedSince = new Map<number, Date>();

interface MetaApiAccountInfo {
  state?: string;
  connectionStatus?: string;
  synchronizationStatus?: string;
}

async function pingMaster(
  masterId: number,
  metaapiAccountId: string,
  token: string,
): Promise<{ online: boolean; latencyMs: number; connectionStatus: string; syncStatus: string }> {
  const start = Date.now();
  const result = await callMetaApi<MetaApiAccountInfo>(
    "GET",
    `${PROVISIONING_API}/users/current/accounts/${metaapiAccountId}`,
    token,
  );
  const latencyMs = Date.now() - start;

  if (!result.ok) {
    return { online: false, latencyMs, connectionStatus: "unknown", syncStatus: "unknown" };
  }

  const data = result.data;
  const state = data?.state ?? "";
  const connectionStatus = data?.connectionStatus ?? "";
  const syncStatus = data?.synchronizationStatus ?? "";

  const mapped = mapMetaApiState(state);
  const online = mapped === "connected" || connectionStatus === "CONNECTED";

  return { online, latencyMs, connectionStatus, syncStatus };
}

export async function runHealthTick(): Promise<void> {
  const startedAt = new Date().toISOString();
  workerTickStart("dist-master-health");

  const errors: string[] = [];
  let checked = 0;
  let wentOnline = 0;
  let wentOffline = 0;

  try {
    const token = await getMetaApiToken();
    if (!token) {
      // No token — skip gracefully without marking the worker as failed.
      // Health checks will begin automatically once METAAPI_TOKEN is configured.
      workerTickComplete("dist-master-health", { startedAt, jobsProcessed: 0, errors: [] });
      return;
    }

    // Only check ONLINE and OFFLINE masters (skip MAINTENANCE / DISABLED)
    const masters = await db
      .select()
      .from(distributionMastersTable)
      .where(inArray(distributionMastersTable.status, ["ONLINE", "OFFLINE"]));

    const now = new Date();

    for (const master of masters) {
      if (!master.metaapiAccountId) continue;
      checked++;

      try {
        const { online, latencyMs, connectionStatus, syncStatus } = await pingMaster(
          master.id,
          master.metaapiAccountId,
          token,
        );

        if (online) {
          // Clear disconnection timer
          disconnectedSince.delete(master.id);

          const updates: Partial<typeof master> = {
            latencyMs,
            connectionStatus,
            synchronizationStatus: syncStatus,
            updatedAt: now,
          };

          if (master.status === "OFFLINE") {
            // Just came back online
            updates.status = "ONLINE";
            updates.lastOnlineAt = now;
            wentOnline++;
            logger.info({ masterId: master.id, name: master.name }, "Distribution master back ONLINE");

            // Trigger replication subscription
            enqueueReplication(master.id);
          }

          await db
            .update(distributionMastersTable)
            .set(updates)
            .where(eq(distributionMastersTable.id, master.id));
        } else {
          // Track how long it's been disconnected
          if (!disconnectedSince.has(master.id)) {
            disconnectedSince.set(master.id, now);
          }

          const disconnectedMs = now.getTime() - disconnectedSince.get(master.id)!.getTime();

          await db
            .update(distributionMastersTable)
            .set({ latencyMs, connectionStatus, synchronizationStatus: syncStatus, updatedAt: now })
            .where(eq(distributionMastersTable.id, master.id));

          if (master.status === "ONLINE" && disconnectedMs >= OFFLINE_THRESHOLD_MS) {
            // Mark offline
            await db
              .update(distributionMastersTable)
              .set({ status: "OFFLINE", lastOfflineAt: now, updatedAt: now })
              .where(eq(distributionMastersTable.id, master.id));

            wentOffline++;
            logger.warn(
              { masterId: master.id, name: master.name, disconnectedMs },
              "Distribution master marked OFFLINE after exceeding disconnect threshold",
            );

            // Notify all admin users
            await notifyAdmins(
              `Distribution Master "${master.name}" is OFFLINE`,
              `The distribution master "${master.name}" has been disconnected for over ${Math.round(disconnectedMs / 1000)}s and has been marked OFFLINE. New subscriber assignments have been paused for this master.`,
            );
          }
        }
      } catch (masterErr) {
        const msg = `Health check failed for master #${master.id}: ${String(masterErr)}`;
        errors.push(msg);
        logger.error({ err: masterErr, masterId: master.id }, msg);
      }
    }

    if (checked > 0 || wentOnline > 0 || wentOffline > 0) {
      logger.debug(
        { checked, wentOnline, wentOffline, errors: errors.length },
        "Distribution master health tick complete",
      );
    }

    workerTickComplete("dist-master-health", { startedAt, jobsProcessed: checked, errors });
  } catch (fatalErr) {
    const msg = `Health worker fatal error: ${String(fatalErr)}`;
    logger.error({ err: fatalErr }, msg);
    workerTickFailed("dist-master-health", msg, startedAt);
  }
}

async function notifyAdmins(title: string, message: string): Promise<void> {
  try {
    const admins = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"));

    for (const admin of admins) {
      await createNotification({ userId: admin.id, type: "dist_master_offline", title, message });
    }
  } catch (err) {
    logger.error({ err }, "Failed to notify admins of distribution master offline");
  }
}

export function startDistributionMasterHealthWorker(): void {
  registerWorker({
    id: "dist-master-health",
    name: "Distribution Master Health Monitor",
    description: "Pings every Distribution Master via MetaApi every 10 s — marks OFFLINE after 60 s of disconnect",
    intervalMs: HEALTH_INTERVAL_MS,
    staleThresholdMs: 60_000,
    restartFn: () => { void runHealthTick(); },
  });

  setInterval(() => {
    void runHealthTick();
  }, HEALTH_INTERVAL_MS);

  logger.info({ intervalMs: HEALTH_INTERVAL_MS }, "Distribution master health worker started");
}
