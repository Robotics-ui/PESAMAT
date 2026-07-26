import { Router } from "express";
import { eq, desc, and, or, ilike, count, sum, ne } from "drizzle-orm";
import { db, fundingSettingsTable, fundingApplicationsTable, usersTable, slaveAccountsTable, paymentsTable } from "@workspace/db";
import { authenticate, requireAdmin } from "../middlewares/authenticate";
import { logger } from "../lib/logger";
import { encryptCredential } from "../lib/auth";

const PLATFORM_CAPACITY = 2000;
import {
  notifyFundingPaymentReceived,
  notifyFundingApplicationApproved,
  notifyFundingApplicationRejected,
  notifyFundingApplicationFunded,
} from "../lib/smsNotifier";

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getFundingSettings() {
  const [s] = await db.select().from(fundingSettingsTable).orderBy(fundingSettingsTable.id).limit(1);
  return s;
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/\s+/g, "").replace(/^\+/, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  else if (/^[71]/.test(p) && p.length === 9) p = "254" + p;
  return p;
}

async function initiateStk(
  phone: string,
  amount: number,
  accountRef: string,
  desc: string
): Promise<{ checkoutRequestId: string; demo: boolean } | { error: string }> {
  const consumerKey = process.env.MPESA_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET?.trim();
  const passkey = process.env.MPESA_PASSKEY?.trim();
  const shortcode = process.env.MPESA_SHORTCODE?.trim();
  const callbackUrl = process.env.MPESA_CALLBACK_URL?.trim();

  if (!consumerKey || !consumerSecret || !passkey || !shortcode || !callbackUrl) {
    return { checkoutRequestId: `DEMO-FUNDING-${Date.now()}`, demo: true };
  }

  try {
    const authRes = await fetch(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}`,
        },
      }
    );
    const authData = (await authRes.json()) as { access_token?: string };
    if (!authData.access_token) return { error: "Failed to obtain M-Pesa access token" };

    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

    const stkRes = await fetch("https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: { Authorization: `Bearer ${authData.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.ceil(amount),
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: accountRef,
        TransactionDesc: desc,
      }),
    });
    const stkData = (await stkRes.json()) as { CheckoutRequestID?: string; errorMessage?: string; ResponseDescription?: string };
    if (!stkData.CheckoutRequestID) {
      return { error: stkData.errorMessage ?? stkData.ResponseDescription ?? "STK Push failed" };
    }
    return { checkoutRequestId: stkData.CheckoutRequestID, demo: false };
  } catch (err) {
    logger.error({ err }, "Funding STK Push error");
    return { error: "Payment initiation failed" };
  }
}

// ─── Public ──────────────────────────────────────────────────────────────────

router.get("/funding/settings", async (_req, res): Promise<void> => {
  const s = await getFundingSettings();
  if (!s) { res.json({ applicationFee: 5000, maxFundingAccounts: 10, fundingEnabled: false, availableSlots: 0, approvedOrFundedCount: 0 }); return; }

  const [{ total }] = await db
    .select({ total: count() })
    .from(fundingApplicationsTable)
    .where(ne(fundingApplicationsTable.status, "rejected"));

  // Slots are occupied by approved + funded applications
  const [{ approvedOrFunded }] = await db
    .select({ approvedOrFunded: count() })
    .from(fundingApplicationsTable)
    .where(
      or(
        eq(fundingApplicationsTable.status, "approved"),
        eq(fundingApplicationsTable.status, "funded")
      )
    );

  const approvedOrFundedCount = Number(approvedOrFunded ?? 0);
  const activeApplications = Number(total ?? 0);
  const availableSlots = Math.max(0, s.maxFundingAccounts - approvedOrFundedCount);

  res.json({
    applicationFee: parseFloat(String(s.applicationFee)),
    maxFundingAccounts: s.maxFundingAccounts,
    fundingEnabled: s.fundingEnabled,
    availableSlots,
    activeApplications,
    approvedOrFundedCount,
  });
});

// ─── User routes ─────────────────────────────────────────────────────────────

router.get("/funding/applications/my", authenticate, async (req, res): Promise<void> => {
  const apps = await db
    .select()
    .from(fundingApplicationsTable)
    .where(eq(fundingApplicationsTable.userId, req.userId!))
    .orderBy(desc(fundingApplicationsTable.createdAt));

  res.json(
    apps.map((a) => ({ ...a, applicationFee: parseFloat(String(a.applicationFee)) }))
  );
});

