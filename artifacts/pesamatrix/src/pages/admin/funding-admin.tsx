import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Wallet, Search, RefreshCw, Download, Eye, CheckCircle2, XCircle,
  Clock, FileText, Award, AlertCircle, Loader2, TrendingUp, Users,
  Shield, Zap, EyeOff,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FundingSettings {
  id: number;
  applicationFee: number;
  maxFundingAccounts: number;
  fundingEnabled: boolean;
}

interface FundingStats {
  totalApplications: number;
  submitted: number;
  underReview: number;
  approved: number;
  rejected: number;
  funded: number;
  approvedOrFunded: number;
  availableSlots: number;
  maxFundingAccounts: number;
  totalFeeRevenue: number;
}

interface FundingApplication {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  tradingExperience: string;
  brokerName: string;
  mt5AccountNumber: string | null;
  accountType: string;
  tradingStrategy: string;
  additionalNotes: string | null;
  applicationFee: number;
  checkoutRequestId: string | null;
  mpesaReceipt: string | null;
  paymentStatus: string;
  mt5VerificationStatus: string;
  mt5Server: string | null;
  mt5VerificationDate: string | null;
  mt5VerificationResult: string | null;
  mt5VerificationAttempts: number;
  status: string;
  adminNotes: string | null;
  reviewedAt: string | null;
  activatedAt: string | null;
  linkedSlaveAccountId: number | null;
  createdAt: string;
}

interface ApplicationsResponse {
  applications: FundingApplication[];
  total: number;
  page: number;
  pages: number;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "verification_pending", label: "MT5 Verification Required" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "funded", label: "Funded" },
];

