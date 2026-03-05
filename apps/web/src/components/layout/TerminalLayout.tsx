import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { StatusBar } from "@/components/monitoring/StatusBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function TerminalLayout() {
  const location = useLocation();
  const isTerminalRoute = location.pathname.startsWith("/terminal");

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col bg-background scanlines">
        {/* Top border accent */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        
        {/* Main layout */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main content area */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top navigation bar */}
            <Navbar />
            
        <main
          className={`relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-[36px] ${
            isTerminalRoute ? "bg-[#081214]" : "grid-lines"
          }`}
        >
          <div className={`relative z-10 min-h-full ${isTerminalRoute ? "" : "p-4"}`}>
            <Outlet />
          </div>
        </main>
        
        {/* Bottom status bar — fixed on screen at all times */}
        <StatusBar className="fixed bottom-0 left-0 right-0 z-50" />
          </div>
        </div>
        
        {/* Mobile navigation */}
        <MobileBottomNav />
      </div>
    </ErrorBoundary>
  );
}
