import { Link, useLocation } from "wouter";
import { LayoutDashboard, BarChart3, Wallet, User, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/sidebar-context";

const bottomNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/account-funding", label: "Funding", icon: Wallet },
  { href: "/trade-logs", label: "Trades", icon: BarChart3 },
  { href: "/referrals", label: "Profile", icon: User },
];

export function BottomNav() {
  const [location] = useLocation();
  const { toggle } = useSidebar();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-area-pb">
      <div className="flex items-stretch h-16">
        {bottomNavItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link key={href} href={href} className="flex-1">
              <div
                className={cn(
                  "flex flex-col items-center justify-center h-full gap-0.5 transition-colors",
                  active
                    ? "text-blue-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </div>
            </Link>
          );
        })}

        {/* Menu button opens sidebar */}
        <button
          onClick={toggle}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
}
