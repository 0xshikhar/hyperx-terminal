import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { StatusBar } from "@/components/monitoring/StatusBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";

export function TerminalLayout() {
  const location = useLocation();
  const isTerminalRoute = location.pathname.startsWith("/terminal");

  return (
    <ErrorBoundary>
      <div
        className={cn(
          "flex flex-col bg-background scanlines",
          isTerminalRoute ? "h-screen overflow-hidden" : "min-h-screen"
        )}
      >
        {/* Top border accent */}
        <div className="h-[2px] shrink-0 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        
        {/* Main layout */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main content area */}
          <div className="flex min-w-0 flex-1 flex-col h-full min-h-0">
            {/* Top navigation bar */}
            <div className="shrink-0">
              <Navbar />
            </div>
            
            <main
              className={cn(
                "relative flex-1 min-h-0",
                isTerminalRoute
                  ? "bg-[#081214] overflow-hidden"
                  : "overflow-y-auto overflow-x-hidden pb-[36px] grid-lines"
              )}
            >
              <div className={cn("relative z-10", isTerminalRoute ? "h-full min-h-0" : "min-h-full p-4")}>
                <Outlet />
              </div>
            </main>
            
            {/* Bottom status bar */}
            <StatusBar
              className={cn(
                "z-50 shrink-0",
                isTerminalRoute ? "relative border-t border-[#1a2830]" : "fixed bottom-0 left-0 right-0"
              )}
            />
          </div>
        </div>
        
        {/* Mobile navigation */}
        <MobileBottomNav />
      </div>
    </ErrorBoundary>
  );
}
