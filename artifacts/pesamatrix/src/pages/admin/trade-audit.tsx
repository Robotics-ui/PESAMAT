import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, RefreshCw, Search, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Minus, Clock, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TradeAuditLog {
  id: number;
  tradingMasterId: number | null;
  distributionMasterId: number | null;
  subscriberId: number | null;
  broker: string | null;
  accountType: string | null;
  tradeAction: string | null;
  symbol: string | null;
  entryPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  executionTime: string | null;
  replicationLatencyMs: number | null;
  status: string;
  failureReason: string | null;
  ticket: string | null;
  createdAt: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface AuditResponse {
  data: TradeAuditLog[];
  pagination: PaginationInfo;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    SUCCESS: { label: "Success", cls: "bg-green-500/10 text-green-400 border-green-500/30", icon: CheckCircle2 },
    FAILED: { label: "Failed", cls: "bg-red-500/10 text-red-400 border-red-500/30", icon: XCircle },
    PARTIAL: { label: "Partial", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", icon: AlertCircle },
  };
  const s = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border", icon: Minus };
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", s.cls)}>
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

function ActionBadge({ action }: { action: string | null }) {
  if (!action) return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, { cls: string; icon: React.ElementType }> = {
    OPEN: { cls: "text-blue-400", icon: TrendingUp },
    CLOSE: { cls: "text-orange-400", icon: TrendingDown },
    MODIFY: { cls: "text-purple-400", icon: Minus },
  };
  const s = map[action.toUpperCase()] ?? { cls: "text-muted-foreground", icon: Minus };
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", s.cls)}>
      <Icon className="h-3 w-3" />
      {action}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TradeAuditPage() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [data, setData] = useState<TradeAuditLog[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ total: 0, page: 1, limit: 50, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [subscriberId, setSubscriberId] = useState("");
  const [distMasterId, setDistMasterId] = useState("");
  const [broker, setBroker] = useState("");
  const [symbol, setSymbol] = useState("");
  const [status, setStatus] = useState("ALL");
  const [tradeAction, setTradeAction] = useState("ALL");
  const [page, setPage] = useState(1);

  const buildParams = (p = 1) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("limit", "50");
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (subscriberId) params.set("subscriberId", subscriberId);
    if (distMasterId) params.set("distributionMasterId", distMasterId);
    if (broker) params.set("broker", broker);
    if (symbol) params.set("symbol", symbol);
    if (status !== "ALL") params.set("status", status);
    if (tradeAction !== "ALL") params.set("tradeAction", tradeAction);
    return params;
  };

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/trade-audit?${buildParams(p).toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json() as AuditResponse;
      setData(json.data);
      setPagination(json.pagination);
      setPage(p);
      setSearched(true);
    } catch {
      toast({ title: "Error", description: "Failed to load trade audit logs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => { void load(1); };

  const handlePage = (p: number) => { void load(p); };

  const fmtDate = (s: string | null) => {
    if (!s) return "—";
    return new Date(s).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "medium" });
  };

  const fmtPrice = (s: string | null) => {
    if (!s) return "—";
    const n = parseFloat(s);
    return isNaN(n) ? s : n.toFixed(5);
  };

  return (
    <AppLayout>
      <div className="space-y-5 p-4 md:p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-400" />
            Trading Audit Journal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete log of every copied trade — filter by date, subscriber, broker, symbol, status, or trade type.
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subscriber ID</Label>
                <Input placeholder="Account ID" value={subscriberId} onChange={(e) => setSubscriberId(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Distribution Master ID</Label>
                <Input placeholder="Master ID" value={distMasterId} onChange={(e) => setDistMasterId(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Broker</Label>
                <Input placeholder="e.g. ICMarkets" value={broker} onChange={(e) => setBroker(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Symbol</Label>
                <Input placeholder="e.g. EURUSD" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="SUCCESS">Success</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                    <SelectItem value="PARTIAL">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Trade Action</Label>
                <Select value={tradeAction} onValueChange={setTradeAction}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="OPEN">OPEN</SelectItem>
                    <SelectItem value="CLOSE">CLOSE</SelectItem>
                    <SelectItem value="MODIFY">MODIFY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={handleSearch} disabled={loading}>
                {loading ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {!searched ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              Apply filters above and click <strong>Search</strong> to view trade audit logs.
            </CardContent>
          </Card>
        ) : data.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No trade audit logs found for the selected filters.</p>
              <p className="text-xs text-muted-foreground mt-1">Logs are recorded automatically when CopyFactory replications are processed.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {pagination.total.toLocaleString()} trade{pagination.total !== 1 ? "s" : ""} found
                </CardTitle>
                {pagination.pages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePage(page - 1)} disabled={page <= 1 || loading}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground">{page} / {pagination.pages}</span>
                    <Button variant="outline" size="sm" onClick={() => handlePage(page + 1)} disabled={page >= pagination.pages || loading}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">Time</th>
                      <th className="px-4 py-2 text-left font-medium">Symbol</th>
                      <th className="px-4 py-2 text-left font-medium">Action</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-left font-medium">Entry</th>
                      <th className="px-4 py-2 text-left font-medium">SL</th>
                      <th className="px-4 py-2 text-left font-medium">TP</th>
                      <th className="px-4 py-2 text-left font-medium">Latency</th>
                      <th className="px-4 py-2 text-left font-medium">Broker</th>
                      <th className="px-4 py-2 text-left font-medium">Account</th>
                      <th className="px-4 py-2 text-left font-medium">Subscriber</th>
                      <th className="px-4 py-2 text-left font-medium">Ticket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={row.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                        <td className="px-4 py-2 font-medium font-mono">{row.symbol ?? "—"}</td>
                        <td className="px-4 py-2"><ActionBadge action={row.tradeAction} /></td>
                        <td className="px-4 py-2"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-2 font-mono text-right">{fmtPrice(row.entryPrice)}</td>
                        <td className="px-4 py-2 font-mono text-right text-red-400">{fmtPrice(row.stopLoss)}</td>
                        <td className="px-4 py-2 font-mono text-right text-green-400">{fmtPrice(row.takeProfit)}</td>
                        <td className="px-4 py-2 text-right">
                          {row.replicationLatencyMs != null ? (
                            <span className={cn(
                              "font-medium",
                              row.replicationLatencyMs < 200 ? "text-green-400" :
                              row.replicationLatencyMs < 500 ? "text-yellow-400" : "text-red-400",
                            )}>
                              {row.replicationLatencyMs}ms
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{row.broker ?? "—"}</td>
                        <td className="px-4 py-2">
                          {row.accountType ? (
                            <Badge variant="outline" className={cn(
                              "text-xs",
                              row.accountType === "LIVE" ? "text-green-400 border-green-500/30" : "text-blue-400 border-blue-500/30",
                            )}>
                              {row.accountType}
                            </Badge>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{row.subscriberId ?? "—"}</td>
                        <td className="px-4 py-2 font-mono text-muted-foreground/70">{row.ticket ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-border/30">
                  <span className="text-xs text-muted-foreground">
                    Showing {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePage(page - 1)} disabled={page <= 1 || loading}>
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePage(page + 1)} disabled={page >= pagination.pages || loading}>
                      Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