router.post("/funding/apply", authenticate, async (req, res): Promise<void> => {
  const { fullName, email, phone, country, tradingExperience, brokerName, mt5AccountNumber, accountType, tradingStrategy, additionalNotes } = req.body as Record<string, string>;

  if (!fullName || !email || !phone || !country || !tradingExperience || !brokerName || !accountType || !tradingStrategy) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const s = await getFundingSettings();
  if (!s) { res.status(503).json({ error: "Funding settings not configured" }); return; }
  if (!s.fundingEnabled) { res.status(400).json({ error: "Funding applications are currently disabled" }); return; }

  // Check available slots — approved + funded both occupy a slot
  const [{ occupiedCount }] = await db
    .select({ occupiedCount: count() })
    .from(fundingApplicationsTable)
    .where(
      or(
        eq(fundingApplicationsTable.status, "approved"),
        eq(fundingApplicationsTable.status, "funded")
      )
    );
  if (Number(occupiedCount) >= s.maxFundingAccounts) {
    res.status(400).json({ error: "Funding applications are currently closed because all available funding slots have been filled." });
    return;
  }

  // Prevent duplicate active applications (same email or phone)
  const [existing] = await db
    .select({ id: fundingApplicationsTable.id })
    .from(fundingApplicationsTable)
    .where(
      and(
        or(
          eq(fundingApplicationsTable.email, email.toLowerCase()),
          eq(fundingApplicationsTable.phone, normalizePhone(phone))
        ),
        or(
          eq(fundingApplicationsTable.status, "pending_payment"),
          eq(fundingApplicationsTable.status, "submitted"),
          eq(fundingApplicationsTable.status, "under_review"),
          eq(fundingApplicationsTable.status, "approved")
        )
      )
    )
    .limit(1);

  if (existing) {
    res.status(400).json({ error: "An active application already exists for this email or phone number" });
    return;
  }

  const fee = parseFloat(String(s.applicationFee));
  const normalizedPhone = normalizePhone(phone);

  // Create application
  const [app] = await db
    .insert(fundingApplicationsTable)
    .values({
      userId: req.userId!,
      fullName,
      email: email.toLowerCase(),
      phone: normalizedPhone,
      country,
      tradingExperience,
      brokerName,
      mt5AccountNumber: mt5AccountNumber || null,
      accountType,
      tradingStrategy,
      additionalNotes: additionalNotes || null,
      applicationFee: fee.toFixed(2),
      status: "pending_payment",
      paymentStatus: "pending",
    })
    .returning();

  // Initiate STK push
  const stkResult = await initiateStk(
    normalizedPhone,
    fee,
    "PESAMATRIX-FUNDING",
    "Account Funding Application Fee"
  );

  if ("error" in stkResult) {
    await db.delete(fundingApplicationsTable).where(eq(fundingApplicationsTable.id, app.id));
    res.status(500).json({ error: stkResult.error });
    return;
  }

  if (stkResult.demo) {
    // Demo mode: immediately mark as submitted
    const demoReceipt = `DEMO${Date.now()}`;
    const [updated] = await db
      .update(fundingApplicationsTable)
      .set({
        checkoutRequestId: stkResult.checkoutRequestId,
        mpesaReceipt: demoReceipt,
        paymentStatus: "completed",
        status: "submitted",
      })
      .where(eq(fundingApplicationsTable.id, app.id))
      .returning();

    // Record in payments table for audit trail
    await db.insert(paymentsTable).values({
      userId: req.userId!,
      phone: normalizedPhone,
      amount: fee.toFixed(2),
      status: "completed",
      days: 0,
      mpesaReceipt: demoReceipt,
      checkoutRequestId: `funding-${stkResult.checkoutRequestId}`,
    }).onConflictDoNothing();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (user?.phone) {
      notifyFundingPaymentReceived({
        userId: req.userId!,
        phone: user.phone,
        name: user.name,
        amount: fee.toFixed(2),
        receipt: demoReceipt,
        appId: String(app.id),
      });
    }

    // Notify admin of new application
    const [adminUser] = await db.select().from(usersTable).where(eq(usersTable.role, "admin")).limit(1);
    if (adminUser?.phone && adminUser.phone !== "254700000000") {
      logger.info({ adminPhone: adminUser.phone, appId: app.id }, "Notifying admin of new funding application");
    }

    res.json({ applicationId: updated.id, checkoutRequestId: stkResult.checkoutRequestId, demo: true, status: "submitted" });
    return;
  }

  // Real STK push: store checkoutRequestId, return to frontend for polling
  await db
    .update(fundingApplicationsTable)
    .set({ checkoutRequestId: stkResult.checkoutRequestId })
    .where(eq(fundingApplicationsTable.id, app.id));

  res.json({ applicationId: app.id, checkoutRequestId: stkResult.checkoutRequestId, demo: false, status: "pending_payment" });
});

