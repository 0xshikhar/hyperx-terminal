import { Link, useLocation } from "react-router-dom";
import { BarChart3, BookOpen, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { AlertBell } from "@/components/alerts/AlertBell";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const navItems = [
  { href: "/terminal", label: "Trade", icon: BarChart3 },
  { href: "/markets", label: "Markets", icon: BookOpen },
  { href: "/portfolio", label: "Portfolio", icon: User },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

export function Navbar() {
  const location = useLocation();

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-6">
        <Link to="/terminal" className="text-lg font-semibold tracking-tight">
          HyperX
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.href ||
              location.pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <AlertBell />
        <ConnectWalletButton />
      </div>
    </header>
  );
}
