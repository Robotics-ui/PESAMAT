import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Server,
  Plus,
  RefreshCw,
  Power,
  Wrench,
  Users,
  Activity,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  WifiOff,
  Settings,
  Zap,
} from "lucide-react";

const API = "/api";

interface DistributionMaster {
  id: number;
  name: string;
  metaapiAccountId: string | null;
  strategyId: string | null;
  broker: string | null;
  server: string | null;
  status: string;
  capacity: number;
  currentLoad: number;
  priority: number;
  latencyMs: number | null;
  connectionStatus: string | null;
  synchronizationStatus: string | null;
  failedReplications: number;
  notes: string | null;
  activeSubscribers: number;
  utilizationPercent: number;
  lastOnlineAt: string | null;
  lastOfflineAt: string | null;
  createdAt: string;
}

interface Analytics {
  collectedAt: string;
  totalSubscribers: number;
  activeSubscribers: number;
  freeTrialSubscribers?: number;
  totalMasters: number;
  onlineMasters: number;
  offlineMasters: number;
  averageLoadPercent: number;
  highestLoadPercent: number;
  lowestLoadPercent: number;
  totalCapacity: number;
  totalCurrentLoad: number;
  masterUtilizationPercent?: number;
  failedReplications: number;
  replicationSuccessRate: number;
  averageReplicationLatencyMs?: number;
  totalCopiedTradesToday?: number;
  totalSlaveAccounts: number;
  totalUsers: number;
  /** @deprecated use newUsersToday */
  dailyNewUsers?: number;
  newUsersToday?: number;
  conversionRate: number;
  demoToLiveConversionRate?: number;
  revenueToday?: number;
  monthlyRevenue: number;
  masterHealthPercent: number;
  systemHealthPercent?: number;
}

function statusColor(status: string) {
  switch (status) {
    case "ONLINE": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "OFFLINE": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "MAINTENANCE": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "DISABLED": return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "ONLINE": return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    case "OFFLINE": return <WifiOff className="h-4 w-4 text-red-400" />;
    case "MAINTENANCE": return <Wrench className="h-4 w-4 text-yellow-400" />;
    default: return <Power className="h-4 w-4 text-gray-400" />;
  }
}

