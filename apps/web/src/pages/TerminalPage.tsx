import { type ReactNode, useState } from "react";
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
import { useMarketStore } from "@/store/marketStore";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";
import { TradingChart } from "@/components/chart/TradingChart";
import { OrderBook } from "@/components/orderbook/OrderBook";
import { RecentTrades } from "@/components/recent-trades/RecentTrades";
import { TradeForm } from "@/components/trade-form/TradeForm";
import { PositionsTabs } from "@/components/positions/PositionsTabs";
import { useVimNavigation } from "@/hooks/useVimNavigation";
import type { CandleInterval } from "@/services/wsClient";

const INTERVALS: CandleInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

export function TerminalPage() {
  useVimNavigation();
  const { activeMarket, markets, setActiveMarket } = useMarketStore();
  const connectionState = useRuntimeHealthStore((state) => state.connectionState);
  const getMarketFeedHealth = useRuntimeHealthStore((state) => state.getMarketFeedHealth);
  const [selectedInterval, setSelectedInterval] = useState<CandleInterval>("1m");
  const [rightPanelTab, setRightPanelTab] = useState<"orderbook" | "trades">("orderbook");

  const market = markets.find((item) => item.symbol === activeMarket) ?? markets[0];
  const displaySymbol = market?.displaySymbol ?? market?.symbol ?? activeMarket;
  const feedHealth = getMarketFeedHealth(activeMarket);
  const change24h = market?.changePercent24h ?? 0;
  const isPositive = change24h >= 0;
  const displayPrice = market?.lastPrice ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#081214] text-[#d8dfe1]">
      <div className="grid flex-1 min-h-0 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-h-0 xl:grid-rows-[auto_minmax(320px,1.5fr)_minmax(180px,1fr)]">
          <header className="border-b border-[#162326] bg-[#0a1518]">
            <div className="flex flex-col gap-4 px-5 py-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#112327] text-[#53d8c8]">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button className="flex items-center gap-2 text-[30px] font-semibold leading-none tracking-tight text-white">
                        <span>{displaySymbol}</span>
                        <ChevronDown className="h-4 w-4 text-[#7f8c90]" />
                      </button>
                      <span className="rounded-md bg-[#10363a] px-2 py-1 text-xs font-medium text-[#53d8c8]">
                        10x
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                      <span className="font-mono text-[38px] font-semibold leading-none text-white">
                        ${formatPrice(displayPrice)}
                      </span>
                      <span
                        className={cn(
                          "pb-1 font-mono text-sm",
                          isPositive ? "text-[#53d8c8]" : "text-[#f16d75]"
                        )}
                      >
                        {isPositive ? "+" : ""}
                        {change24h.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {markets.map((item) => {
                    const itemDisplaySymbol = item.displaySymbol ?? item.symbol;
                    return (
                      <button
                        key={item.symbol}
                        onClick={() => setActiveMarket(item.symbol)}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                          item.symbol === activeMarket
                            ? "border-[#2a555c] bg-[#102125] text-[#53d8c8]"
                            : "border-[#1d2b2f] bg-[#0d1719] text-[#7f8c90] hover:border-[#2a3a3f] hover:text-[#d4dbdd]"
                        )}
                      >
                        {itemDisplaySymbol}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 text-xs md:grid-cols-2 xl:grid-cols-6">
                <MarketStat label="Mark" value={`$${formatPrice(displayPrice)}`} />
                <MarketStat label="Oracle" value={`$${formatPrice(displayPrice * 1.0004)}`} />
                <MarketStat
                  label="24h Change"
                  value={`${isPositive ? "+" : ""}${change24h.toFixed(2)}%`}
                  tone={isPositive ? "up" : "down"}
                />
                <MarketStat label="24h Volume" value={formatCompactUsd(market?.volume24h ?? 0)} />
                <MarketStat label="Open Interest" value={formatCompactUsd(market?.openInterest ?? 0)} />
                <MarketStat
                  label="Funding / Countdown"
                  value={`${(market?.fundingRate ?? 0).toFixed(4)}% / 00:59:33`}
                  tone="up"
                />
              </div>
            </div>
          </header>

          <section className="grid min-h-0 border-b border-[#162326] xl:grid-cols-[56px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col border-r border-[#162326] bg-[#091416]">
              <div className="flex flex-col gap-1 p-2">
                {INTERVALS.map((interval) => (
                  <button
                    key={interval}
                    onClick={() => setSelectedInterval(interval)}
                    className={cn(
                      "rounded-md px-2 py-2 text-xs font-medium transition-colors",
                      selectedInterval === interval
                        ? "bg-[#132126] text-white"
                        : "text-[#7f8c90] hover:bg-[#101b1f] hover:text-[#d4dbdd]"
                    )}
                  >
                    {interval}
                  </button>
                ))}
              </div>

              <div className="border-t border-[#162326] p-2">
                <div className="flex flex-col gap-1">
                  <ToolButton icon={Crosshair} label="Cursor" active />
                  <ToolButton icon={LineChart} label="Drawing" />
                  <ToolButton icon={CandlestickChart} label="Indicators" />
                  <ToolButton icon={Bell} label="Alerts" />
                  <ToolButton icon={Expand} label="Replay" />
                  <ToolButton icon={Maximize2} label="Full" />
                </div>
              </div>
            </aside>

            <div className="flex min-h-0 flex-col bg-[#091416]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#162326] px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ToolbarChip active>{activeMarket}</ToolbarChip>
                  <ToolbarChip>EMA 20</ToolbarChip>
                  <ToolbarChip>VWAP</ToolbarChip>
                  <ToolbarChip>RSI 14</ToolbarChip>
                  <ToolbarChip>Volume</ToolbarChip>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                      feedHealth.isFresh
                        ? "border-[#1d4d49] bg-[#0f2523] text-[#53d8c8]"
                        : connectionState === "connected"
                          ? "border-[#5a4a1f] bg-[#261f10] text-[#f7c96b]"
                          : "border-[#3b4b56] bg-[#0f1d26] text-[#84b5d8]"
                    )}
                  >
                    <Waves className="h-3.5 w-3.5" />
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

              <div className="min-h-0 flex-1 p-3">
                <TradingChart interval={selectedInterval} />
              </div>
            </div>
          </section>

          <div className="min-h-0 bg-[#091416]">
            <PositionsTabs />
          </div>
        </div>

        <aside className="grid min-h-0 border-t border-[#162326] bg-[#091416] xl:border-l xl:border-t-0 xl:grid-rows-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <div className="flex min-h-0 flex-col">
            <div className="flex border-b border-[#162326]">
              {(
                [
                  { id: "orderbook", label: "Order Book" },
                  { id: "trades", label: "Trades" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRightPanelTab(tab.id)}
                  className={cn(
                    "flex-1 border-b px-4 py-3 text-sm font-medium transition-colors",
                    rightPanelTab === tab.id
                      ? "border-[#53d8c8] text-white"
                      : "border-transparent text-[#7f8c90] hover:text-[#d4dbdd]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
              <div className="flex items-center px-3">
                <IconButton icon={Settings2} label="Book Settings" />
              </div>
            </div>

            <div className="min-h-0 flex-1">
              {rightPanelTab === "orderbook" ? (
                <OrderBook embedded />
              ) : (
                <RecentTrades embedded />
              )}
            </div>
          </div>

          <div className="min-h-0 border-t border-[#162326]">
            <TradeForm />
          </div>
        </aside>
      </div>
    </div>
  );
}

function MarketStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "up" | "down";
}) {
  return (
    <div className="space-y-1 rounded-md border border-[#132126] bg-[#0c181b] px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[#708084]">{label}</div>
      <div
        className={cn(
          "font-mono text-sm",
          tone === "up"
            ? "text-[#53d8c8]"
            : tone === "down"
              ? "text-[#f16d75]"
              : "text-white"
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
        "rounded-md border px-3 py-1.5 text-xs font-medium",
        active
          ? "border-[#2a555c] bg-[#102125] text-[#53d8c8]"
          : "border-[#1d2b2f] bg-[#0d1719] text-[#8ea2a6]"
      )}
    >
      {children}
    </div>
  );
}

function ToolButton({
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
        "flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] transition-colors",
        active
          ? "bg-[#132126] text-[#53d8c8]"
          : "text-[#6f8084] hover:bg-[#101b1f] hover:text-[#d4dbdd]"
      )}
      title={label}
    >
      <Icon className="h-4 w-4" />
      <span className="leading-none">{label}</span>
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
      className="rounded-md border border-[#1d2b2f] bg-[#0d1719] p-2 text-[#8ea2a6] transition-colors hover:border-[#2a3a3f] hover:text-white"
      title={label}
    >
      <Icon className="h-4 w-4" />
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
