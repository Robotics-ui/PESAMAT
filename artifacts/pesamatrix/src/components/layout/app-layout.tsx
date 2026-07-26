import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "./sidebar";
import { ForexBanner } from "@/components/forex-banner";
import { CustomerCareFooter } from "./customer-care-footer";
import { FloatingContactButton } from "./floating-contact-button";
import { BottomNav } from "./bottom-nav";
import { SidebarProvider, useSidebar } from "@/contexts/sidebar-context";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Menu, TrendingUp } from "lucide-react";
import { Link } from "wouter";

interface AppLayoutProps {
  children: React.ReactNode;
}

function MobileTopBar() {
  const { toggle } = useSidebar();
  return (
    <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-card border-b border-border shrink-0">
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
          <TrendingUp className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-bold text-foreground tracking-tight">PESAMATRIX</span>
      </Link>
      <button
        onClick={toggle}
        className="h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
    </header>
  );
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const { user, isLoading, token } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !token) {
      navigate("/login");
    }
  }, [isLoading, token, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar — hidden on desktop */}
        <MobileTopBar />
        <ForexBanner />
        <main className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 pb-16 lg:pb-0">
            {children}
          </div>
          <CustomerCareFooter />
        </main>
      </div>
      {/* Bottom nav — mobile only */}
      <BottomNav />
      <FloatingContactButton />
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </SidebarProvider>
  );
}
