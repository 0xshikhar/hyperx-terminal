import { Link, useLocation } from "react-router-dom";
import { BarChart3, BookOpen, Trophy, User, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { WalletConnectDialog } from "@/components/wallet/WalletConnectDialog";
import { AlertBell } from "@/components/alerts/AlertBell";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";

const navItems = [
  { href: "/terminal", label: "TRADE", icon: BarChart3 },
  { href: "/markets", label: "MARKETS", icon: BookOpen },
  { href: "/portfolio", label: "PORTFOLIO", icon: User },
  { href: "/leaderboard", label: "LEADERBOARD", icon: Trophy },
];

export function Navbar() {
  const location = useLocation();
  const connectionState = useRuntimeHealthStore((state) => state.connectionState);
  const reconnectPlan = useRuntimeHealthStore((state) => state.reconnectPlan);

  return (
    <>
      <header className="flex h-11 items-center justify-between border-b border-[#1a2830] bg-[#0a1216] px-4">
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
              v1.1
            </span>
          </Link>
          <div className="relative group flex items-center gap-1 font-mono text-[10px] text-primary/80 border border-primary/30 px-1.5 py-0.5 rounded bg-primary/5 cursor-help">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>Railway Server</span>

            <div className="absolute top-full left-0 mt-2 w-72 p-3 bg-card border border-border rounded-lg shadow-xl shadow-black/80 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 z-50 font-sans text-xs text-foreground font-normal leading-normal normal-case">
              <div className="font-semibold text-primary mb-1">Backend Hosted on Railway</div>
              We use a Railway server as our backend. If the server is in sleep/idle mode, it may take a few seconds to wake up and fetch data (such as charts) when you first load the landing page.
            </div>
          </div>

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
            <div
              className={cn(
                "status-dot",
                connectionState === "connected"
                  ? "active animate-pulse-glow"
                  : connectionState === "connecting"
                    ? "active"
                    : "inactive"
              )}
            />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              {connectionState === "connected"
                ? "Feed Online"
                : connectionState === "connecting"
                  ? reconnectPlan
                    ? `Retry ${Math.max(0, Math.ceil((reconnectPlan.reconnectAt - Date.now()) / 1000))}s` // eslint-disable-line react-hooks/purity
                    : "Feed Recovering"
                  : "Feed Offline"}
            </span>
          </div>

          <NotificationBell />
          <AlertBell />
          <ConnectWalletButton />
        </div>
      </header>
      <WalletConnectDialog />
    </>
  );
}
