import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { FileText, ChevronRight, Loader2, AlertCircle, TrendingUp } from "lucide-react";
import { Link } from "wouter";

interface FundingPublicSettings {
  applicationFee: number;
  maxFundingAccounts: number;
  fundingEnabled: boolean;
  availableSlots: number;
  approvedOrFundedCount: number;
}

export default function FundingTermsPage() {
  const { data: settings, isLoading, isError } = useQuery<FundingPublicSettings>({
    queryKey: ["funding-settings-public"],
    queryFn: async () => {
      const res = await fetch("/api/funding/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Simple public nav */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-foreground hover:text-blue-400 transition-colors">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-wide">PESAMATRIX</span>
          </Link>
          <Link href="/account-funding" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            Apply for Funding
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-500" />
            Account Funding — Terms &amp; Conditions
          </h1>
          <p className="text-muted-foreground mt-1">
            Read and understand the terms of the PesaMatrix Account Funding Programme before applying.
          </p>
        </div>

        {/* Live funding summary */}
        <Card className="border-blue-600/30 bg-blue-600/5">
          <CardHeader>
            <CardTitle className="text-base">Current Programme Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading live values…
              </div>
            ) : isError ? (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                Could not load live values. Please refresh.
              </div>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="rounded-lg bg-muted/40 border border-border p-4 text-center">
                  <dt className="text-xs text-muted-foreground mb-1">Application Fee</dt>
                  <dd className="text-lg font-bold text-foreground">
                    KES {settings?.applicationFee?.toLocaleString() ?? "—"}
                  </dd>
                </div>
                <div className="rounded-lg bg-muted/40 border border-border p-4 text-center">
                  <dt className="text-xs text-muted-foreground mb-1">Total Funding Slots</dt>
                  <dd className="text-lg font-bold text-foreground">
                    {settings?.maxFundingAccounts ?? "—"}
                  </dd>
                </div>
                <div className="rounded-lg bg-muted/40 border border-border p-4 text-center">
                  <dt className="text-xs text-muted-foreground mb-1">Remaining Slots</dt>
                  <dd className={`text-lg font-bold ${(settings?.availableSlots ?? 0) === 0 ? "text-red-400" : "text-green-400"}`}>
                    {settings?.availableSlots ?? "—"}
                  </dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Fees & Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fees &amp; Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              `The application fee of KES ${settings?.applicationFee?.toLocaleString() ?? "—"} is non-refundable, regardless of the outcome of your application.`,
              "Payment is made via M-Pesa STK Push at the time of application submission.",
              "Receipts are issued immediately upon successful payment confirmation.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Slot Allocation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Slot Allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              `The programme has a total of ${settings?.maxFundingAccounts ?? "—"} funded account slots.`,
              `Currently ${settings?.approvedOrFundedCount ?? "—"} slot${(settings?.approvedOrFundedCount ?? 0) !== 1 ? "s have" : " has"} been allocated (approved or funded).`,
              `There are ${settings?.availableSlots ?? "—"} remaining slot${(settings?.availableSlots ?? 0) !== 1 ? "s" : ""} available.`,
              "Applications are automatically closed when all slots are filled. No new applications will be accepted until a slot becomes available.",
              "PesaMatrix reserves the right to adjust the total number of slots at any time.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Risk Management Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Management Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              "Funded accounts are subject to a maximum drawdown limit of 10% of the initial account balance.",
              "Overnight grid positions and high-risk martingale strategies are strictly prohibited.",
              "Lot sizes must comply with the leverage and margin guidelines specified at account activation.",
              "Violations of any risk management rule may result in immediate account suspension without prior notice.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Profit Sharing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profit Sharing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              "Profit split percentages are agreed upon application approval and vary by account tier.",
              "Profits are calculated and distributed on a schedule agreed at account activation.",
              "PesaMatrix retains the right to withhold profits in cases of rule violations.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* General Terms */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              "Applicants must have an active PesaMatrix subscription and a minimum of 1 year of verifiable trading experience.",
              "PesaMatrix reserves the right to reject any application without providing a reason.",
              "Approved traders must maintain their PesaMatrix subscription for the duration of their funded account.",
              "These terms may be updated at any time. The current version is always displayed on this page.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
