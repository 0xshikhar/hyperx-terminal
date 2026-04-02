import { type ReactNode, useState, useRef, useEffect, useCallback } from "react";
import {
  Activity,
  Bell,
  CandlestickChart,
  ChevronDown,
  Crosshair,
  Expand,
  Keyboard,
  LineChart,
  Maximize2,
  Search,
  Settings2,
  Sigma,
  Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useActiveMarket,
  useActiveMarketSummary,
  useActiveMarketStats,
  useMarketSymbols,
  useSetActiveMarket,
} from "@/store/marketStore";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";
import { TradingChart } from "@/components/chart/TradingChart";
import { OrderBook } from "@/components/orderbook/OrderBook";
import { RecentTrades } from "@/components/recent-trades/RecentTrades";
import { TradeForm } from "@/components/trade-form/TradeForm";
import { PositionsTabs } from "@/components/positions/PositionsTabs";
import { useVimNavigation } from "@/hooks/useVimNavigation";
import { usePaperTradingSync } from "@/hooks/usePaperTradingSync";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { SettlementCountdown } from "@/components/risk/SettlementCountdown";
import { MarketSelectorModal } from "@/components/market-selector/MarketSelectorModal";
import { KeyboardShortcutsModal } from "@/components/modals/KeyboardShortcutsModal";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { useOrdersStore } from "@/store/ordersStore";
import { useNetworkStore } from "@/store/networkStore";
import { terminalAudio } from "@/lib/terminalAudio";
import { toast } from "sonner";
import type { CandleInterval } from "@/services/wsClient";

const INTERVALS: CandleInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

// ─── Price flash hook ────────────────────────────────────────────────────────
function usePriceFlash(price: number) {
  const prevRef = useRef(price);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    const prev = prevRef.current;
    if (price !== prev && prev !== 0) {
      const cls = price > prev ? "flash-up" : "flash-down";
      setFlashClass(cls);
      const t = window.setTimeout(() => setFlashClass(""), 420);
      prevRef.current = price;
      return () => window.clearTimeout(t);
    }
    prevRef.current = price;
  }, [price]);

  return flashClass;
}

// ─── Market header price block ───────────────────────────────────────────────
function MarketHeaderPrice({ onOpenMarketModal }: { onOpenMarketModal: () => void }) {
  const { displaySymbol, lastPrice, changePercent24h, isPositive } =
    useActiveMarketSummary();
  const flashClass = usePriceFlash(lastPrice);

  return (
    <div className="flex items-center gap-4 min-w-0">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            terminalAudio.playClick();
            onOpenMarketModal();
          }}
          className="group flex items-center gap-1.5 font-mono text-[22px] font-bold leading-none tracking-tight text-white hover:text-[#22d3ee] transition-colors cursor-pointer"
          title="Select Market (⌘K)"
        >
          <span>{displaySymbol}</span>
          <ChevronDown className="h-3.5 w-3.5 text-[#5a6e74] mt-0.5 group-hover:text-[#22d3ee] transition-colors" />
        </button>
        <span className="rounded border border-[#1d4a50] bg-[#0e282c] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#22d3ee]">
          PERP
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <span
          data-testid="header-last-price"
          className={cn(
            "price-cell font-mono text-[26px] font-bold leading-none text-white rounded px-1",
            flashClass
          )}
        >{`$${formatPrice(lastPrice)}`}</span>
        <span
          data-testid="header-change-percent"
          className={cn(
            "font-mono text-sm font-medium",
            isPositive ? "text-[#00d084]" : "text-[#ff4757]"
          )}
        >{isPositive ? "+" : ""}{changePercent24h.toFixed(2)}%</span>
      </div>
    </div>
  );
}

