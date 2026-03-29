import { type ReactNode, useState, useRef, useEffect } from "react";
import {
  Activity,
  Bell,
  CandlestickChart,
  ChevronDown,
  Crosshair,
  Expand,
  LineChart,
  Maximize2,
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
function MarketHeaderPrice() {
  const { displaySymbol, lastPrice, changePercent24h, isPositive } =
    useActiveMarketSummary();
  const flashClass = usePriceFlash(lastPrice);

  return (
    <div className="flex items-center gap-4 min-w-0">
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 font-mono text-[22px] font-bold leading-none tracking-tight text-white">
          <span>{displaySymbol}</span>
          <ChevronDown className="h-3.5 w-3.5 text-[#5a6e74] mt-0.5" />
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
function MarketQuickSwitcher() {
  const activeMarket = useActiveMarket();
  const setActiveMarket = useSetActiveMarket();
  const symbols = useMarketSymbols();

  return (
    <div className="flex items-center gap-1">
      {symbols.map((symbol) => (
        <button
          key={symbol}
          onClick={() => setActiveMarket(symbol)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            symbol === activeMarket
              ? "bg-[#0e282c] text-[#22d3ee] border border-[#1d4a50]"
              : "text-[#64748b] hover:text-[#c0cdd0] hover:bg-[#111e23]"
          )}
        >
          {symbol.split("-")[0]}
        </button>
      ))}
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
      <StatChip
        label="Funding"
        value={`${fundingRate >= 0 ? "+" : ""}${fundingRate.toFixed(4)}%`}
        tone={fundingRate >= 0 ? "up" : "down"}
      />
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#081214] text-[#c8d4d7]">
      {/* ── Top market header ── */}
      <header className="border-b border-[#1a2830] bg-[#0a1518]">
        {/* Row 1: Symbol + Price + Market switcher */}
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <MarketHeaderPrice />
          <MarketQuickSwitcher />
        </div>
        {/* Row 2: Stats strip */}
        <div className="border-t border-[#1a2830]">
          <MarketStatsStrip />
        </div>
      </header>

      {/* ── 3-Section Trading Interface ── */}
      <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] xl:grid-cols-[minmax(0,1fr)_310px] 2xl:grid-cols-[minmax(0,1fr)_330px]">
        {/* Left + Center Area (Chart + OrderBook on top, Positions spanning both at bottom) */}
        <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_270px] xl:grid-cols-[minmax(0,1fr)_290px] 2xl:grid-cols-[minmax(0,1fr)_310px] grid-rows-[minmax(320px,1fr)_auto]">
          {/* Section 1: Chart */}
          <section className="flex min-h-0 flex-col border-b border-[#1a2830]">
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
          </section>

          {/* Section 2: Order Book / Trades (Dedicated Center Column) */}
          <section className="flex min-h-0 flex-col border-b border-[#1a2830] lg:border-l lg:border-[#1a2830] bg-[#091416]">
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
          </section>

          {/* Bottom Dock: Positions / Orders / Balances (spans both Chart & Order Book) */}
          <div className="min-h-0 lg:col-span-2 bg-[#091416]">
            <PositionsTabs />
          </div>
        </div>

        {/* Section 3: Trade Form (Dedicated Right Column - Full Height) */}
        <aside className="flex min-h-0 flex-col border-t border-[#1a2830] bg-[#091416] lg:border-l lg:border-t-0">
          <TradeForm />
        </aside>
      </div>
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
