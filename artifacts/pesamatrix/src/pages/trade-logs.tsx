import { AppLayout } from "@/components/layout/app-layout";
import { useListTradeLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, BarChart3, Activity, TrendingUp, TrendingDown, DollarSign, CalendarDays } from "lucide-react";

function SideBadge({ side }: { side?: string | null }) {
  if (side === "BUY") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs font-mono">BUY</Badge>;
  if (side === "SELL") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs font-mono">SELL</Badge>;
  return null;
}

function ProfitCell({ profit }: { profit?: number | null }) {
  if (profit == null) return <span className="text-muted-foreground">—</span>;
  const positive = profit >= 0;
  return (
    <span className={`font-mono font-medium ${positive ? "text-green-400" : "text-red-400"}`}>
      {positive ? "+" : ""}{profit.toFixed(2)}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-lg sm:text-xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
          <Icon className={`h-4 w-4 mt-0.5 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

interface TradeLog {
  id: number;
  symbol?: string | null;
  side?: string | null;
  volume?: number | null;
  openPrice?: number | null;
  closePrice?: number | null;
  profit?: number | null;
  action?: string | null;
  strategyName?: string | null;
  strategyId?: number | null;
  createdAt: string;
}

/** Mobile: stacked card per trade */
function TradeCard({ log }: { log: TradeLog }) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {log.symbol ? (
            <span className="font-mono font-semibold text-foreground">{log.symbol}</span>
          ) : (
            <Badge variant="outline" className="text-xs font-mono">{log.action}</Badge>
          )}
          <SideBadge side={log.side} />
        </div>
        <ProfitCell profit={log.profit} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <div>
          <p className="font-medium text-foreground/60">Volume</p>
          <p className="font-mono">{log.volume != null ? log.volume.toFixed(2) : "—"}</p>
        </div>
        <div>
          <p className="font-medium text-foreground/60">Open</p>
          <p className="font-mono">{log.openPrice != null ? log.openPrice.toFixed(5) : "—"}</p>
        </div>
        <div>
          <p className="font-medium text-foreground/60">Close</p>
          <p className="font-mono">{log.closePrice != null ? log.closePrice.toFixed(5) : "—"}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate max-w-[60%]">{log.strategyName ?? `#${log.strategyId}`}</span>
        <span className="shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function TradeLogsPage() {
  const { data: logs, isLoading } = useListTradeLogs();

  const now = new Date();
  const todayStr = now.toDateString();

  const allLogs = logs ?? [];
  const logsWithProfit = allLogs.filter((l) => l.profit != null);
  const todayLogs = allLogs.filter((l) => new Date(l.createdAt).toDateString() === todayStr);
  const todayLogsWithProfit = todayLogs.filter((l) => l.profit != null);

  const totalPL = logsWithProfit.reduce((sum, l) => sum + (l.profit ?? 0), 0);
  const todayPL = todayLogsWithProfit.reduce((sum, l) => sum + (l.profit ?? 0), 0);
  const winCount = logsWithProfit.filter((l) => (l.profit ?? 0) > 0).length;
  const winRate =
    logsWithProfit.length > 0
      ? Math.round((winCount / logsWithProfit.length) * 100)
      : null;

  const formatPL = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Trade Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time history of all copied trades via CopyFactory</p>
        </div>

        {/* Stats — 2 cols on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Trades" value={String(allLogs.length)} icon={BarChart3} color="text-blue-400" />
          <StatCard label="Today" value={String(todayLogs.length)} icon={CalendarDays} color="text-blue-400" />
          <StatCard
            label="Total P/L"
            value={logsWithProfit.length > 0 ? formatPL(totalPL) : "—"}
            icon={DollarSign}
            color={totalPL >= 0 ? "text-green-400" : "text-red-400"}
          />
          <StatCard
            label={winRate != null ? "Win Rate · Today P/L" : "Win Rate"}
            value={
              winRate != null
                ? `${winRate}% · ${todayLogsWithProfit.length > 0 ? formatPL(todayPL) : "—"}`
                : "—"
            }
            icon={winRate != null && winRate >= 50 ? TrendingUp : TrendingDown}
            color={winRate != null && winRate >= 50 ? "text-green-400" : "text-orange-400"}
          />
        </div>

        {/* Activity Log */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !allLogs.length ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-foreground">No trades copied yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Events will appear here once CopyFactory starts copying trades to your slave accounts.
                </p>
                <p className="text-xs text-muted-foreground mt-3 font-mono break-all">
                  Webhook: /api/webhooks/copyfactory?secret=***
                </p>
              </div>
            ) : (
              <>
                {/* Mobile: stacked cards */}
                <div className="sm:hidden space-y-2">
                  {allLogs.map((log) => (
                    <TradeCard key={log.id} log={log as TradeLog} />
                  ))}
                </div>

                {/* Tablet/Desktop: table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                        <th className="text-left py-2 pr-3">Symbol</th>
                        <th className="text-left py-2 pr-3">Side</th>
                        <th className="text-right py-2 pr-3">Volume</th>
                        <th className="text-right py-2 pr-3">Open</th>
                        <th className="text-right py-2 pr-3">Close</th>
                        <th className="text-right py-2 pr-3">P/L</th>
                        <th className="text-left py-2 pr-3">Strategy</th>
                        <th className="text-right py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-2.5 pr-3">
                            {log.symbol ? (
                              <span className="font-mono font-medium text-foreground">{log.symbol}</span>
                            ) : (
                              <Badge variant="outline" className="text-xs font-mono">{log.action}</Badge>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            <SideBadge side={log.side} />
                            {!log.side && log.action && !log.symbol && (
                              <span className="text-xs text-muted-foreground">{log.action}</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono text-muted-foreground">
                            {log.volume != null ? log.volume.toFixed(2) : "—"}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono text-muted-foreground text-xs">
                            {log.openPrice != null ? log.openPrice.toFixed(5) : "—"}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono text-muted-foreground text-xs">
                            {log.closePrice != null ? log.closePrice.toFixed(5) : "—"}
                          </td>
                          <td className="py-2.5 pr-3 text-right">
                            <ProfitCell profit={log.profit} />
                          </td>
                          <td className="py-2.5 pr-3 text-xs text-muted-foreground truncate max-w-[120px]">
                            {log.strategyName ?? `#${log.strategyId}`}
                          </td>
                          <td className="py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
