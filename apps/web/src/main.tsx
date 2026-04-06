import { StrictMode, Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { startClientServices } from "@/services/startup";
import { NotificationsToastBridge } from "@/components/notifications/NotificationsToastBridge";
import { useUIStore, getEffectiveTheme } from "@/store/uiStore";
import { useMarketStore } from "@/store/marketStore";
import { KeyboardShortcutsProvider } from "@/hooks/useKeyboardShortcuts";
import { initAuth } from "@/services/auth.service";
import { useThemeKeyboardShortcut } from "@/hooks/useTheme";
import "~/styles/globals.css";

const PerformanceMonitor = lazy(() =>
  import("@/components/monitoring/PerformanceMonitor").then((module) => ({
    default: module.PerformanceMonitor,
  }))
);
const CommandPaletteV2 = lazy(() =>
  import("@/components/command-palette/CommandPaletteV2").then((module) => ({
    default: module.CommandPaletteV2,
  }))
);
const KeyboardShortcutsHelp = lazy(() =>
  import("@/components/keyboard-shortcuts/KeyboardShortcutsHelp").then((module) => ({
    default: module.KeyboardShortcutsHelp,
  }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Market/portfolio data goes stale fast but shouldn't refetch on every
      // mount — WS feeds are the source of truth for live prices.
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

export function AppRoot() {
  const theme = useUIStore((s) => s.theme);
  const effectiveTheme = getEffectiveTheme(theme);
  const defaultMarket = useUIStore((s) => s.defaultMarket);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);

  // Initialize services and auth
  useEffect(() => {
    document.title = "HyperX Terminal — Starknet Perpetual Futures Trading Terminal";
    startClientServices();
    void initAuth();
  }, []);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(effectiveTheme);
  }, [effectiveTheme]);

  // Set default market
  useEffect(() => {
    if (defaultMarket) {
      useMarketStore.getState().setActiveMarket(defaultMarket);
    }
  }, [defaultMarket]);

  // Theme keyboard shortcut
  useThemeKeyboardShortcut();

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette: Ctrl+K / Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      // Keyboard help: ? (when not in input)
      if (e.key === "?" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setKeyboardHelpOpen(true);
      }
    };

    const handleOpenShortcuts = () => setKeyboardHelpOpen(true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("hyperx:open-shortcuts", handleOpenShortcuts);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("hyperx:open-shortcuts", handleOpenShortcuts);
    };
  }, []);

  return (
    <KeyboardShortcutsProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <NotificationsToastBridge />
          <SonnerToaster />
          {/* Each lazy overlay gets its own boundary so a chunk fetch can
              never blank the whole terminal. */}
          <Suspense fallback={null}>
            <PerformanceMonitor />
          </Suspense>
          <Suspense fallback={null}>
            <CommandPaletteV2 open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
          </Suspense>
          <Suspense fallback={null}>
            <KeyboardShortcutsHelp open={keyboardHelpOpen} onClose={() => setKeyboardHelpOpen(false)} />
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </KeyboardShortcutsProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>
);
