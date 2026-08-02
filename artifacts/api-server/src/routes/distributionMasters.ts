/**
 * Distribution Masters API
 *
 * Admin-only endpoints for managing Distribution Masters, Strategy Groups,
 * Master Bindings, the Rebalancer, and the Analytics summary.
 */

import { Router } from "express";
import { eq, and, sql, count } from "drizzle-orm";
import {
  db,
  distributionMastersTable,
  strategyGroupsTable,
  masterBindingsTable,
  usersTable,
  subscriptionsTable,
} from "@workspace/db";
import { authenticate, requireAdmin } from "../middlewares/authenticate";
import { logger } from "../lib/logger";
import { enqueueReplication, syncAllReplicationSubscriptions, getReplicationStats } from "../lib/tradeReplication";
import { runLoadBalancerTick } from "../lib/loadBalancer";
import { runRebalancerTick, getRebalancerStatus, setAutoRebalance } from "../lib/rebalancer";
import { getCachedAnalytics, runAnalyticsTick } from "../lib/analyticsWorker";

const router = Router();

// All routes require admin authentication
router.use(authenticate, requireAdmin);

// ── Analytics ─────────────────────────────────────────────────────────────────

router.get("/admin/analytics", async (_req, res): Promise<void> => {
  const cached = getCachedAnalytics();
  if (!cached) {
    // Trigger a fresh collection and wait
    await runAnalyticsTick();
    const fresh = getCachedAnalytics();
    res.json(fresh ?? { error: "Analytics not yet available" });
    return;
  }
  res.json(cached);
});

// ── Strategy Groups ───────────────────────────────────────────────────────────

router.get("/admin/strategy-groups", async (_req, res): Promise<void> => {
  const groups = await db.select().from(strategyGroupsTable).orderBy(strategyGroupsTable.name);
  res.json(groups);
});

router.post("/admin/strategy-groups", async (req, res): Promise<void> => {
  const { name, description, status } = req.body as {
    name?: string;
    description?: string;
    status?: string;
  };

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const [group] = await db
    .insert(strategyGroupsTable)
    .values({ name: name.trim(), description: description ?? null, status: status ?? "active" })
    .returning();

  res.status(201).json(group);
});

router.patch("/admin/strategy-groups/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, description, status } = req.body as Record<string, string | undefined>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates["name"] = name.trim();
  if (description !== undefined) updates["description"] = description;
  if (status !== undefined) updates["status"] = status;

  const [updated] = await db
    .update(strategyGroupsTable)
    .set(updates)
    .where(eq(strategyGroupsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Strategy group not found" }); return; }
  res.json(updated);
});

router.delete("/admin/strategy-groups/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(strategyGroupsTable).where(eq(strategyGroupsTable.id, id));
  res.status(204).send();
});

// ── Distribution Masters ──────────────────────────────────────────────────────

router.get("/admin/distribution-masters", async (_req, res): Promise<void> => {
  const masters = await db
    .select()
    .from(distributionMastersTable)
    .orderBy(distributionMastersTable.priority);

  // Attach subscriber count (active bindings) for each master
  const withCounts = await Promise.all(
    masters.map(async (m) => {
      const [result] = await db
        .select({ count: count() })
        .from(masterBindingsTable)
        .where(
          and(
            eq(masterBindingsTable.distributionMasterId, m.id),
            eq(masterBindingsTable.status, "active"),
          ),
        );
      return {
        ...m,
        activeSubscribers: Number(result?.count ?? 0),
        utilizationPercent: m.capacity > 0 ? Math.round((m.currentLoad / m.capacity) * 100) : 0,
      };
    }),
  );

  res.json(withCounts);
});

router.get("/admin/distribution-masters/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [master] = await db
    .select()
    .from(distributionMastersTable)
    .where(eq(distributionMastersTable.id, id))
    .limit(1);

  if (!master) { res.status(404).json({ error: "Distribution master not found" }); return; }

  // Get subscriber details
  const bindings = await db
    .select({
      bindingId: masterBindingsTable.id,
      userId: masterBindingsTable.userId,
      status: masterBindingsTable.status,
      createdAt: masterBindingsTable.createdAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
    })
    .from(masterBindingsTable)
    .leftJoin(usersTable, eq(masterBindingsTable.userId, usersTable.id))
    .where(eq(masterBindingsTable.distributionMasterId, id));

  res.json({
    ...master,
    utilizationPercent: master.capacity > 0 ? Math.round((master.currentLoad / master.capacity) * 100) : 0,
    subscribers: bindings,
  });
});

router.post("/admin/distribution-masters", async (req, res): Promise<void> => {
  const {
    name, metaapiAccountId, strategyId, strategyGroupId,
    broker, server, capacity, priority, status, notes,
  } = req.body as Record<string, unknown>;

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const [created] = await db
    .insert(distributionMastersTable)
    .values({
      name: String(name).trim(),
      metaapiAccountId: metaapiAccountId ? String(metaapiAccountId) : undefined,
      strategyId: strategyId ? String(strategyId) : undefined,
      strategyGroupId: strategyGroupId ? Number(strategyGroupId) : undefined,
      broker: broker ? String(broker) : undefined,
      server: server ? String(server) : undefined,
      capacity: capacity ? Number(capacity) : 2000,
      priority: priority ? Number(priority) : 0,
      status: status ? String(status) : "OFFLINE",
      notes: notes ? String(notes) : undefined,
    })
    .returning();

  logger.info({ masterId: created.id, name: created.name }, "Distribution master created");
  res.status(201).json(created);
});

