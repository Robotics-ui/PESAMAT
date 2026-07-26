import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet, ChevronRight, CheckCircle2, Clock, XCircle, AlertCircle,
  Loader2, TrendingUp, Shield, Users, Award, FileText, ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface FundingPublicSettings {
  applicationFee: number;
  maxFundingAccounts: number;
  fundingEnabled: boolean;
  availableSlots: number;
  activeApplications: number;
  approvedOrFundedCount: number;
}

interface FundingApplication {
  id: number;
  status: string;
  paymentStatus: string;
  fullName: string;
  email: string;
  applicationFee: number;
  mpesaReceipt: string | null;
  adminNotes: string | null;
  createdAt: string;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_payment: { label: "Pending Payment", color: "text-yellow-400", icon: Clock },
  submitted: { label: "Under Review", color: "text-blue-400", icon: FileText },
  under_review: { label: "Under Review", color: "text-blue-400", icon: FileText },
  approved: { label: "Approved", color: "text-green-400", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "text-red-400", icon: XCircle },
  funded: { label: "Funded", color: "text-green-400", icon: Award },
};

const TRADING_EXPERIENCE_OPTIONS = [
  "Less than 1 year",
  "1–2 years",
  "2–5 years",
  "5–10 years",
  "More than 10 years",
];

const COUNTRIES = [
  "Kenya", "Uganda", "Tanzania", "Nigeria", "Ghana", "South Africa",
  "Rwanda", "Ethiopia", "Other",
];

const EMPTY_FORM = {
  fullName: "", email: "", phone: "", country: "", tradingExperience: "",
  brokerName: "", mt5AccountNumber: "", accountType: "Demo" as "Demo" | "Live",
  tradingStrategy: "", additionalNotes: "",
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "text-muted-foreground", icon: Clock };
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-medium text-sm", meta.color)}>
      <Icon className="h-4 w-4" />
      {meta.label}
    </span>
  );
}

