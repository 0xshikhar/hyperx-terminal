import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { StatusBar } from "@/components/monitoring/StatusBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function TerminalLayout() {
  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col bg-background">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            <Outlet />
          </main>
        </div>
        <StatusBar />
        <MobileBottomNav />
      </div>
    </ErrorBoundary>
  );
}