router.patch("/admin/distribution-masters/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const {
    name, metaapiAccountId, strategyId, strategyGroupId,
    broker, server, capacity, priority, status, notes,
  } = req.body as Record<string, unknown>;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates["name"] = String(name).trim();
  if (metaapiAccountId !== undefined) updates["metaapiAccountId"] = String(metaapiAccountId);
  if (strategyId !== undefined) updates["strategyId"] = String(strategyId);
  if (strategyGroupId !== undefined) updates["strategyGroupId"] = Number(strategyGroupId);
  if (broker !== undefined) updates["broker"] = String(broker);
  if (server !== undefined) updates["server"] = String(server);
  if (capacity !== undefined) updates["capacity"] = Number(capacity);
  if (priority !== undefined) updates["priority"] = Number(priority);
  if (notes !== undefined) updates["notes"] = String(notes);

  // Status transitions
  if (status !== undefined) {
    const newStatus = String(status).toUpperCase();
    if (!["ONLINE", "OFFLINE", "MAINTENANCE", "DISABLED"].includes(newStatus)) {
      res.status(400).json({ error: "status must be ONLINE | OFFLINE | MAINTENANCE | DISABLED" });
      return;
    }
    updates["status"] = newStatus;
    if (newStatus === "ONLINE") updates["lastOnlineAt"] = new Date();
    if (newStatus === "OFFLINE") updates["lastOfflineAt"] = new Date();
  }

  const [updated] = await db
    .update(distributionMastersTable)
    .set(updates)
    .where(eq(distributionMastersTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Distribution master not found" }); return; }

  // If just came online, enqueue replication
  if (String(status).toUpperCase() === "ONLINE") {
    enqueueReplication(id);
  }

  logger.info({ masterId: id, updates }, "Distribution master updated");
  res.json(updated);
});

router.delete("/admin/distribution-masters/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Check for active bindings
  const [bindingCount] = await db
    .select({ count: count() })
    .from(masterBindingsTable)
    .where(
      and(
        eq(masterBindingsTable.distributionMasterId, id),
        eq(masterBindingsTable.status, "active"),
      ),
    );

  if (Number(bindingCount?.count ?? 0) > 0) {
    res.status(409).json({
      error: `Cannot delete — master has ${bindingCount.count} active subscriber(s). Migrate them first.`,
    });
    return;
  }

  await db.delete(distributionMastersTable).where(eq(distributionMastersTable.id, id));
  res.status(204).send();
});

// ── Master Actions ────────────────────────────────────────────────────────────

router.post("/admin/distribution-masters/:id/disable", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [updated] = await db
    .update(distributionMastersTable)
    .set({ status: "DISABLED", updatedAt: new Date() })
    .where(eq(distributionMastersTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ message: "Master disabled", master: updated });
});

router.post("/admin/distribution-masters/:id/maintenance", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [updated] = await db
    .update(distributionMastersTable)
    .set({ status: "MAINTENANCE", updatedAt: new Date() })
    .where(eq(distributionMastersTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ message: "Master set to MAINTENANCE", master: updated });
});

router.post("/admin/distribution-masters/:id/reconnect", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [updated] = await db
    .update(distributionMastersTable)
    .set({ status: "ONLINE", lastOnlineAt: new Date(), updatedAt: new Date() })
    .where(eq(distributionMastersTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  // Enqueue replication subscription
  enqueueReplication(id);

  res.json({ message: "Master set to ONLINE and replication enqueued", master: updated });
});

router.post("/admin/distribution-masters/:id/rebalance", async (_req, res): Promise<void> => {
  // Trigger a rebalance tick immediately
  void runRebalancerTick();
  res.json({ message: "Rebalance tick triggered" });
});

// ── Master Bindings ───────────────────────────────────────────────────────────

router.get("/admin/distribution-masters/:id/subscribers", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const bindings = await db
    .select({
      bindingId: masterBindingsTable.id,
      userId: masterBindingsTable.userId,
      status: masterBindingsTable.status,
      createdAt: masterBindingsTable.createdAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      subscriptionStatus: subscriptionsTable.status,
    })
    .from(masterBindingsTable)
    .leftJoin(usersTable, eq(masterBindingsTable.userId, usersTable.id))
    .leftJoin(subscriptionsTable, eq(masterBindingsTable.subscriptionId, subscriptionsTable.id))
    .where(eq(masterBindingsTable.distributionMasterId, id));

  res.json(bindings);
});

// ── Rebalancer Config ─────────────────────────────────────────────────────────

router.get("/admin/distribution-masters/rebalancer/status", (_req, res): void => {
  res.json(getRebalancerStatus());
});

router.patch("/admin/distribution-masters/rebalancer/config", (req, res): void => {
  const { autoRebalance } = req.body as { autoRebalance?: boolean };
  if (typeof autoRebalance !== "boolean") {
    res.status(400).json({ error: "autoRebalance (boolean) is required" });
    return;
  }
  setAutoRebalance(autoRebalance);
  res.json({ autoRebalance, message: `Auto-rebalance ${autoRebalance ? "enabled" : "disabled"}` });
});

router.post("/admin/distribution-masters/rebalancer/run", (_req, res): void => {
  void runRebalancerTick();
  res.json({ message: "Rebalancer tick triggered" });
});

// ── Load Balancer ─────────────────────────────────────────────────────────────

router.post("/admin/distribution-masters/load-balancer/run", (_req, res): void => {
  void runLoadBalancerTick();
  res.json({ message: "Load balancer tick triggered" });
});

// ── Replication Stats ─────────────────────────────────────────────────────────

router.get("/admin/distribution-masters/replication/stats", (_req, res): void => {
  res.json(getReplicationStats());
});

router.post("/admin/distribution-masters/replication/sync-all", (_req, res): void => {
  void syncAllReplicationSubscriptions();
  res.json({ message: "Replication sync triggered for all ONLINE masters" });
});

export default router;