router.get("/funding/applications/:id/payment-verify", authenticate, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [app] = await db
    .select()
    .from(fundingApplicationsTable)
    .where(and(eq(fundingApplicationsTable.id, id), eq(fundingApplicationsTable.userId, req.userId!)))
    .limit(1);

  if (!app) { res.status(404).json({ error: "Application not found" }); return; }

  if (app.paymentStatus === "completed") {
    res.json({ paymentStatus: "completed", status: app.status });
    return;
  }
  if (app.paymentStatus === "failed") {
    res.json({ paymentStatus: "failed", status: app.status });
    return;
  }
  if (!app.checkoutRequestId) {
    res.json({ paymentStatus: app.paymentStatus, status: app.status });
    return;
  }

  // Query Safaricom STK status
  const consumerKey = process.env.MPESA_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET?.trim();
  const passkey = process.env.MPESA_PASSKEY?.trim();
  const shortcode = process.env.MPESA_SHORTCODE?.trim();

  if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
    res.json({ paymentStatus: app.paymentStatus, status: app.status });
    return;
  }

  try {
    const authRes = await fetch(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      { headers: { Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}` } }
    );
    const authData = (await authRes.json()) as { access_token?: string };
    if (!authData.access_token) { res.json({ paymentStatus: "pending", status: app.status }); return; }

    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

    const queryRes = await fetch("https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query", {
      method: "POST",
      headers: { Authorization: `Bearer ${authData.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ BusinessShortCode: shortcode, Password: password, Timestamp: timestamp, CheckoutRequestID: app.checkoutRequestId }),
    });
    const queryData = (await queryRes.json()) as { ResultCode?: string | number; errorCode?: string };
    const resultCode = queryData.ResultCode !== undefined ? Number(queryData.ResultCode) : null;

    if (resultCode === 0) {
      const [updated] = await db
        .update(fundingApplicationsTable)
        .set({ paymentStatus: "completed", status: "submitted" })
        .where(eq(fundingApplicationsTable.id, app.id))
        .returning();

      // Record in payments table for audit trail
      await db.insert(paymentsTable).values({
        userId: req.userId!,
        phone: app.phone,
        amount: String(app.applicationFee),
        status: "completed",
        days: 0,
        checkoutRequestId: `funding-${app.checkoutRequestId}`,
      }).onConflictDoNothing();

      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
      if (user?.phone) {
        notifyFundingPaymentReceived({
          userId: req.userId!,
          phone: user.phone,
          name: user.name,
          amount: parseFloat(String(app.applicationFee)).toFixed(2),
          receipt: "",
          appId: String(app.id),
        });
      }

      // Notify admin of new application
      const [adminUser] = await db.select().from(usersTable).where(eq(usersTable.role, "admin")).limit(1);
      if (adminUser?.phone && adminUser.phone !== "254700000000") {
        logger.info({ adminPhone: adminUser.phone, appId: app.id }, "Notifying admin of new funding application (via verify)");
      }

      res.json({ paymentStatus: "completed", status: updated.status });
    } else if (resultCode !== null && resultCode !== 0) {
      await db.update(fundingApplicationsTable).set({ paymentStatus: "failed" }).where(eq(fundingApplicationsTable.id, app.id));
      res.json({ paymentStatus: "failed", status: app.status });
    } else {
      res.json({ paymentStatus: "pending", status: app.status });
    }
  } catch (err) {
    logger.error({ err }, "Funding STK Query error");
    res.json({ paymentStatus: app.paymentStatus, status: app.status });
  }
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

router.get("/admin/funding/settings", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const s = await getFundingSettings();
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...s, applicationFee: parseFloat(String(s.applicationFee)) });
});

router.patch("/admin/funding/settings", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { applicationFee, maxFundingAccounts, fundingEnabled } = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (applicationFee !== undefined) {
    const fee = parseFloat(String(applicationFee));
    if (isNaN(fee) || fee < 0) { res.status(400).json({ error: "Invalid applicationFee" }); return; }
    updates["applicationFee"] = fee.toFixed(2);
  }
  if (maxFundingAccounts !== undefined) {
    const max = parseInt(String(maxFundingAccounts), 10);
    if (isNaN(max) || max < 0) { res.status(400).json({ error: "Invalid maxFundingAccounts" }); return; }
    updates["maxFundingAccounts"] = max;
  }
  if (fundingEnabled !== undefined) {
    updates["fundingEnabled"] = Boolean(fundingEnabled);
  }

  const s = await getFundingSettings();
  if (!s) { res.status(404).json({ error: "Settings not found" }); return; }

  const [updated] = await db.update(fundingSettingsTable).set(updates).where(eq(fundingSettingsTable.id, s.id)).returning();
  logger.info(
    { updates, adminId: req.userId, updatedAt: new Date().toISOString() },
    "Funding settings updated by admin"
  );
  res.json({ ...updated, applicationFee: parseFloat(String(updated.applicationFee)) });
});

