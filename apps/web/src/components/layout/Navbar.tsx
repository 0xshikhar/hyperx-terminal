import { Link, useLocation } from "react-router-dom";
import { BarChart3, BookOpen, Trophy, User, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { AlertBell } from "@/components/alerts/AlertBell";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const navItems = [
  { href: "/terminal", label: "TRADE", icon: BarChart3 },
  { href: "/markets", label: "MARKETS", icon: BookOpen },
  { href: "/portfolio", label: "PORTFOLIO", icon: User },
  { href: "/leaderboard", label: "LEADERBOARD", icon: Trophy },
];

export function Navbar() {
  const location = useLocation();

  return (
    <header className="flex items-center justify-between border-b border-border/50 bg-card/50 backdrop-blur-sm px-4 py-2">
      <div className="flex items-center gap-6">
        {/* Logo */}
        <Link to="/terminal" className="flex items-center gap-2 group">
          <div className="relative">
            <Zap className="h-5 w-5 text-primary" />
            <div className="absolute inset-0 blur-sm bg-primary/50" />
          </div>
          <span className="font-mono text-lg font-bold tracking-wider">
            <span className="text-primary">HYPER</span>
            <span className="text-foreground">X</span>
          </span>
          <span className="font-mono text-[10px] text-muted-foreground border border-border/50 px-1.5 py-0.5 rounded">
            v2.0
          </span>
        </Link>
        
        {/* Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
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
                  "flex items-center gap-2 rounded px-3 py-1.5 font-mono text-xs tracking-wide transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      
      {/* Right side actions */}
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded bg-secondary/50 border border-border/50">
          <div className="status-dot active animate-pulse-glow" />
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            Connected
          </span>
        </div>
        
        <NotificationBell />
        <AlertBell />
        <ConnectWalletButton />
      </div>
    </header>
  );
}
