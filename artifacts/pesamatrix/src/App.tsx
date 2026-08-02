import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/contexts/theme-context";

// Eagerly loaded — critical path
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";

// Lazy-loaded pages
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const PaymentPage = lazy(() => import("@/pages/payment"));
const MasterAccountsPage = lazy(() => import("@/pages/master-accounts"));
const SlaveAccountsPage = lazy(() => import("@/pages/slave-accounts"));
const StrategiesPage = lazy(() => import("@/pages/strategies"));
const BindingsPage = lazy(() => import("@/pages/bindings"));
const TradeLogsPage = lazy(() => import("@/pages/trade-logs"));
const AdminPage = lazy(() => import("@/pages/admin/index"));
const NewsPage = lazy(() => import("@/pages/news"));
const ResourcesPage = lazy(() => import("@/pages/resources"));
const AnnouncementsPage = lazy(() => import("@/pages/announcements"));
const MediaCenterPage = lazy(() => import("@/pages/media-center"));
const AdminMediaCenterPage = lazy(() => import("@/pages/admin/media-center"));
const AdminNewsPage = lazy(() => import("@/pages/admin/news-admin"));
const AdminResourcesPage = lazy(() => import("@/pages/admin/resources-admin"));
const AdminAnnouncementsPage = lazy(() => import("@/pages/admin/announcements-admin"));
const ChangePasswordPage = lazy(() => import("@/pages/change-password"));
const MarketPulsePage = lazy(() => import("@/pages/market-pulse"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const AboutPage = lazy(() => import("@/pages/about"));
const ContactsPage = lazy(() => import("@/pages/contacts"));
const LandingPage = lazy(() => import("@/pages/landing"));
const DiagnosticsPage = lazy(() => import("@/pages/diagnostics"));
const AdminSmsPage = lazy(() => import("@/pages/admin/sms-admin"));
const NotificationPreferencesPage = lazy(() => import("@/pages/notification-preferences"));
const ReferralsPage = lazy(() => import("@/pages/referrals"));
const FaqPage = lazy(() => import("@/pages/faq"));
const AdminFaqPage = lazy(() => import("@/pages/admin/faq-admin"));
const WorkersDashboardPage = lazy(() => import("@/pages/admin/workers-dashboard"));
const MasterAuditPage = lazy(() => import("@/pages/admin/master-audit"));
const AdminHealthPage = lazy(() => import("@/pages/admin/health"));
const AccountFundingPage = lazy(() => import("@/pages/account-funding"));
const FundingAdminPage = lazy(() => import("@/pages/admin/funding-admin"));
const FundingTermsPage = lazy(() => import("@/pages/funding-terms"));
const DistributionMastersPage = lazy(() => import("@/pages/admin/distribution-masters"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );
}

function GuestRoute({ component: Component }: { component: React.ComponentType }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return null;
  if (token) return <Redirect to="/dashboard" />;
  return <Component />;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={() => <GuestRoute component={LandingPage} />} />
        <Route path="/login" component={() => <GuestRoute component={LoginPage} />} />
        <Route path="/register" component={() => <GuestRoute component={RegisterPage} />} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/payment" component={PaymentPage} />
        <Route path="/master-accounts" component={MasterAccountsPage} />
        <Route path="/slave-accounts" component={SlaveAccountsPage} />
        <Route path="/strategies" component={StrategiesPage} />
        <Route path="/bindings" component={BindingsPage} />
        <Route path="/trade-logs" component={TradeLogsPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/news" component={NewsPage} />
        <Route path="/resources" component={ResourcesPage} />
        <Route path="/announcements" component={AnnouncementsPage} />
        <Route path="/media-center" component={MediaCenterPage} />
        <Route path="/admin/media-center" component={AdminMediaCenterPage} />
        <Route path="/admin/news" component={AdminNewsPage} />
        <Route path="/admin/resources" component={AdminResourcesPage} />
        <Route path="/admin/announcements" component={AdminAnnouncementsPage} />
        <Route path="/admin/diagnostics" component={DiagnosticsPage} />
        <Route path="/admin/sms" component={AdminSmsPage} />
        <Route path="/settings/notifications" component={NotificationPreferencesPage} />
        <Route path="/referrals" component={ReferralsPage} />
        <Route path="/change-password" component={ChangePasswordPage} />
        <Route path="/market" component={MarketPulsePage} />
        <Route path="/forgot-password" component={() => <GuestRoute component={ForgotPasswordPage} />} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/faq" component={FaqPage} />
        <Route path="/admin/faq" component={AdminFaqPage} />
        <Route path="/admin/workers" component={WorkersDashboardPage} />
        <Route path="/admin/master-audit" component={MasterAuditPage} />
        <Route path="/admin/health" component={AdminHealthPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/contacts" component={ContactsPage} />
        <Route path="/account-funding" component={AccountFundingPage} />
        <Route path="/funding-terms" component={FundingTermsPage} />
        <Route path="/admin/funding" component={FundingAdminPage} />
        <Route path="/admin/distribution-masters" component={DistributionMastersPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AppWithTheme() {
  const { token } = useAuth();
  return (
    <ThemeProvider token={token}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
    </ThemeProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppWithTheme />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