router.get("/admin/funding/stats", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const [{ total }] = await db.select({ total: count() }).from(fundingApplicationsTable);
  const [{ submitted }] = await db.select({ submitted: count() }).from(fundingApplicationsTable).where(eq(fundingApplicationsTable.status, "submitted"));
  const [{ underReview }] = await db.select({ underReview: count() }).from(fundingApplicationsTable).where(eq(fundingApplicationsTable.status, "under_review"));
  const [{ approved }] = await db.select({ approved: count() }).from(fundingApplicationsTable).where(eq(fundingApplicationsTable.status, "approved"));
  const [{ rejected }] = await db.select({ rejected: count() }).from(fundingApplicationsTable).where(eq(fundingApplicationsTable.status, "rejected"));
  const [{ funded }] = await db.select({ funded: count() }).from(fundingApplicationsTable).where(eq(fundingApplicationsTable.status, "funded"));

  const [revenueRow] = await db
    .select({ total: sum(fundingApplicationsTable.applicationFee) })
    .from(fundingApplicationsTable)
    .where(eq(fundingApplicationsTable.paymentStatus, "completed"));

  const s = await getFundingSettings();
  const approvedCount = Number(approved);
  const fundedCount = Number(funded);
  // Slots occupied by approved + funded applications
  const approvedOrFunded = approvedCount + fundedCount;
  const availableSlots = Math.max(0, (s?.maxFundingAccounts ?? 0) - approvedOrFunded);

  res.json({
    totalApplications: Number(total),
    submitted: Number(submitted),
    underReview: Number(underReview),
    approved: approvedCount,
    rejected: Number(rejected),
    funded: fundedCount,
    approvedOrFunded,
    availableSlots,
    maxFundingAccounts: s?.maxFundingAccounts ?? 0,
    totalFeeRevenue: parseFloat(String(revenueRow?.total ?? "0")),
  });
});

router.get("/admin/funding/applications", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { status, search, page = "1", limit = "20" } = req.query as Record<string, string>;

  let query = db.select().from(fundingApplicationsTable).$dynamic();

  const conditions = [];
  if (status && status !== "all") conditions.push(eq(fundingApplicationsTable.status, status));
  if (search) {
    conditions.push(
      or(
        ilike(fundingApplicationsTable.fullName, `%${search}%`),
        ilike(fundingApplicationsTable.email, `%${search}%`),
        ilike(fundingApplicationsTable.phone, `%${search}%`)
      )
    );
  }
  if (conditions.length > 0) {
    query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  const apps = await query.orderBy(desc(fundingApplicationsTable.createdAt)).limit(limitNum).offset(offset);

  // Get total count for pagination
  let countQuery = db.select({ total: count() }).from(fundingApplicationsTable).$dynamic();
  if (conditions.length > 0) countQuery = countQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  const [{ total: totalCount }] = await countQuery;

  res.json({
    applications: apps.map((a) => ({ ...a, applicationFee: parseFloat(String(a.applicationFee)) })),
    total: Number(totalCount),
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(Number(totalCount) / limitNum),
  });
});

router.get("/admin/funding/applications/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [app] = await db.select().from(fundingApplicationsTable).where(eq(fundingApplicationsTable.id, id)).limit(1);
  if (!app) { res.status(404).json({ error: "Application not found" }); return; }
  res.json({ ...app, applicationFee: parseFloat(String(app.applicationFee)) });
});