const ADMIN_STATUS_OPTIONS = [
  { value: "verification_pending", label: "MT5 Verification Required" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "funded", label: "Funded" },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending_payment: { label: "Pending Payment", className: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30" },
  submitted: { label: "Submitted", className: "bg-blue-600/20 text-blue-400 border-blue-600/30" },
  under_review: { label: "Under Review", className: "bg-blue-600/20 text-blue-400 border-blue-600/30" },
  approved: { label: "Approved", className: "bg-green-600/20 text-green-400 border-green-600/30" },
  rejected: { label: "Rejected", className: "bg-red-600/20 text-red-400 border-red-600/30" },
  funded: { label: "Funded", className: "bg-green-600/20 text-green-400 border-green-600/30" },
};

async function apiFetch(path: string, token: string, opts?: RequestInit) {
  const res = await fetch("/api" + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function StatCard({ icon: Icon, label, value, color = "text-foreground" }: {
  icon: React.ElementType; label: string; value: number | string; color?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold mt-1", color)}>{value}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center">
            <Icon className={cn("h-5 w-5", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivateDialog({
  app, token, onClose,
}: { app: FundingApplication; token: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({
    mt5Login: app.mt5AccountNumber ?? "",
    server: "",
    tradingPassword: "",
    metaapiRegion: "",
  });

  const activateMutation = useMutation({
    mutationFn: async () =>
      apiFetch(`/admin/funding/applications/${app.id}/activate`, token, {
        method: "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast({ title: "Funded account activated", description: "Slave account created successfully." });
      qc.invalidateQueries({ queryKey: ["admin-funding-applications"] });
      qc.invalidateQueries({ queryKey: ["admin-funding-stats"] });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Activation failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-400" />
            Activate Funded Account #{app.id}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
            Creating a slave account for <span className="font-medium text-foreground">{app.fullName}</span> ({app.email}).
            This will count toward the 2,000-account platform capacity.
          </div>
          <div className="space-y-1.5">
            <Label>MT5 Login</Label>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.mt5Login}
              onChange={(e) => setForm((f) => ({ ...f, mt5Login: e.target.value }))}
              placeholder="e.g. 12345678"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Broker</Label>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={app.brokerName}
              disabled
            />
          </div>
          <div className="space-y-1.5">
            <Label>MT5 Server <span className="text-red-400">*</span></Label>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.server}
              onChange={(e) => setForm((f) => ({ ...f, server: e.target.value }))}
              placeholder="e.g. ExnessReal2-Server"
              required
            />
          </div>
          <div className="space-y-1.5">
             <Label>Trading Password <span className="text-red-400">*</span></Label>
            <div className="relative">
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-10 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                type={showPwd ? "text" : "password"}
                value={form.tradingPassword}
                onChange={(e) => setForm((f) => ({ ...f, tradingPassword: e.target.value }))}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
             <p className="text-xs text-muted-foreground">
               This is the trading password for the funded slave account. The applicant's investor password is never reused here.
             </p>
          </div>
          <div className="space-y-1.5">
            <Label>MetaApi Region <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={form.metaapiRegion}
              onChange={(e) => setForm((f) => ({ ...f, metaapiRegion: e.target.value }))}
              placeholder="e.g. new-york"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={activateMutation.isPending || !form.server || !form.tradingPassword}
            onClick={() => activateMutation.mutate()}
          >
            {activateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Zap className="h-4 w-4 mr-1" />
            Activate Slave Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplicationDialog({
  app, token, onClose,
}: { app: FundingApplication; token: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState(app.status);
  const [adminNotes, setAdminNotes] = useState(app.adminNotes ?? "");

  const updateMutation = useMutation({
    mutationFn: async (data: { status?: string; adminNotes?: string }) =>
      apiFetch(`/admin/funding/applications/${app.id}`, token, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: "Application updated" });
      qc.invalidateQueries({ queryKey: ["admin-funding-applications"] });
      qc.invalidateQueries({ queryKey: ["admin-funding-stats"] });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const badgeMeta = STATUS_BADGE[app.status] ?? { label: app.status, className: "" };
  const approvalRequirementsMet = app.paymentStatus === "completed" && app.mt5VerificationStatus === "verified";
  const fundedTransitionBlocked = status === "funded" && (
    app.status !== "approved" || !approvalRequirementsMet
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Application #{app.id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Applicant details */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[
              ["Full Name", app.fullName],
              ["Email", app.email],
              ["Phone", app.phone],
              ["Country", app.country],
              ["Experience", app.tradingExperience],
              ["Broker", app.brokerName],
              ["MT5 Account", app.mt5AccountNumber ?? "—"],
              ["Account Type", app.accountType],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-medium">{val}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Trading Strategy</p>
            <div className="rounded-lg bg-muted/40 p-3 text-sm">{app.tradingStrategy}</div>
          </div>

          {app.additionalNotes && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Additional Notes</p>
              <div className="rounded-lg bg-muted/40 p-3 text-sm">{app.additionalNotes}</div>
            </div>
          )}

          {/* Payment info */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-border pt-4">
            <div>
              <p className="text-xs text-muted-foreground">Fee</p>
              <p className="font-medium">KES {app.applicationFee.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payment Status</p>
              <p className={cn("font-medium", app.paymentStatus === "completed" ? "text-green-400" : "text-yellow-400")}>{app.paymentStatus}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">MT5 Verification Status</p>
              <p className={cn("font-medium", app.mt5VerificationStatus === "verified" ? "text-green-400" : app.mt5VerificationStatus === "failed" ? "text-red-400" : "text-yellow-400")}>
                {app.mt5VerificationStatus}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">MT5 Server</p>
              <p className="font-medium">{app.mt5Server ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Verification Date</p>
              <p>{app.mt5VerificationDate ? new Date(app.mt5VerificationDate).toLocaleString() : "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Verification Result</p>
              <p className={cn("font-medium", app.mt5VerificationStatus === "verified" ? "text-green-400" : "text-red-400")}>{app.mt5VerificationResult ?? "Not verified yet"}</p>
            </div>
            {app.mpesaReceipt && (
              <div>
                <p className="text-xs text-muted-foreground">M-Pesa Receipt</p>
                <p className="font-mono text-sm">{app.mpesaReceipt}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Current Status</p>
              <Badge className={cn("text-xs border", badgeMeta.className)}>{badgeMeta.label}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Submitted</p>
              <p>{new Date(app.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Admin controls */}
          <div className="border-t border-border pt-4 space-y-3">
             {status === "approved" && !approvalRequirementsMet && (
              <div className="rounded-lg bg-yellow-600/10 border border-yellow-600/30 p-3 text-sm text-yellow-300">
                Approval is locked until payment is confirmed and MT5 verification succeeds.
              </div>
            )}
             {fundedTransitionBlocked && (
               <div className="rounded-lg bg-yellow-600/10 border border-yellow-600/30 p-3 text-sm text-yellow-300">
                 Funding is locked until this application is approved after payment and MT5 verification.
               </div>
             )}
            <div className="space-y-1.5">
              <Label>Update Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_STATUS_OPTIONS.map((o) => (
                   <SelectItem
                     key={o.value}
                     value={o.value}
                     disabled={o.value === "approved" && !approvalRequirementsMet || o.value === "funded" && (app.status !== "approved" || !approvalRequirementsMet)}
                   >
                     {o.label}
                   </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Admin Notes</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add internal notes visible to admins only..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
             disabled={updateMutation.isPending || (status === "approved" && !approvalRequirementsMet) || fundedTransitionBlocked}
            onClick={() => updateMutation.mutate({ status: status !== app.status ? status : undefined, adminNotes })}
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FundingAdminPage() {
  const { token, user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedApp, setSelectedApp] = useState<FundingApplication | null>(null);
  const [activateApp, setActivateApp] = useState<FundingApplication | null>(null);
  const [settingsForm, setSettingsForm] = useState<Partial<FundingSettings> | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  if (!isLoading && (!token || user?.role !== "admin")) {
    navigate("/dashboard");
    return null;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: stats, refetch: refetchStats } = useQuery<FundingStats>({
    queryKey: ["admin-funding-stats"],
    queryFn: () => apiFetch("/admin/funding/stats", token!),
    enabled: !!token,
  });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: settings, refetch: refetchSettings } = useQuery<FundingSettings>({
    queryKey: ["admin-funding-settings"],
    queryFn: async () => {
      const data = await apiFetch("/admin/funding/settings", token!);
      setSettingsForm(data);
      return data;
    },
    enabled: !!token,
  });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: appsData, isLoading: appsLoading, refetch: refetchApps } = useQuery<ApplicationsResponse>({
    queryKey: ["admin-funding-applications", statusFilter, search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      return apiFetch(`/admin/funding/applications?${params}`, token!);
    },
    enabled: !!token,
  });

  const handleSaveSettings = async () => {
    if (!settingsForm) return;
    setSavingSettings(true);
    try {
      await apiFetch("/admin/funding/settings", token!, {
        method: "PATCH",
        body: JSON.stringify({
          applicationFee: settingsForm.applicationFee,
          maxFundingAccounts: settingsForm.maxFundingAccounts,
          fundingEnabled: settingsForm.fundingEnabled,
        }),
      });
      toast({ title: "Settings saved" });
      qc.invalidateQueries({ queryKey: ["admin-funding-settings"] });
      refetchStats();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/admin/funding/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { toast({ title: "Export failed", variant: "destructive" }); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `funding-applications-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="h-6 w-6 text-green-500" />
              Account Funding Admin
            </h1>
            <p className="text-muted-foreground mt-1">Manage funded trader applications and program settings.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { refetchStats(); refetchApps(); refetchSettings(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats grid */}
        {stats && (
          <>
            {/* Slot summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="bg-card border-border">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground">Total Slots</p>
                  <p className="text-3xl font-bold mt-1 text-foreground">{stats.maxFundingAccounts}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground">Approved / Funded</p>
                  <p className="text-3xl font-bold mt-1 text-green-400">{stats.approvedOrFunded}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stats.approved} approved, {stats.funded} funded</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground">Remaining Slots</p>
                  <p className={`text-3xl font-bold mt-1 ${stats.availableSlots === 0 ? "text-red-400" : "text-blue-400"}`}>{stats.availableSlots}</p>
                  {stats.availableSlots === 0 && (
                    <p className="text-xs text-red-400 mt-0.5">All slots filled — applications closed</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Application breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard icon={FileText} label="Total Applications" value={stats.totalApplications} />
              <StatCard icon={Clock} label="Under Review" value={stats.underReview} color="text-blue-400" />
              <StatCard icon={CheckCircle2} label="Approved" value={stats.approved} color="text-green-400" />
              <StatCard icon={XCircle} label="Rejected" value={stats.rejected} color="text-red-400" />
              <StatCard icon={TrendingUp} label="Fee Revenue (KES)" value={stats.totalFeeRevenue.toLocaleString()} color="text-blue-400" />
            </div>
          </>
        )}

        <Tabs defaultValue="applications">
          <TabsList className="mb-4">
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="settings">Program Settings</TabsTrigger>
          </TabsList>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 w-64"
                  placeholder="Search name, email, phone..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {appsData && (
                <p className="text-sm text-muted-foreground ml-auto">
                  {appsData.total} application{appsData.total !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Table */}
            <Card className="border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                       {["#", "Name", "Email", "Phone", "Broker", "MT5 Account", "Server", "Verification", "Status", "Payment", "Fee", "Date", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {appsLoading ? (
                      <tr>
                         <td colSpan={13} className="px-4 py-10 text-center text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : appsData?.applications.length === 0 ? (
                      <tr>
                         <td colSpan={13} className="px-4 py-10 text-center text-muted-foreground">
                          No applications found
                        </td>
                      </tr>
                    ) : (
                      appsData?.applications.map((app) => {
                        const badge = STATUS_BADGE[app.status] ?? { label: app.status, className: "" };
                        return (
                          <tr key={app.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-mono text-muted-foreground text-xs">#{app.id}</td>
                            <td className="px-4 py-3 font-medium whitespace-nowrap">{app.fullName}</td>
                            <td className="px-4 py-3 text-muted-foreground">{app.email}</td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{app.phone}</td>
                             <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{app.brokerName || "—"}</td>
                             <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{app.mt5AccountNumber ?? "—"}</td>
                             <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{app.mt5Server ?? "—"}</td>
                             <td className="px-4 py-3 whitespace-nowrap">
                               <span className={cn("text-xs font-medium", app.mt5VerificationStatus === "verified" ? "text-green-400" : app.mt5VerificationStatus === "failed" ? "text-red-400" : "text-yellow-400")}>
                                 {app.mt5VerificationStatus}
                               </span>
                             </td>
                            <td className="px-4 py-3">
                              <Badge className={cn("text-xs border whitespace-nowrap", badge.className)}>{badge.label}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn("text-xs font-medium", app.paymentStatus === "completed" ? "text-green-400" : app.paymentStatus === "failed" ? "text-red-400" : "text-yellow-400")}>
                                {app.paymentStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">KES {app.applicationFee.toLocaleString()}</td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                              {new Date(app.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setSelectedApp(app)} className="h-7 px-2">
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  Review
                                </Button>
                                {app.status === "funded" && !app.linkedSlaveAccountId && (
                                  <Button size="sm" variant="ghost" onClick={() => setActivateApp(app)} className="h-7 px-2 text-green-400 hover:text-green-300">
                                    <Zap className="h-3.5 w-3.5 mr-1" />
                                    Activate
                                  </Button>
                                )}
                                {app.linkedSlaveAccountId && (
                                  <span className="text-xs text-green-400 flex items-center gap-1 whitespace-nowrap">
                                    <CheckCircle2 className="h-3 w-3" /> Activated
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {appsData && appsData.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">Page {appsData.page} of {appsData.pages}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={page >= appsData.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  Program Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {settingsForm ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>Application Fee (KES)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={settingsForm.applicationFee ?? ""}
                        onChange={(e) => setSettingsForm((f) => f ? { ...f, applicationFee: parseFloat(e.target.value) } : f)}
                      />
                      <p className="text-xs text-muted-foreground">Non-refundable fee paid by applicants via M-Pesa.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Maximum Funded Accounts</Label>
                      <Input
                        type="number"
                        min={0}
                        value={settingsForm.maxFundingAccounts ?? ""}
                        onChange={(e) => setSettingsForm((f) => f ? { ...f, maxFundingAccounts: parseInt(e.target.value, 10) } : f)}
                      />
                      <p className="text-xs text-muted-foreground">Total number of traders that can be funded at once.</p>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <p className="text-sm font-medium">Accept Applications</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {settingsForm.fundingEnabled ? "Applications are currently open." : "Applications are currently closed."}
                        </p>
                      </div>
                      <Switch
                        checked={settingsForm.fundingEnabled ?? true}
                        onCheckedChange={(v) => setSettingsForm((f) => f ? { ...f, fundingEnabled: v } : f)}
                      />
                    </div>
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white w-full"
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                    >
                      {savingSettings && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Save Settings
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      {selectedApp && (
        <ApplicationDialog
          app={selectedApp}
          token={token!}
          onClose={() => setSelectedApp(null)}
        />
      )}

      {/* Activate Dialog */}
      {activateApp && (
        <ActivateDialog
          app={activateApp}
          token={token!}
          onClose={() => setActivateApp(null)}
        />
      )}
    </AppLayout>
  );
}
