/**
 * System Settings Routes
 *
 * GET  /api/admin/settings  — returns all runtime-configurable settings
 * PUT  /api/admin/settings  — bulk-upserts one or more settings
 * GET  /api/admin/trade-audit — paginated trade audit log with filters
 */

import { Router } from "express";
import { eq, and, gte, lte, sql, count } from "drizzle-orm";
import { db, tradeAuditLogsTable, slaveAccountsTable, distributionMastersTable, masterAccountsTable } from "@workspace/db";
import { authenticate, requireAdmin } from "../middlewares/authenticate";
import {
  getAllSystemSettings,
  upsertSystemSettings,
  SYSTEM_SETTING_DEFAULTS,
} from "../lib/systemSettings";
import { logger } from "../lib/logger";

const router = Router();

// ── GET /api/admin/system-settings ───────────────────────────────────────────
router.get("/admin/system-settings", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  try {
    const settings = await getAllSystemSettings();
    res.json({ settings, defaults: SYSTEM_SETTING_DEFAULTS });
  } catch (err) {
    logger.error({ err }, "Failed to load system settings");
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// ── PUT /api/admin/system-settings ───────────────────────────────────────────
router.put("/admin/system-settings", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;

  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Request body must be a JSON object" });
    return;
  }

  // Only allow known setting keys
  const allowed = new Set(Object.keys(SYSTEM_SETTING_DEFAULTS));
  const updates: Record<string, string> = {};

  for (const [key, value] of Object.entries(body)) {
    if (!allowed.has(key)) {
      res.status(400).json({ error: `Unknown setting key: ${key}` });
      return;
    }
    updates[key] = String(value);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid settings provided" });
    return;
  }

  try {
    await upsertSystemSettings(updates);
    const fresh = await getAllSystemSettings();
    res.json({ ok: true, settings: fresh });
  } catch (err) {
    logger.error({ err }, "Failed to update system settings");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// ── GET /api/admin/trade-audit ───────────────────────────────────────────────
// Query params:
//   page, limit, dateFrom, dateTo,
//   subscriberId, distributionMasterId, tradingMasterId,
//   broker, symbol, status, tradeAction
router.get("/admin/trade-audit", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    if (req.query.dateFrom) {
      const from = new Date(String(req.query.dateFrom));
      if (!isNaN(from.getTime())) {
        conditions.push(gte(tradeAuditLogsTable.createdAt, from) as ReturnType<typeof eq>);
      }
    }
    if (req.query.dateTo) {
      const to = new Date(String(req.query.dateTo));
      if (!isNaN(to.getTime())) {
        conditions.push(lte(tradeAuditLogsTable.createdAt, to) as ReturnType<typeof eq>);
      }
    }
    if (req.query.subscriberId) {
      const id = parseInt(String(req.query.subscriberId), 10);
      if (!isNaN(id)) conditions.push(eq(tradeAuditLogsTable.subscriberId, id) as ReturnType<typeof eq>);
    }
    if (req.query.distributionMasterId) {
      const id = parseInt(String(req.query.distributionMasterId), 10);
      if (!isNaN(id)) conditions.push(eq(tradeAuditLogsTable.distributionMasterId, id) as ReturnType<typeof eq>);
    }
    if (req.query.tradingMasterId) {
      const id = parseInt(String(req.query.tradingMasterId), 10);
      if (!isNaN(id)) conditions.push(eq(tradeAuditLogsTable.tradingMasterId, id) as ReturnType<typeof eq>);
    }
    if (req.query.broker) {
      conditions.push(eq(tradeAuditLogsTable.broker, String(req.query.broker)) as ReturnType<typeof eq>);
    }
    if (req.query.symbol) {
      conditions.push(eq(tradeAuditLogsTable.symbol, String(req.query.symbol)) as ReturnType<typeof eq>);
    }
    if (req.query.status) {
      conditions.push(eq(tradeAuditLogsTable.status, String(req.query.status)) as ReturnType<typeof eq>);
    }
    if (req.query.tradeAction) {
      conditions.push(eq(tradeAuditLogsTable.tradeAction, String(req.query.tradeAction)) as ReturnType<typeof eq>);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [totalResult]] = await Promise.all([
      db
        .select()
        .from(tradeAuditLogsTable)
        .where(where)
        .orderBy(sql`${tradeAuditLogsTable.createdAt} desc`)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(tradeAuditLogsTable)
        .where(where),
    ]);

    res.json({
      data: rows,
      pagination: {
        total: Number(totalResult.count),
        page,
        limit,
        pages: Math.ceil(Number(totalResult.count) / limit),
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to query trade audit logs");
    res.status(500).json({ error: "Failed to query trade audit logs" });
  }
});

// ── POST /api/admin/trade-audit — log a single trade (internal / webhook use) ─
router.post("/admin/trade-audit", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  try {
    const [row] = await db
      .insert(tradeAuditLogsTable)
      .values({
        tradingMasterId: typeof body.tradingMasterId === "number" ? body.tradingMasterId : null,
        distributionMasterId: typeof body.distributionMasterId === "number" ? body.distributionMasterId : null,
        subscriberId: typeof body.subscriberId === "number" ? body.subscriberId : null,
        broker: typeof body.broker === "string" ? body.broker : null,
        accountType: typeof body.accountType === "string" ? body.accountType : null,
        tradeAction: typeof body.tradeAction === "string" ? body.tradeAction : null,
        symbol: typeof body.symbol === "string" ? body.symbol : null,
        entryPrice: typeof body.entryPrice !== "undefined" ? String(body.entryPrice) : null,
        stopLoss: typeof body.stopLoss !== "undefined" ? String(body.stopLoss) : null,
        takeProfit: typeof body.takeProfit !== "undefined" ? String(body.takeProfit) : null,
        executionTime: typeof body.executionTime === "string" ? new Date(body.executionTime) : null,
        replicationLatencyMs: typeof body.replicationLatencyMs === "number" ? body.replicationLatencyMs : null,
        status: typeof body.status === "string" ? body.status : "SUCCESS",
        failureReason: typeof body.failureReason === "string" ? body.failureReason : null,
        ticket: typeof body.ticket === "string" ? body.ticket : null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "Failed to insert trade audit log");
    res.status(500).json({ error: "Failed to log trade" });
  }
});

export default router;