// ─── Market quick switcher ───────────────────────────────────────────────────
function MarketQuickSwitcher({
  onOpenMarketModal,
  onOpenShortcutsModal,
}: {
  onOpenMarketModal: () => void;
  onOpenShortcutsModal: () => void;
}) {
  const activeMarket = useActiveMarket();
  const setActiveMarket = useSetActiveMarket();
  const symbols = useMarketSymbols();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {symbols.map((symbol) => (
          <button
            key={symbol}
            onClick={() => setActiveMarket(symbol)}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
              symbol === activeMarket
                ? "bg-[#0e282c] text-[#22d3ee] border border-[#1d4a50]"
                : "text-[#64748b] hover:text-[#c0cdd0] hover:bg-[#111e23]"
            )}
          >
            {symbol.split("-")[0]}
          </button>
        ))}
      </div>

      <div className="h-3.5 w-px bg-[#1a2830]" />

      <button
        onClick={() => {
          terminalAudio.playClick();
          onOpenMarketModal();
        }}
        className="flex items-center gap-1.5 rounded border border-[#1b343c] bg-[#0b1b1f] px-2.5 py-1 text-xs font-medium text-[#8ea2a6] hover:border-[#22d3ee]/60 hover:text-white transition-all cursor-pointer"
        title="Search markets (⌘K)"
      >
        <Search className="h-3 w-3 text-[#22d3ee]" />
        <span>Search</span>
        <kbd className="rounded border border-[#1f3137] bg-[#071316] px-1 font-mono text-[10px] text-[#556b73]">
          ⌘K
        </kbd>
      </button>

      <button
        onClick={() => {
          terminalAudio.playClick();
          onOpenShortcutsModal();
        }}
        className="flex items-center gap-1 rounded border border-[#1b343c] bg-[#0b1b1f] px-2 py-1 text-xs font-medium text-[#8ea2a6] hover:border-[#22d3ee]/60 hover:text-white transition-all cursor-pointer"
        title="Pro Hotkeys HUD (?)"
      >
        <Keyboard className="h-3.5 w-3.5 text-[#556b73]" />
        <kbd className="font-mono text-[10px] text-[#556b73]">?</kbd>
      </button>
    </div>
  );
}

// ─── Compact market stats strip (Hyperliquid-style) ─────────────────────────
function MarketStatsStrip() {
  const {
    markPrice,
    oraclePrice,
    changePercent24h,
    isPositive,
    volume24h,
    openInterest,
    fundingRate,
  } = useActiveMarketStats();

  return (
    <div className="flex items-center overflow-x-auto scrollbar-hide divide-x divide-[#1a2830]">
      <StatChip label="Mark" value={`$${formatPrice(markPrice)}`} />
      <StatChip label="Oracle" value={`$${formatPrice(oraclePrice)}`} />
      <StatChip
        label="24h Change"
        value={`${isPositive ? "+" : ""}${changePercent24h.toFixed(2)}%`}
        tone={isPositive ? "up" : "down"}
      />
      <StatChip label="24h Vol" value={formatCompactUsd(volume24h)} />
      <StatChip label="Open Int." value={formatCompactUsd(openInterest)} />
      <SettlementCountdown fundingRate={fundingRate} />
    </div>
  );
}

