import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useThemeContext } from "@/contexts/theme-context";
import { useSidebar } from "@/contexts/sidebar-context";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CreditCard,
  Server,
  Users,
  GitBranch,
  Link2,
  BarChart3,
  Shield,
  LogOut,
  Gift,
  TrendingUp,
  ChevronRight,
  Newspaper,
  BookOpen,
  Bell,
  Image,
  Info,
  Phone,
  Activity,
  MessageSquare,
  Sun,
  Moon,
  Monitor,
  HelpCircle,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/payment", label: "Subscribe", icon: CreditCard },
  { href: "/master-accounts", label: "Master Accounts", icon: Server },
  { href: "/slave-accounts", label: "Slave Accounts", icon: Users },
  { href: "/strategies", label: "Strategies", icon: GitBranch },
  { href: "/bindings", label: "Bindings", icon: Link2 },
  { href: "/trade-logs", label: "Trade Logs", icon: BarChart3 },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/resources", label: "Resources", icon: BookOpen },
  { href: "/announcements", label: "Announcements", icon: Bell },
  { href: "/about", label: "About Us", icon: Info },
  { href: "/contacts", label: "Contacts", icon: Phone },
  { href: "/settings/notifications", label: "SMS Preferences", icon: Bell },
  { href: "/referrals", label: "Referrals", icon: Gift },
  { href: "/faq", label: "FAQ", icon: HelpCircle },
  { href: "/account-funding", label: "Account Funding", icon: Wallet },
];

const adminNavItems = [
  { href: "/admin", label: "Admin Panel", icon: Shield },
  { href: "/admin/diagnostics", label: "MetaApi Diagnostics", icon: Activity },
  { href: "/admin/media-center", label: "Media Center", icon: Image },
  { href: "/admin/news", label: "Trading News", icon: Newspaper },
  { href: "/admin/resources", label: "Resources", icon: BookOpen },
  { href: "/admin/announcements", label: "Announcements", icon: Bell },
  { href: "/admin/sms", label: "Bulk SMS", icon: MessageSquare },
  { href: "/admin/faq", label: "FAQ Manager", icon: HelpCircle },
  { href: "/admin/workers", label: "Worker Dashboard", icon: Activity },
  { href: "/admin/funding", label: "Account Funding", icon: Wallet },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useThemeContext();

  const ThemeIcon = theme === "light" ? Sun : theme === "system" ? Monitor : Moon;

  return (
    <>
      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link key={href} href={href} onClick={onNavigate}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors",
                  active
                    ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight className="h-3 w-3" />}
              </div>
            </Link>
          );
        })}

        {user?.role === "admin" && (
          <div className="mt-4 space-y-1">
            <p className="px-3 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">Admin</p>
            {adminNavItems.map(({ href, label, icon: Icon }) => {
              const active = href === "/admin" ? location === "/admin" : location.startsWith(href);
              return (
                <Link key={href} href={href} onClick={onNavigate}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors border",
                      active
                        ? "bg-green-600/20 text-green-400 border-green-600/30"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground border-transparent"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {active && <ChevronRight className="h-3 w-3" />}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-border shrink-0">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-blue-600/20 border border-blue-600/40 flex items-center justify-center text-blue-400 text-sm font-semibold shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                title="Switch theme"
              >
                <ThemeIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              <DropdownMenuItem onClick={() => setTheme("light")} className={cn(theme === "light" && "text-blue-400")}>
                <Sun className="h-4 w-4 mr-2" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")} className={cn(theme === "dark" && "text-blue-400")}>
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")} className={cn(theme === "system" && "text-blue-400")}>
                <Monitor className="h-4 w-4 mr-2" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const { isOpen, close } = useSidebar();
  const [location] = useLocation();

  // Close sidebar on navigation on mobile
  useEffect(() => {
    close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <>
      {/* Desktop sidebar — always visible on lg+ */}
      <aside className="hidden lg:flex flex-col w-64 h-screen bg-card border-r border-border shrink-0 transition-colors duration-200">
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 h-16 border-b border-border shrink-0">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">PESAMATRIX</span>
        </div>
        <NavContent />
      </aside>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 z-50 flex flex-col w-72 max-w-[85vw] h-full bg-card border-r border-border transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold text-foreground tracking-tight">PESAMATRIX</span>
          </div>
          <button
            onClick={close}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <NavContent onNavigate={close} />
      </aside>
    </>
  );
}