function UtilBar({ percent }: { percent: number }) {
  const color = percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

type MasterFormData = {
  name: string;
  metaapiAccountId: string;
  strategyId: string;
  broker: string;
  server: string;
  capacity: string;
  priority: string;
  status: string;
  notes: string;
};

const emptyForm: MasterFormData = {
  name: "", metaapiAccountId: "", strategyId: "", broker: "",
  server: "", capacity: "2000", priority: "0", status: "OFFLINE", notes: "",
};

export default function DistributionMastersPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DistributionMaster | null>(null);
  const [form, setForm] = useState<MasterFormData>(emptyForm);

  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  const { data: masters = [], isLoading } = useQuery<DistributionMaster[]>({
    queryKey: ["distribution-masters"],
    queryFn: () => fetch(`${API}/admin/distribution-masters`, { headers }).then((r) => r.json()),
    refetchInterval: 15_000,
  });

  const { data: analytics } = useQuery<Analytics>({
    queryKey: ["admin-analytics"],
    queryFn: () => fetch(`${API}/admin/analytics`, { headers }).then((r) => r.json()),
    refetchInterval: 60_000,
  });

  async function callAction(masterId: number, action: string, label: string) {
    const r = await fetch(`${API}/admin/distribution-masters/${masterId}/${action}`, { method: "POST", headers });
    if (r.ok) {
      toast({ title: `${label} successful` });
      void qc.invalidateQueries({ queryKey: ["distribution-masters"] });
    } else {
      const err = await r.json().catch(() => ({ error: "Unknown error" })) as { error?: string };
      toast({ title: `${label} failed`, description: err.error, variant: "destructive" });
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (data: MasterFormData) => {
      const body = {
        name: data.name,
        metaapiAccountId: data.metaapiAccountId || undefined,
        strategyId: data.strategyId || undefined,
        broker: data.broker || undefined,
        server: data.server || undefined,
        capacity: parseInt(data.capacity, 10) || 2000,
        priority: parseInt(data.priority, 10) || 0,
        status: data.status,
        notes: data.notes || undefined,
      };
      const url = editing ? `${API}/admin/distribution-masters/${editing.id}` : `${API}/admin/distribution-masters`;
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({ error: "Error" })) as { error?: string }).error ?? "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: editing ? "Master updated" : "Master created" });
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      void qc.invalidateQueries({ queryKey: ["distribution-masters"] });
    },
    onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API}/admin/distribution-masters/${id}`, { method: "DELETE", headers });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Error" })) as { error?: string };
        throw new Error(err.error ?? "Delete failed");
      }
    },
    onSuccess: () => {
      toast({ title: "Master deleted" });
      void qc.invalidateQueries({ queryKey: ["distribution-masters"] });
    },
    onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(m: DistributionMaster) {
    setEditing(m);
    setForm({
      name: m.name,
      metaapiAccountId: m.metaapiAccountId ?? "",
      strategyId: m.strategyId ?? "",
      broker: m.broker ?? "",
      server: m.server ?? "",
      capacity: String(m.capacity),
      priority: String(m.priority),
      status: m.status,
      notes: m.notes ?? "",
    });
    setShowForm(true);
  }

  const f = (k: keyof MasterFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Server className="h-6 w-6 text-blue-400" />
              Distribution Masters
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage the scalable layer between the Trading Master and subscriber groups
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Master
          </Button>
        </div>

        {/* Analytics Summary */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Capacity", value: analytics.totalCapacity.toLocaleString(), icon: <Server className="h-4 w-4 text-blue-400" /> },
              { label: "Total Load", value: analytics.totalCurrentLoad.toLocaleString(), icon: <Users className="h-4 w-4 text-purple-400" /> },
              { label: "Masters Online", value: `${analytics.onlineMasters}/${analytics.totalMasters}`, icon: <Activity className="h-4 w-4 text-green-400" /> },
              { label: "Avg Utilisation", value: `${analytics.averageLoadPercent}%`, icon: <BarChart3 className="h-4 w-4 text-yellow-400" /> },
              { label: "Health", value: `${analytics.masterHealthPercent}%`, icon: <CheckCircle2 className="h-4 w-4 text-green-400" /> },
              { label: "Rep. Success", value: `${analytics.replicationSuccessRate}%`, icon: <Zap className="h-4 w-4 text-cyan-400" /> },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 mb-1">
                    {s.icon}
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <p className="text-xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Masters Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" /> Distribution Masters
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                Auto-refreshes every 15 s
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              </div>
            ) : masters.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Server className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No Distribution Masters yet. Add one to start scaling.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="text-left pb-3 pr-4">Name</th>
                      <th className="text-left pb-3 pr-4">Status</th>
                      <th className="text-left pb-3 pr-4">Utilisation</th>
                      <th className="text-left pb-3 pr-4">Latency</th>
                      <th className="text-left pb-3 pr-4">Broker</th>
                      <th className="text-left pb-3 pr-4">Strategy</th>
                      <th className="text-left pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {masters.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="font-medium">{m.name}</div>
                          {m.notes && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{m.notes}</div>}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(m.status)}`}>
                            <StatusIcon status={m.status} />
                            {m.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 min-w-[140px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">{m.currentLoad.toLocaleString()} / {m.capacity.toLocaleString()}</span>
                            <span className={`text-xs font-semibold ${m.utilizationPercent >= 90 ? "text-red-400" : m.utilizationPercent >= 70 ? "text-yellow-400" : "text-green-400"}`}>
                              {m.utilizationPercent}%
                            </span>
                          </div>
                          <UtilBar percent={m.utilizationPercent} />
                        </td>
                        <td className="py-3 pr-4">
                          {m.latencyMs != null ? (
                            <span className={`text-xs font-mono ${m.latencyMs > 500 ? "text-red-400" : m.latencyMs > 200 ? "text-yellow-400" : "text-green-400"}`}>
                              {m.latencyMs}ms
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs">{m.broker ?? "—"}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-xs font-mono truncate max-w-[100px] block" title={m.strategyId ?? ""}>
                            {m.strategyId ? m.strategyId.slice(0, 8) + "…" : "—"}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEdit(m)}>
                              <Settings className="h-3 w-3 mr-1" /> Edit
                            </Button>
                            {m.status !== "ONLINE" && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-green-400" onClick={() => callAction(m.id, "reconnect", "Reconnect")}>
                                <RefreshCw className="h-3 w-3 mr-1" /> Online
                              </Button>
                            )}
                            {m.status === "ONLINE" && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-yellow-400" onClick={() => callAction(m.id, "maintenance", "Maintenance")}>
                                <Wrench className="h-3 w-3 mr-1" /> Maint.
                              </Button>
                            )}
                            {m.status !== "DISABLED" && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-gray-400" onClick={() => callAction(m.id, "disable", "Disable")}>
                                <Power className="h-3 w-3 mr-1" /> Disable
                              </Button>
                            )}
                            {m.failedReplications > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-orange-400">
                                <AlertTriangle className="h-3 w-3" /> {m.failedReplications} rep. fail
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Analytics */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-400" /> Subscriber Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  ["Active Subscribers", analytics.activeSubscribers.toLocaleString()],
                  ["Free Trial", analytics.freeTrialSubscribers?.toLocaleString() ?? "—"],
                  ["Total Slave Accounts", analytics.totalSlaveAccounts.toLocaleString()],
                  ["Daily New Users", (analytics.newUsersToday ?? analytics.dailyNewUsers ?? 0).toLocaleString()],
                  ["Conversion Rate", `${analytics.conversionRate}%`],
                  ["Monthly Revenue", `KES ${analytics.monthlyRevenue.toLocaleString()}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-400" /> Replication &amp; Load
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  ["Avg Load", `${analytics.averageLoadPercent}%`],
                  ["Highest Load", `${analytics.highestLoadPercent}%`],
                  ["Lowest Load", `${analytics.lowestLoadPercent}%`],
                  ["Failed Replications", analytics.failedReplications.toLocaleString()],
                  ["Rep. Success Rate", `${analytics.replicationSuccessRate}%`],
                  ["Master Health", `${analytics.masterHealthPercent}%`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit — ${editing.name}` : "Add Distribution Master"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <Label className="text-xs">Name *</Label>
              <Input className="mt-1" value={form.name} onChange={f("name")} placeholder="e.g. Distribution Master A" />
            </div>
            <div>
              <Label className="text-xs">MetaApi Account ID</Label>
              <Input className="mt-1 font-mono text-xs" value={form.metaapiAccountId} onChange={f("metaapiAccountId")} placeholder="xxxxxxxx-xxxx-…" />
            </div>
            <div>
              <Label className="text-xs">CopyFactory Strategy ID</Label>
              <Input className="mt-1 font-mono text-xs" value={form.strategyId} onChange={f("strategyId")} placeholder="xxxxxxxx-xxxx-…" />
            </div>
            <div>
              <Label className="text-xs">Broker</Label>
              <Input className="mt-1" value={form.broker} onChange={f("broker")} placeholder="e.g. Exness" />
            </div>
            <div>
              <Label className="text-xs">Server</Label>
              <Input className="mt-1" value={form.server} onChange={f("server")} placeholder="e.g. Exness-Real8" />
            </div>
            <div>
              <Label className="text-xs">Capacity</Label>
              <Input className="mt-1" type="number" value={form.capacity} onChange={f("capacity")} min={1} />
            </div>
            <div>
              <Label className="text-xs">Priority (lower = preferred)</Label>
              <Input className="mt-1" type="number" value={form.priority} onChange={f("priority")} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Initial Status</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.status}
                onChange={f("status")}
              >
                {["ONLINE", "OFFLINE", "MAINTENANCE", "DISABLED"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input className="mt-1" value={form.notes} onChange={f("notes")} placeholder="Internal notes (optional)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : editing ? "Save Changes" : "Create Master"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