export default function AccountFundingPage() {
  const { token, user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [view, setView] = useState<"intro" | "form" | "payment" | "done">("intro");
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [pendingAppId, setPendingAppId] = useState<number | null>(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !token) navigate("/login");
  }, [authLoading, token, navigate]);

  const { data: settings, isLoading: settingsLoading } = useQuery<FundingPublicSettings>({
    queryKey: ["funding-settings-public"],
    queryFn: async () => {
      const res = await fetch("/api/funding/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: myApps, refetch: refetchApps } = useQuery<FundingApplication[]>({
    queryKey: ["my-funding-applications"],
    queryFn: async () => {
      const res = await fetch("/api/funding/applications/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load applications");
      return res.json();
    },
    enabled: !!token,
  });

  // Active application = not rejected/failed
  const activeApp = myApps?.find((a) => !["rejected"].includes(a.status));
  const hasActive = !!activeApp;

  // Poll payment status while pending
  const pollPaymentStatus = useCallback(async () => {
    if (!pendingAppId || !token) return;
    try {
      const res = await fetch(`/api/funding/applications/${pendingAppId}/payment-verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { paymentStatus: string; status: string };
      if (data.paymentStatus === "completed") {
        setView("done");
        setPendingAppId(null);
        refetchApps();
      } else if (data.paymentStatus === "failed") {
        toast({ title: "Payment failed", description: "The M-Pesa payment was not completed.", variant: "destructive" });
        setView("intro");
        setPendingAppId(null);
        refetchApps();
      }
    } catch {
      // ignore
    }
  }, [pendingAppId, token, toast, refetchApps]);

  useEffect(() => {
    if (view !== "payment" || !pendingAppId) return;
    const id = setInterval(() => {
      setPollCount((c) => c + 1);
    }, 3500);
    return () => clearInterval(id);
  }, [view, pendingAppId]);

  useEffect(() => {
    if (pollCount > 0) pollPaymentStatus();
  }, [pollCount, pollPaymentStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/funding/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { applicationId?: number; status?: string; demo?: boolean; error?: string };
      if (!res.ok) {
        toast({ title: "Error", description: data.error ?? "Submission failed", variant: "destructive" });
        return;
      }
      if (data.status === "submitted" || data.demo) {
        setView("done");
        refetchApps();
      } else {
        setPendingAppId(data.applicationId!);
        setView("payment");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const setField = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (authLoading || settingsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-6 w-6 text-blue-500" />
            Account Funding
          </h1>
          <p className="text-muted-foreground mt-1">Apply for a funded trading account through the PesaMatrix program.</p>
        </div>

        {/* Existing active application */}
        {hasActive && activeApp && (
          <Card className="border-blue-600/30 bg-blue-600/5">
            <CardHeader>
              <CardTitle className="text-base">Your Application</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Application ID</span>
                <span className="text-sm font-mono font-medium">#{activeApp.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusBadge status={activeApp.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Fee Paid</span>
                <span className="text-sm font-medium">KES {activeApp.applicationFee.toLocaleString()}</span>
              </div>
              {activeApp.mpesaReceipt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Receipt</span>
                  <span className="text-sm font-mono">{activeApp.mpesaReceipt}</span>
                </div>
              )}
              {activeApp.adminNotes && (
                <div className="rounded-lg bg-muted/40 border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Admin Notes</p>
                  <p className="text-sm">{activeApp.adminNotes}</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Submitted</span>
                <span className="text-sm">{new Date(activeApp.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Funding disabled */}
        {!settings?.fundingEnabled && !hasActive && (
          <Card className="border-yellow-600/30 bg-yellow-600/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-yellow-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">Funding applications are currently closed. Check back soon.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No available slots */}
        {settings?.fundingEnabled && (settings?.availableSlots ?? 0) === 0 && !hasActive && (
          <Card className="border-yellow-600/30 bg-yellow-600/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-yellow-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">All funding slots are currently filled. No new applications are being accepted.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Intro section */}
        {!hasActive && settings?.fundingEnabled && (settings?.availableSlots ?? 0) > 0 && view === "intro" && (
          <>
            {/* Live funding summary */}
            <Card className="border-border">
              <CardContent className="pt-5 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
                  <div className="pb-4 sm:pb-0 sm:pr-6 flex flex-col gap-0.5">
                    <p className="text-xs text-muted-foreground">Application Fee</p>
                    <p className="text-xl font-bold text-foreground">KES {settings.applicationFee.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Paid via M-Pesa, non-refundable</p>
                  </div>
                  <div className="py-4 sm:py-0 sm:px-6 flex flex-col gap-0.5">
                    <p className="text-xs text-muted-foreground">Total Funding Slots</p>
                    <p className="text-xl font-bold text-foreground">{settings.maxFundingAccounts}</p>
                    <p className="text-xs text-muted-foreground">{settings.approvedOrFundedCount} approved / funded</p>
                  </div>
                  <div className="pt-4 sm:pt-0 sm:pl-6 flex flex-col gap-0.5">
                    <p className="text-xs text-muted-foreground">Remaining Slots</p>
                    <p className="text-xl font-bold text-green-400">{settings.availableSlots}</p>
                    <p className="text-xs text-muted-foreground">Available now</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <Link href="/funding-terms" className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    View full Terms &amp; Conditions
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Program info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-5 pb-4 flex flex-col items-center text-center gap-2">
                  <TrendingUp className="h-7 w-7 text-blue-500" />
                  <p className="text-sm font-semibold text-foreground">Trade with Our Capital</p>
                  <p className="text-xs text-muted-foreground">Get a funded MT5 account and keep a share of the profits.</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-5 pb-4 flex flex-col items-center text-center gap-2">
                  <Shield className="h-7 w-7 text-green-500" />
                  <p className="text-sm font-semibold text-foreground">Risk Management</p>
                  <p className="text-xs text-muted-foreground">Follow our rules — max drawdown limits, lot sizing, and no overnight grid positions.</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-5 pb-4 flex flex-col items-center text-center gap-2">
                  <Users className="h-7 w-7 text-blue-500" />
                  <p className="text-sm font-semibold text-foreground">Limited Slots</p>
                  <p className="text-xs text-muted-foreground">{settings.availableSlots} of {settings.maxFundingAccounts} slots available.</p>
                </CardContent>
              </Card>
            </div>

            {/* Eligibility & Rules */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Eligibility Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  "Must have an active PesaMatrix subscription",
                  "Minimum 1 year of verifiable trading experience",
                  "Must not have an existing active funded account",
                  "Must have a valid MT4/MT5 trading account",
                  "Comply with all platform risk management rules",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  Terms &amp; Rules
                  <Link href="/funding-terms" className="text-xs font-normal text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    Full T&amp;C
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  `The application fee of KES ${settings.applicationFee?.toLocaleString() ?? "—"} is non-refundable.`,
                  "Funded accounts are subject to a maximum drawdown limit of 10%.",
                  "Profit splits are agreed upon approval and vary by account tier.",
                  "Violations of risk rules may result in immediate account suspension.",
                  "PesaMatrix reserves the right to reject any application without reason.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* CTA */}
            <Card className="border-blue-600/30 bg-blue-600/5">
              <CardContent className="pt-5 pb-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Ready to apply?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Application fee: <span className="font-medium text-foreground">KES {settings.applicationFee?.toLocaleString()}</span> (paid via M-Pesa)
                    </p>
                  </div>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white shrink-0" onClick={() => setView("form")}>
                    Apply Now
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Application Form */}
        {!hasActive && view === "form" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funding Application Form</CardTitle>
              <CardDescription>
                Fill in your details below. You will be prompted to pay the KES {settings?.applicationFee?.toLocaleString()} application fee via M-Pesa after submitting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} placeholder="John Doe" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email Address</Label>
                    <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="you@example.com" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone Number (M-Pesa)</Label>
                    <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="0712345678" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Country</Label>
                    <Select value={form.country} onValueChange={(v) => setField("country", v)} required>
                      <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Trading Experience</Label>
                    <Select value={form.tradingExperience} onValueChange={(v) => setField("tradingExperience", v)} required>
                      <SelectTrigger><SelectValue placeholder="Select experience" /></SelectTrigger>
                      <SelectContent>
                        {TRADING_EXPERIENCE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Broker Name</Label>
                    <Input value={form.brokerName} onChange={(e) => setField("brokerName", e.target.value)} placeholder="e.g. Exness" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>MT4/MT5 Account Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input value={form.mt5AccountNumber} onChange={(e) => setField("mt5AccountNumber", e.target.value)} placeholder="e.g. 12345678" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Account Type</Label>
                    <Select value={form.accountType} onValueChange={(v) => setField("accountType", v as "Demo" | "Live")} required>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Demo">Demo</SelectItem>
                        <SelectItem value="Live">Live</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Trading Strategy</Label>
                  <Textarea
                    value={form.tradingStrategy}
                    onChange={(e) => setField("tradingStrategy", e.target.value)}
                    placeholder="Describe your trading strategy (e.g. scalping on EUR/USD using EMA crossovers...)"
                    rows={3}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Additional Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea
                    value={form.additionalNotes}
                    onChange={(e) => setField("additionalNotes", e.target.value)}
                    placeholder="Anything else you'd like us to know..."
                    rows={2}
                  />
                </div>
                <div className="rounded-lg bg-yellow-600/10 border border-yellow-600/30 p-3 text-sm text-yellow-300">
                  By submitting, you agree to pay a non-refundable application fee of <strong>KES {settings?.applicationFee?.toLocaleString()}</strong> via M-Pesa to the phone number above.
                </div>
                <div className="flex gap-3 pt-1">
                  <Button type="button" variant="outline" onClick={() => setView("intro")}>Back</Button>
                  <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {submitting ? "Processing..." : `Submit & Pay KES ${settings?.applicationFee?.toLocaleString()}`}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Payment polling */}
        {view === "payment" && (
          <Card className="border-blue-600/30 bg-blue-600/5">
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              <div>
                <p className="font-semibold text-foreground">Check your phone for the M-Pesa prompt</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your M-Pesa PIN to pay <strong className="text-foreground">KES {settings?.applicationFee?.toLocaleString()}</strong>. We will confirm automatically.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Waiting for payment confirmation...</p>
            </CardContent>
          </Card>
        )}

        {/* Success */}
        {view === "done" && (
          <Card className="border-green-600/30 bg-green-600/5">
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div>
                <p className="text-lg font-bold text-foreground">Application Submitted!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your payment was confirmed and your application is now under review. We will notify you via SMS once a decision is made.
                </p>
              </div>
              <Button variant="outline" onClick={() => refetchApps()}>View My Application</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
