/**
 * Executive Dashboard
 *
 * Real-time platform overview — auto-refreshes every 10 seconds.
 * Fetches from /api/admin/analytics (rich PlatformAnalytics) and
 * /api/admin/workers (worker health summary).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Users, CreditCard, TrendingUp, Activity, Server, Wifi,
  WifiOff, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Clock, Database, Zap, BarChart3, ArrowUpRight, Shield,
  Circle, Cpu, Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlatformAnalytics {
  collectedAt: string;
  totalSubscribers: number;
  activeSubscribers: number;
  freeTrialSubscribers: number;
  vipSubscribers: number;
  totalActiveSubscriptions: number;
  totalUsers: number;
  newUsersToday: number;
  conversionRate: number;
  demoToLiveConversionRate: number;
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
  failedReplications: number;
  totalReplicationAttempts: number;
  replicationSuccessRate: number;
  averageReplicationLatencyMs: number;
  totalCopiedTradesToday: number;
  totalSignalsToday: number;
  totalSlaveAccounts: number;
  demoAccounts: number;
  liveAccounts: number;
  revenueToday: number;
  monthlyRevenue: number;
  systemHealthPercent: number;
  brokerDistribution: { broker: string; count: number }[];
}

interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  activeSlaveAccounts: number;
  capacityPercentage: number;
  totalCapacity: number;
  remainingCapacity: number;
  pendingMasterApprovals: number;
}

interface WorkerSummary {
  total: number;
  running: number;
  idle: number;
  failed: number;
  restarting: number;
  stale: number;
}

interface IntegrationStatus {
  metaapi: { token: boolean };
  mpesa: { consumerKey: boolean; consumerSecret: boolean; passkey: boolean; shortcode: boolean; callbackUrl: boolean };
  mode: "live" | "demo";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null, decimals = 0): string {
  if (n == null) return "—";
  return n.toLocaleString("en-KE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtKes(n: number | undefined | null): string {
  if (n == null) return "—";
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ── Stat Tile ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  trend,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: "blue" | "green" | "orange" | "purple" | "red" | "cyan";
  trend?: "up" | "down" | "neutral";
  href?: string;
}) {
  const accentMap = {
    blue: { icon: "bg-blue-600/15 text-blue-400", border: "hover:border-blue-500/40" },
    green: { icon: "bg-green-600/15 text-green-400", border: "hover:border-green-500/40" },
    orange: { icon: "bg-orange-500/15 text-orange-400", border: "hover:border-orange-500/40" },
    purple: { icon: "bg-purple-500/15 text-purple-400", border: "hover:border-purple-500/40" },
    red: { icon: "bg-red-500/15 text-red-400", border: "hover:border-red-500/40" },
    cyan: { icon: "bg-cyan-500/15 text-cyan-400", border: "hover:border-cyan-500/40" },
  };
  const a = accentMap[accent];

  const inner = (
    <Card className={cn("border-border transition-all duration-200", a.border, href && "cursor-pointer")}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-tight truncate">{label}</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground mt-0.5 leading-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", a.icon)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        {trend === "up" && (
          <div className="flex items-center gap-1 mt-2">
            <ArrowUpRight className="h-3 w-3 text-green-400" />
            <span className="text-xs text-green-400">Trending up</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <a href={href}>{inner}</a>;
  }
  return inner;
}

// ── Health Indicator ───────────────────────────────────────────────────────────

function HealthBadge({ pct, label }: { pct: number; label: string }) {
  const color = pct >= 90 ? "green" : pct >= 60 ? "yellow" : "red";
  const colorMap = {
    green: "bg-green-500/15 text-green-400 border-green-500/30",
    yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    red: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <Badge className={cn("text-xs", colorMap[color])}>
      <Circle className={cn("h-2 w-2 mr-1 fill-current", color === "green" && "animate-pulse")} />
      {label}: {pct}%
    </Badge>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <h2 className={cn("text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5", color)}>
      <Icon className="h-3.5 w-3.5" />
      {title}
    </h2>
  );
}

// ── Master Utilization Bar ────────────────────────────────────────────────────

function UtilBar({ pct, label }: { pct: number; label: string }) {
  const color = pct >= 85 ? "bg-red-500" : pct >= 60 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className={pct >= 85 ? "text-red-400" : pct >= 60 ? "text-yellow-400" : "text-green-400"}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

// ── Chart Colors ──────────────────────────────────────────────────────────────

const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444"];

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ExecutiveDashboard() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user && user.role !== "admin") navigate("/dashboard");
  }, [user, navigate]);

  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [workerSummary, setWorkerSummary] = useState<WorkerSummary | null>(null);
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [aRes, sRes, wRes, iRes] = await Promise.all([
          fetch("/api/admin/analytics", { headers }),
          fetch("/api/admin/stats", { headers }),
          fetch("/api/admin/workers", { headers }),
          fetch("/api/admin/integration-status", { headers }),
        ]);
        if (aRes.ok) setAnalytics(await aRes.json() as PlatformAnalytics);
        if (sRes.ok) setStats(await sRes.json() as AdminStats);
        if (wRes.ok) {
          const w = await wRes.json() as { summary: WorkerSummary };
          setWorkerSummary(w.summary);
        }
        if (iRes.ok) setIntegration(await iRes.json() as IntegrationStatus);
        setLastRefresh(new Date());
      } catch {
        // silently skip — stale data is better than blank screen
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void fetchAll();
    timerRef.current = setInterval(() => { void fetchAll(true); }, 10_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchAll]);

  if (!user || user.role !== "admin") return null;

  const a = analytics;
  const s = stats;
  const w = workerSummary;
  const mpesaOk = integration
    ? integration.mpesa.consumerKey && integration.mpesa.consumerSecret &&
      integration.mpesa.passkey && integration.mpesa.shortcode && integration.mpesa.callbackUrl
    : null;
  const metaApiOk = integration?.metaapi.token ?? null;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-screen-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Executive Dashboard</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {lastRefresh
                  ? `Updated ${timeAgo(lastRefresh.toISOString())} · auto-refreshes every 10s`
                  : "Loading…"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {a && <HealthBadge pct={a.systemHealthPercent} label="System Health" />}
            {integration && (
              <Badge className={cn("text-xs", integration.mode === "live"
                ? "bg-green-500/15 text-green-400 border-green-500/30"
                : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
              )}>
                {integration.mode === "live" ? "LIVE" : "DEMO"}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchAll(true)}
              disabled={refreshing || loading}
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", (refreshing || loading) && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-border bg-muted/20 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* ── Users & Subscriptions ── */}
            <div className="space-y-2">
              <SectionHeader icon={Users} title="Users & Subscriptions" color="text-blue-400" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard label="Total Users" value={fmt(a?.totalUsers ?? s?.totalUsers)} icon={Users} accent="blue" />
                <KpiCard label="Active Subscribers" value={fmt(a?.activeSubscribers ?? s?.activeSubscriptions)} icon={CheckCircle2} accent="green" />
                <KpiCard label="Free Trial Users" value={fmt(a?.freeTrialSubscribers)} icon={Clock} accent="cyan" />
                <KpiCard label="New Users Today" value={fmt(a?.newUsersToday)} icon={ArrowUpRight} accent="purple" trend="up" />
                <KpiCard label="Conversion Rate" value={a ? `${a.conversionRate}%` : "—"} sub="active / total users" icon={TrendingUp} accent="green" />
                <KpiCard label="Demo→Live Conv." value={a ? `${a.demoToLiveConversionRate}%` : "—"} sub="live / all slave accts" icon={ArrowUpRight} accent="orange" />
              </div>
            </div>

            {/* ── Revenue ── */}
            <div className="space-y-2">
              <SectionHeader icon={CreditCard} title="Revenue" color="text-green-400" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
                <KpiCard label="Revenue Today" value={fmtKes(a?.revenueToday)} icon={CreditCard} accent="green" />
                <KpiCard label="Revenue This Month" value={fmtKes(a?.monthlyRevenue)} icon={TrendingUp} accent="green" trend="up" />
                <KpiCard label="Total Revenue" value={fmtKes(s?.totalRevenue)} icon={BarChart3} accent="blue" />
              </div>
            </div>

            {/* ── Distribution Masters ── */}
            <div className="space-y-2">
              <SectionHeader icon={Server} title="Distribution Masters" color="text-purple-400" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard
                  label="Online Masters"
                  value={fmt(a?.onlineMasters)}
                  sub={`of ${fmt(a?.totalMasters)} total`}
                  icon={Wifi}
                  accent="green"
                  href="/admin/distribution-masters"
                />
                <KpiCard
                  label="Offline Masters"
                  value={fmt(a?.offlineMasters)}
                  icon={WifiOff}
                  accent={a?.offlineMasters ? "red" : "blue"}
                  href="/admin/distribution-masters"
                />
                <KpiCard label="Master Health" value={a ? `${a.masterHealthPercent}%` : "—"} icon={Activity} accent="green" />
                <KpiCard label="Platform Capacity" value={a ? `${a.masterUtilizationPercent}%` : "—"} sub={`${fmt(a?.totalCurrentLoad)} / ${fmt(a?.totalCapacity)}`} icon={Cpu} accent={a && a.masterUtilizationPercent > 80 ? "red" : "orange"} />
                <KpiCard label="Avg Load" value={a ? `${a.averageLoadPercent}%` : "—"} icon={Activity} accent="cyan" />
                <KpiCard label="Slave Accounts" value={fmt(a?.totalSlaveAccounts)} sub={`${fmt(a?.liveAccounts)} live · ${fmt(a?.demoAccounts)} demo`} icon={Database} accent="blue" />
              </div>

              {/* Utilization bars */}
              {a && a.totalMasters > 0 && (
                <Card>
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Master Utilization</p>
                    <UtilBar pct={a.averageLoadPercent} label="Average load" />
                    <UtilBar pct={a.highestLoadPercent} label="Highest load" />
                    <UtilBar pct={a.masterUtilizationPercent} label="Total capacity used" />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── Replication & Trading ── */}
            <div className="space-y-2">
              <SectionHeader icon={Radio} title="Replication & Trading" color="text-cyan-400" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <KpiCard label="Trades Copied Today" value={fmt(a?.totalCopiedTradesToday)} icon={TrendingUp} accent="green" />
                <KpiCard label="Signals Today" value={fmt(a?.totalSignalsToday)} icon={Radio} accent="blue" />
                <KpiCard label="Replication Success" value={a ? `${a.replicationSuccessRate}%` : "—"} icon={CheckCircle2} accent={a && a.replicationSuccessRate < 90 ? "red" : "green"} />
                <KpiCard label="Avg Latency" value={a ? `${a.averageReplicationLatencyMs}ms` : "—"} icon={Zap} accent={a && a.averageReplicationLatencyMs > 500 ? "red" : "cyan"} />
                <KpiCard label="Failed Replications" value={fmt(a?.failedReplications)} icon={XCircle} accent={a?.failedReplications ? "red" : "blue"} />
              </div>
            </div>

            {/* ── Workers & Integrations row ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Workers */}
              <div className="space-y-2">
                <SectionHeader icon={Activity} title="Background Workers" color="text-orange-400" />
                {w ? (
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                          { label: "Total", value: w.total, color: "text-foreground" },
                          { label: "Running", value: w.running, color: "text-blue-400" },
                          { label: "Idle", value: w.idle, color: "text-green-400" },
                          { label: "Failed", value: w.failed, color: w.failed > 0 ? "text-red-400" : "text-muted-foreground" },
                          { label: "Stale", value: w.stale, color: w.stale > 0 ? "text-orange-400" : "text-muted-foreground" },
                          { label: "Restarting", value: w.restarting, color: w.restarting > 0 ? "text-yellow-400" : "text-muted-foreground" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="text-center p-2 rounded-lg bg-muted/30">
                            <p className={cn("text-lg font-bold", color)}>{value}</p>
                            <p className="text-xs text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>
                      {(w.failed > 0 || w.stale > 0) ? (
                        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          {w.failed > 0 ? `${w.failed} worker(s) failed. ` : ""}
                          {w.stale > 0 ? `${w.stale} worker(s) stale.` : ""}
                          <a href="/admin/workers" className="ml-auto text-blue-400 hover:text-blue-300 font-medium shrink-0">View →</a>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          All workers healthy
                          <a href="/admin/workers" className="ml-auto text-blue-400 hover:text-blue-300 font-medium shrink-0">View →</a>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card><CardContent className="pt-4 pb-4 h-20 flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  </CardContent></Card>
                )}
              </div>

              {/* Integration & Platform Status */}
              <div className="space-y-2">
                <SectionHeader icon={Shield} title="Platform & Integrations" color="text-green-400" />
                <Card>
                  <CardContent className="pt-4 pb-4 space-y-2.5">
                    {[
                      {
                        label: "MetaApi",
                        ok: metaApiOk,
                        detail: metaApiOk ? "Token configured" : "Token missing",
                        href: "/admin/health",
                      },
                      {
                        label: "M-Pesa",
                        ok: mpesaOk,
                        detail: mpesaOk ? "Live mode" : integration ? "Demo mode — credentials missing" : "Unknown",
                        href: "/admin/health",
                      },
                      {
                        label: "System Health",
                        ok: a ? a.systemHealthPercent >= 60 : null,
                        detail: a ? `${a.systemHealthPercent}%` : "Loading…",
                        href: "/admin/health",
                      },
                      {
                        label: "Subscription Enforcement",
                        ok: w ? (w.failed === 0 && w.stale === 0) : null,
                        detail: w ? (w.failed === 0 && w.stale === 0 ? "All workers healthy" : `${w.failed + w.stale} issues`) : "Loading…",
                        href: "/admin/workers",
                      },
                      {
                        label: "CopyFactory Pipeline",
                        ok: a ? a.replicationSuccessRate >= 90 : null,
                        detail: a ? `${a.replicationSuccessRate}% success rate` : "Loading…",
                        href: "/admin/health",
                      },
                    ].map(({ label, ok, detail, href }) => (
                      <div key={label} className="flex items-center justify-between gap-2 text-sm">
                        <a href={href} className="text-muted-foreground hover:text-foreground transition-colors">{label}</a>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-muted-foreground">{detail}</span>
                          {ok === null ? (
                            <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
                          ) : ok ? (
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-red-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* ── Charts row ── */}
            {a && a.brokerDistribution.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Broker Distribution Pie */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Database className="h-4 w-4 text-blue-400" />
                      Broker Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div style={{ width: 160, height: 160 }} className="shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={a.brokerDistribution}
                              dataKey="count"
                              nameKey="broker"
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={70}
                              paddingAngle={3}
                            >
                              {a.brokerDistribution.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                              itemStyle={{ color: "hsl(var(--foreground))" }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {a.brokerDistribution.map((b, i) => (
                          <div key={b.broker} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span className="text-muted-foreground truncate max-w-[140px]">{b.broker || "Unknown"}</span>
                            </div>
                            <span className="font-medium text-foreground">{b.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Master Load Bar Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Server className="h-4 w-4 text-purple-400" />
                      Platform Capacity Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div style={{ height: 160 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: "Active Subs", value: a.activeSubscribers, fill: "#22c55e" },
                            { name: "Trial Users", value: a.freeTrialSubscribers, fill: "#06b6d4" },
                            { name: "Total Users", value: a.totalUsers, fill: "#3b82f6" },
                            { name: "Slave Accts", value: a.totalSlaveAccounts, fill: "#8b5cf6" },
                          ]}
                          margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                            itemStyle={{ color: "hsl(var(--foreground))" }}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {[
                              { fill: "#22c55e" },
                              { fill: "#06b6d4" },
                              { fill: "#3b82f6" },
                              { fill: "#8b5cf6" },
                            ].map((c, i) => <Cell key={i} fill={c.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── Quick Links ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { href: "/admin", label: "Admin Panel", icon: Shield, color: "text-green-400" },
                { href: "/admin/distribution-masters", label: "Masters", icon: Server, color: "text-purple-400" },
                { href: "/admin/workers", label: "Workers", icon: Activity, color: "text-orange-400" },
                { href: "/admin/health", label: "Health", icon: CheckCircle2, color: "text-cyan-400" },
                { href: "/admin/trade-audit", label: "Trade Audit", icon: BarChart3, color: "text-blue-400" },
                { href: "/admin/settings", label: "Settings", icon: Zap, color: "text-yellow-400" },
              ].map(({ href, label, icon: Icon, color }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card/50 hover:bg-muted/50 hover:border-muted-foreground/30 transition-all text-sm text-muted-foreground hover:text-foreground"
                >
                  <Icon className={cn("h-4 w-4 shrink-0", color)} />
                  <span className="truncate">{label}</span>
                </a>
              ))}
            </div>

            {/* Footer */}
            {a && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pb-2">
                <Clock className="h-3 w-3" />
                Analytics collected {timeAgo(a.collectedAt)} · Worker: every 5 min · Dashboard: every 10s
              </p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
