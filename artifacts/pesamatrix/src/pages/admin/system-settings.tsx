import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, Save, RefreshCw, ToggleLeft, ToggleRight, DollarSign,
  Users, Clock, Percent, Zap, CheckCircle2, AlertCircle, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SystemSettings {
  FREE_TRIAL_DAYS: string;
  TRIAL_ENABLED: string;
  PHONE_VERIFICATION_REQUIRED: string;
  AUTO_ASSIGN_MASTER: string;
  AUTO_BIND_AFTER_VERIFICATION: string;
  MAX_USERS_PER_MASTER: string;
  MASTER_RESERVED_CAPACITY_PERCENT: string;
  AUTO_REBALANCE: string;
}

interface PricingSettings {
  dailyFee: string;
  minDays: string;
  maxDays: string;
}

// ── Toggle Component ──────────────────────────────────────────────────────────

function ToggleField({
  label,
  description,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ElementType;
}) {
  const enabled = value === "true";
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/40 last:border-0">
      <div className="flex items-start gap-3 flex-1">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(enabled ? "false" : "true")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
          enabled
            ? "bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20"
            : "bg-muted text-muted-foreground border-border hover:bg-muted/80",
        )}
      >
        {enabled ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
        {enabled ? "Enabled" : "Disabled"}
      </button>
    </div>
  );
}

// ── Number Field ──────────────────────────────────────────────────────────────

