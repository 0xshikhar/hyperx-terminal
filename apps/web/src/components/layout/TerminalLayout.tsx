import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { StatusBar } from "@/components/monitoring/StatusBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function TerminalLayout() {
  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col bg-background scanlines">
        {/* Top border accent */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        
        {/* Main layout */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left sidebar */}
          <Sidebar />
          
          {/* Main content area */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top navigation bar */}
            <Navbar />
            
            {/* Content with grid lines background */}
            <main className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden grid-lines">
              {/* Corner accent */}
              <div className="absolute top-0 left-0 w-20 h-20 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/30 to-transparent" />
                <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-primary/30 to-transparent" />
              </div>
              
              {/* Content */}
              <div className="relative z-10 min-h-full p-4">
                <Outlet />
              </div>
            </main>
            
            {/* Bottom status bar */}
            <StatusBar />
          </div>
        </div>
        
        {/* Mobile navigation */}
        <MobileBottomNav />
        
        {/* Subtle vignette overlay */}
        <div 
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            background: 'radial-gradient(circle at center, transparent 0%, rgba(10, 10, 15, 0.4) 100%)',
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