// ─── Terminal page ───────────────────────────────────────────────────────────
export function TerminalPage() {
  useVimNavigation();
  usePaperTradingSync();
  const activeMarket = useActiveMarket();
  const connectionState = useRuntimeHealthStore((state) => state.connectionState);
  const getMarketFeedHealth = useRuntimeHealthStore(
    (state) => state.getMarketFeedHealth
  );
  const [selectedInterval, setSelectedInterval] =
    useState<CandleInterval>("1m");
  const [centerPanelTab, setCenterPanelTab] = useState<"orderbook" | "trades">(
    "orderbook"
  );

  const feedHealth = getMarketFeedHealth(activeMarket);

  const [marketModalOpen, setMarketModalOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  // Global hotkeys for ⌘K and Shift+C (Panic Cancel)
  const cancelAllPaperOrders = usePaperTradingStore((s) => s.cancelAllOrders);
  const cancelAllRealOrders = useOrdersStore((s) => s.cancelAllOrders);
  const isPaperTrading = useNetworkStore((s) => s.isPaperTrading);

  const handlePanicCancel = useCallback(() => {
    terminalAudio.playOrderCancel();
    if (isPaperTrading) {
      const { cancelledCount, refundedMargin } = cancelAllPaperOrders();
      if (cancelledCount > 0) {
        toast.success(
          `🚨 Panic cancelled ${cancelledCount} open order(s), refunded $${refundedMargin.toFixed(2)} margin`
        );
      } else {
        toast.info("No open paper orders to cancel");
      }
    } else {
      const count = cancelAllRealOrders();
      if (count > 0) {
        toast.success(`🚨 Panic cancelled ${count} open live order(s)`);
      } else {
        toast.info("No open live orders to cancel");
      }
    }
  }, [cancelAllPaperOrders, cancelAllRealOrders, isPaperTrading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const inInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;

      // Cmd+K or Ctrl+K opens market selector modal (even from inputs)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMarketModalOpen((prev) => !prev);
        return;
      }

      if (inInput) return;

      // ? toggles shortcuts modal
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Shift+C triggers panic cancel
      if (e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handlePanicCancel();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePanicCancel]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#081214] text-[#c8d4d7]">
      {/* ── Top market header ── */}
      <header className="border-b border-[#1a2830] bg-[#0a1518]">
        {/* Row 1: Symbol + Price + Market switcher */}
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <MarketHeaderPrice onOpenMarketModal={() => setMarketModalOpen(true)} />
          <MarketQuickSwitcher
            onOpenMarketModal={() => setMarketModalOpen(true)}
            onOpenShortcutsModal={() => setShortcutsModalOpen(true)}
          />
        </div>
        {/* Row 2: Stats strip */}
        <div className="border-t border-[#1a2830]">
          <MarketStatsStrip />
        </div>
      </header>

      {/* ── Draggable Resizable Trading Interface ── */}
      <div className="flex-1 min-h-0 w-full overflow-hidden">
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="hyperx-terminal-panels-main"
          className="h-full w-full"
        >
          {/* Left + Center Area (Chart, Book, Bottom Dock) */}
          <ResizablePanel defaultSize={78} minSize={55} className="min-w-0">
            <ResizablePanelGroup
              direction="vertical"
              autoSaveId="hyperx-terminal-panels-left"
              className="h-full w-full"
            >
              {/* Top Row: Chart (Left) + Order Book / Trades (Right) */}
              <ResizablePanel defaultSize={68} minSize={35} className="min-h-0">
                <ResizablePanelGroup
                  direction="horizontal"
                  autoSaveId="hyperx-terminal-panels-top"
                  className="h-full w-full"
                >
                  {/* Section 1: Chart */}
                  <ResizablePanel defaultSize={72} minSize={40} className="min-w-0 flex flex-col bg-[#081214]">
                    {/* Chart toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1a2830] bg-[#091416] px-3 py-2">
                      {/* Intervals + indicators */}
                      <div className="flex items-center gap-0.5 flex-wrap">
                        {INTERVALS.map((interval) => (
                          <button
                            key={interval}
                            onClick={() => setSelectedInterval(interval)}
                            className={cn(
                              "rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors",
                              selectedInterval === interval
                                ? "bg-[#132126] text-white"
                                : "text-[#64748b] hover:bg-[#101b1f] hover:text-[#c8d4d7]"
                            )}
                          >
                            {interval}
                          </button>
                        ))}

                        <div className="mx-2 h-4 w-px bg-[#1a2830]" />

                        <ToolbarChip active>{activeMarket}</ToolbarChip>
                        <ToolbarChip>EMA</ToolbarChip>
                        <ToolbarChip>VWAP</ToolbarChip>
                        <ToolbarChip>RSI</ToolbarChip>
                      </div>

                      {/* Chart tools + feed status */}
                      <div className="flex items-center gap-1">
                        <ToolIconButton icon={Crosshair} label="Cursor" active />
                        <ToolIconButton icon={LineChart} label="Draw" />
                        <ToolIconButton icon={CandlestickChart} label="Indicators" />
                        <ToolIconButton icon={Bell} label="Alerts" />
                        <ToolIconButton icon={Expand} label="Replay" />

                        <div className="mx-1.5 h-4 w-px bg-[#1a2830]" />

                        {/* Live / Stale indicator */}
                        <div
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider",
                            feedHealth.isFresh
                              ? "border-[#1d4d49] bg-[#0f2523] text-[#00d084]"
                              : connectionState === "connected"
                                ? "border-[#5a4a1f] bg-[#261f10] text-[#f59e0b]"
                                : "border-[#3b4b56] bg-[#0f1d26] text-[#84b5d8]"
                          )}
                        >
                          <Waves className="h-3 w-3" />
                          {feedHealth.isFresh
                            ? "Live"
                            : connectionState === "connected"
                              ? "Stale"
                              : "Recovering"}
                        </div>

                        <IconButton icon={Sigma} label="Metrics" />
                        <IconButton icon={Settings2} label="Settings" />
                        <IconButton icon={Maximize2} label="Expand" />
                      </div>
                    </div>

                    {/* Chart canvas */}
                    <div className="min-h-0 flex-1 bg-[#081214] p-2">
                      <TradingChart interval={selectedInterval} />
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  {/* Section 2: Order Book / Trades (Dedicated Center Column) */}
                  <ResizablePanel defaultSize={28} minSize={18} maxSize={45} className="min-w-0 flex flex-col bg-[#091416]">
                    {/* Tab header: Order Book | Trades */}
                    <div className="flex border-b border-[#1a2830] bg-[#091416]">
                      {(
                        [
                          { id: "orderbook", label: "Order Book" },
                          { id: "trades", label: "Trades" },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setCenterPanelTab(tab.id)}
                          className={cn(
                            "flex-1 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
                            centerPanelTab === tab.id
                              ? "border-[#22d3ee] text-white"
                              : "border-transparent text-[#64748b] hover:text-[#c8d4d7]"
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                      <div className="flex items-center px-2">
                        <IconButton icon={Settings2} label="Book Settings" />
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden">
                      {centerPanelTab === "orderbook" ? (
                        <OrderBook embedded />
                      ) : (
                        <RecentTrades embedded />
                      )}
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Bottom Dock: Positions / Orders / Balances (spans both Chart & Order Book) */}
              <ResizablePanel defaultSize={32} minSize={15} maxSize={65} className="min-h-0 bg-[#091416]">
                <PositionsTabs />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Section 3: Trade Form (Dedicated Right Column - Full Height) */}
          <ResizablePanel defaultSize={22} minSize={16} maxSize={35} className="min-w-0 flex flex-col bg-[#091416]">
            <TradeForm />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* ── Institutional Market Selector Modal ── */}
      <MarketSelectorModal
        open={marketModalOpen}
        onOpenChange={setMarketModalOpen}
      />

      {/* ── Pro Keyboard Shortcuts HUD ── */}
      <KeyboardShortcutsModal
        open={shortcutsModalOpen}
        onOpenChange={setShortcutsModalOpen}
      />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "up" | "down";
}) {
  return (
    <div className="flex shrink-0 flex-col gap-0.5 px-4 py-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[#506068]">
        {label}
      </div>
      <div
        className={cn(
          "price-cell font-mono text-xs font-medium",
          tone === "up"
            ? "text-[#00d084]"
            : tone === "down"
              ? "text-[#ff4757]"
              : "text-[#d0dde0]"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ToolbarChip({
  children,
  active,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded px-2 py-1 text-[11px] font-medium",
        active
          ? "bg-[#102125] text-[#22d3ee] border border-[#1d4a50]"
          : "text-[#64748b] border border-transparent hover:border-[#1a2830] hover:text-[#c8d4d7] cursor-pointer"
      )}
    >
      {children}
    </div>
  );
}

function ToolIconButton({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof Activity;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded transition-colors",
        active
          ? "bg-[#132126] text-[#22d3ee]"
          : "text-[#64748b] hover:bg-[#111e23] hover:text-[#c8d4d7]"
      )}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function IconButton({
  icon: Icon,
  label,
}: {
  icon: typeof Activity;
  label: string;
}) {
  return (
    <button
      className="flex h-7 w-7 items-center justify-center rounded border border-[#1a2830] bg-[#091416] text-[#64748b] transition-colors hover:border-[#2a3a44] hover:text-[#c8d4d7]"
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function formatPrice(value: number) {
  if (value >= 1000) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatCompactUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}