function NumberField({
  label,
  description,
  value,
  onChange,
  icon: Icon,
  suffix,
  min,
  max,
  step,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ElementType;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/40 last:border-0">
      <div className="flex items-start gap-3 flex-1">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step ?? 1}
          className="w-28 text-right h-8 text-sm"
        />
        {suffix && <span className="text-xs text-muted-foreground w-10">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SystemSettingsPage() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [settings, setSettings] = useState<SystemSettings>({
    FREE_TRIAL_DAYS: "7",
    TRIAL_ENABLED: "true",
    PHONE_VERIFICATION_REQUIRED: "true",
    AUTO_ASSIGN_MASTER: "true",
    AUTO_BIND_AFTER_VERIFICATION: "false",
    MAX_USERS_PER_MASTER: "2000",
    MASTER_RESERVED_CAPACITY_PERCENT: "10",
    AUTO_REBALANCE: "true",
  });

  const [pricing, setPricing] = useState<PricingSettings>({
    dailyFee: "150",
    minDays: "5",
    maxDays: "365",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") { navigate("/dashboard"); return; }
  }, [user, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sysRes, pricingRes] = await Promise.all([
        fetch("/api/admin/system-settings", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/settings", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!sysRes.ok) throw new Error("Failed to load system settings");
      const sysData = await sysRes.json() as { settings: SystemSettings };
      setSettings(sysData.settings);

      if (pricingRes.ok) {
        const pricingData = await pricingRes.json() as { dailyFee?: number | string; minDays?: number; maxDays?: number };
        setPricing({
          dailyFee: String(pricingData.dailyFee ?? 150),
          minDays: String(pricingData.minDays ?? 5),
          maxDays: String(pricingData.maxDays ?? 365),
        });
      }
    } catch {
      toast({ title: "Error", description: "Failed to load settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const [sysRes, pricingRes] = await Promise.all([
        fetch("/api/admin/system-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(settings),
        }),
        fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            dailyFee: parseFloat(pricing.dailyFee) || 150,
            minDays: parseInt(pricing.minDays, 10) || 5,
            maxDays: parseInt(pricing.maxDays, 10) || 365,
          }),
        }),
      ]);

      if (!sysRes.ok) {
        const err = await sysRes.json() as { error?: string };
        throw new Error(err.error ?? "System settings save failed");
      }
      if (!pricingRes.ok) {
        const err = await pricingRes.json() as { error?: string };
        throw new Error(err.error ?? "Pricing settings save failed");
      }

      setSavedAt(new Date().toLocaleTimeString());
      toast({ title: "Settings saved", description: "All changes take effect immediately." });
    } catch (err) {
      toast({ title: "Save failed", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof SystemSettings) => (v: string) =>
    setSettings((prev) => ({ ...prev, [key]: v }));

  const setPrice = (key: keyof PricingSettings) => (v: string) =>
    setPricing((prev) => ({ ...prev, [key]: v }));

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[200px]">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6 text-blue-400" />
              Platform Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure platform-wide business rules — changes take effect immediately without redeployment.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {savedAt && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Saved {savedAt}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              {saving ? "Saving…" : "Save All"}
            </Button>
          </div>
        </div>

        {/* Subscription Pricing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-400" />
              Subscription Pricing
            </CardTitle>
            <CardDescription>
              Daily trading-day subscription fee and allowed day range. All changes apply immediately across
              the payment page, landing page calculator, and subscription activation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NumberField
              label="Daily Subscription Fee"
              description="Amount charged per trading day (Monday–Friday). This is the live rate shown to users."
              value={pricing.dailyFee}
              onChange={setPrice("dailyFee")}
              icon={DollarSign}
              suffix="KES"
              min={1}
              step={1}
            />
            <NumberField
              label="Minimum Subscription Days"
              description="Minimum number of trading days a user can purchase in a single payment."
              value={pricing.minDays}
              onChange={setPrice("minDays")}
              icon={CalendarDays}
              suffix="days"
              min={1}
            />
            <NumberField
              label="Maximum Subscription Days"
              description="Maximum number of trading days a user can purchase in a single payment."
              value={pricing.maxDays}
              onChange={setPrice("maxDays")}
              icon={CalendarDays}
              suffix="days"
              min={1}
              max={3650}
            />
          </CardContent>
        </Card>

        {/* Trial Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              Trial Subscription
            </CardTitle>
            <CardDescription>Controls free trial eligibility and duration. Trial days count as trading days (Mon–Fri only).</CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleField
              label="Enable Free Trial"
              description="When disabled, new users receive an expired subscription after phone verification."
              value={settings.TRIAL_ENABLED}
              onChange={set("TRIAL_ENABLED")}
              icon={ToggleRight}
            />
            <NumberField
              label="Free Trial Duration"
              description="Number of trading days (Mon–Fri) granted to eligible new users on first verification."
              value={settings.FREE_TRIAL_DAYS}
              onChange={set("FREE_TRIAL_DAYS")}
              icon={Clock}
              suffix="days"
              min={1}
              max={365}
            />
            <ToggleField
              label="Require Phone Verification"
              description="Users must verify their phone number before the trial is activated."
              value={settings.PHONE_VERIFICATION_REQUIRED}
              onChange={set("PHONE_VERIFICATION_REQUIRED")}
              icon={CheckCircle2}
            />
          </CardContent>
        </Card>

        {/* Distribution Master Assignment */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-400" />
              Distribution Master Assignment
            </CardTitle>
            <CardDescription>Controls how subscribers are assigned to Distribution Masters.</CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleField
              label="Auto-Assign Distribution Master"
              description="Automatically assign active subscribers to the highest-scoring healthy Distribution Master."
              value={settings.AUTO_ASSIGN_MASTER}
              onChange={set("AUTO_ASSIGN_MASTER")}
              icon={Zap}
            />
            <ToggleField
              label="Auto-Bind After Verification"
              description="Immediately trigger master assignment after successful phone verification."
              value={settings.AUTO_BIND_AFTER_VERIFICATION}
              onChange={set("AUTO_BIND_AFTER_VERIFICATION")}
              icon={CheckCircle2}
            />
            <NumberField
              label="Max Users Per Master"
              description="Hard capacity ceiling for each Distribution Master."
              value={settings.MAX_USERS_PER_MASTER}
              onChange={set("MAX_USERS_PER_MASTER")}
              icon={Users}
              suffix="users"
              min={1}
            />
            <NumberField
              label="Reserved Capacity Percent"
              description="Percentage of each master's capacity held in reserve for reconnects and spikes. E.g. 10% on a 2500-capacity master = 2250 max assignable."
              value={settings.MASTER_RESERVED_CAPACITY_PERCENT}
              onChange={set("MASTER_RESERVED_CAPACITY_PERCENT")}
              icon={Percent}
              suffix="%"
              min={0}
              max={50}
            />
          </CardContent>
        </Card>

        {/* Rebalancer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-orange-400" />
              Rebalancer
            </CardTitle>
            <CardDescription>Controls the automatic load rebalancer that migrates subscribers between masters.</CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleField
              label="Auto-Rebalance"
              description="Periodically migrate subscribers from overloaded masters to lightly-loaded ones to maintain optimal distribution."
              value={settings.AUTO_REBALANCE}
              onChange={set("AUTO_REBALANCE")}
              icon={RefreshCw}
            />
          </CardContent>
        </Card>

        {/* Info banner */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <AlertCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300">
            All settings are applied immediately — no server restart required. Pricing changes are reflected on the payment page and landing page calculator instantly. Workers read settings fresh on every tick (60-second cache).
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
