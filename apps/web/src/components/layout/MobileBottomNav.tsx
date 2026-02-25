import { Link, useLocation } from "react-router-dom";
import { BarChart3, BookOpen, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/terminal", label: "Trade", icon: BarChart3 },
  { href: "/markets", label: "Markets", icon: BookOpen },
  { href: "/portfolio", label: "Portfolio", icon: User },
  { href: "/leaderboard", label: "Rankings", icon: Trophy },
];

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden">
      <div className="flex items-center justify-around">
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
                "flex flex-col items-center py-2 px-3 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "fill-current")} />
              <span className="mt-1 text-[10px] font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