router.patch("/admin/funding/applications/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };

  const VALID_STATUSES = ["submitted", "under_review", "approved", "rejected", "funded"];

  const [app] = await db.select().from(fundingApplicationsTable).where(eq(fundingApplicationsTable.id, id)).limit(1);
  if (!app) { res.status(404).json({ error: "Application not found" }); return; }

  const updates: Record<string, unknown> = {};
  if (adminNotes !== undefined) updates["adminNotes"] = adminNotes;
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    updates["status"] = status;
    updates["reviewedAt"] = new Date();
    updates["reviewedBy"] = req.userId;
  }

  const [updated] = await db
    .update(fundingApplicationsTable)
    .set(updates)
    .where(eq(fundingApplicationsTable.id, id))
    .returning();

  logger.info({ appId: id, updates, adminId: req.userId }, "Funding application updated by admin");

  // Send SMS notifications on status change
  if (status && status !== app.status) {
    const [appUser] = await db.select().from(usersTable).where(eq(usersTable.id, app.userId)).limit(1);
    if (appUser?.phone) {
      if (status === "approved") {
        notifyFundingApplicationApproved({ userId: app.userId, phone: appUser.phone, name: appUser.name });
      } else if (status === "rejected") {
        notifyFundingApplicationRejected({ userId: app.userId, phone: appUser.phone, name: appUser.name });
      } else if (status === "funded") {
        notifyFundingApplicationFunded({ userId: app.userId, phone: appUser.phone, name: appUser.name });
      }
    }
  }

  res.json({ ...updated, applicationFee: parseFloat(String(updated.applicationFee)) });
});

// ─── Admin: Activate funded account → create slave account ──────────────────

router.post("/admin/funding/applications/:id/activate", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { mt5Login, server, tradingPassword, metaapiRegion } = req.body as {
    mt5Login?: string;
    server: string;
    tradingPassword: string;
    metaapiRegion?: string;
  };

  if (!server || !tradingPassword) {
    res.status(400).json({ error: "server and tradingPassword are required" });
    return;
  }

  const [app] = await db.select().from(fundingApplicationsTable).where(eq(fundingApplicationsTable.id, id)).limit(1);
  if (!app) { res.status(404).json({ error: "Application not found" }); return; }
  if (app.status !== "funded") {
    res.status(400).json({ error: "Only funded applications can be activated" });
    return;
  }
  if (app.linkedSlaveAccountId) {
    res.status(400).json({ error: "This application already has an active slave account" });
    return;
  }

  // Enforce platform capacity
  const [{ slaveCount }] = await db.select({ slaveCount: count() }).from(slaveAccountsTable);
  if (Number(slaveCount) >= PLATFORM_CAPACITY) {
    res.status(400).json({ error: `Platform capacity reached (${PLATFORM_CAPACITY} slave accounts). Cannot activate more funded accounts.` });
    return;
  }

  const login = (mt5Login?.trim() || app.mt5AccountNumber || app.email).trim();

  // Create slave account
  const [slave] = await db.insert(slaveAccountsTable).values({
    userId: app.userId,
    mt5Login: login,
    broker: app.brokerName,
    server: server.trim(),
    tradingPasswordEncrypted: encryptCredential(tradingPassword),
    platform: "mt5",
    status: "connecting",
    ...(metaapiRegion?.trim() ? { metaapiRegion: metaapiRegion.trim() } : {}),
  }).returning();

  // Link the slave account back to the application
  const [updated] = await db.update(fundingApplicationsTable).set({
    activatedAt: new Date(),
    linkedSlaveAccountId: slave.id,
  }).where(eq(fundingApplicationsTable.id, id)).returning();

  logger.info(
    { appId: id, slaveId: slave.id, adminId: req.userId, mt5Login: login },
    "Funded account activated — slave account created"
  );

  res.json({ ...updated, slaveAccount: slave });
});

router.get("/admin/funding/export", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { status } = req.query as { status?: string };

  let query = db.select().from(fundingApplicationsTable).$dynamic();
  if (status && status !== "all") query = query.where(eq(fundingApplicationsTable.status, status));

  const apps = await query.orderBy(desc(fundingApplicationsTable.createdAt));

  const headers = [
    "ID", "Full Name", "Email", "Phone", "Country", "Trading Experience",
    "Broker", "MT5 Account", "Account Type", "Status", "Payment Status",
    "Application Fee", "MPESA Receipt", "Admin Notes", "Created At",
  ];

  const rows = apps.map((a) => [
    a.id,
    `"${a.fullName.replace(/"/g, '""')}"`,
    a.email,
    a.phone,
    `"${a.country.replace(/"/g, '""')}"`,
    `"${a.tradingExperience.replace(/"/g, '""')}"`,
    `"${a.brokerName.replace(/"/g, '""')}"`,
    a.mt5AccountNumber ?? "",
    a.accountType,
    a.status,
    a.paymentStatus,
    parseFloat(String(a.applicationFee)).toFixed(2),
    a.mpesaReceipt ?? "",
    `"${(a.adminNotes ?? "").replace(/"/g, '""')}"`,
    a.createdAt.toISOString(),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="funding-applications-${Date.now()}.csv"`);
  res.send(csv);
});

export default router;
