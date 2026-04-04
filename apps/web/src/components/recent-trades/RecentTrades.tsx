import { memo, useRef, useState, useEffect, useMemo } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { useMarketStore } from "@/store/marketStore";
import { RecentTradeRow } from "@/components/recent-trades/RecentTradeRow";
import { useRecentTrades } from "@/hooks/useRecentTrades";
import { terminalAudio } from "@/lib/terminalAudio";
import { cn } from "@/lib/utils";
import type { Trade } from "@/store/tradeStore";

type RecentTradesProps = {
  embedded?: boolean;
};

const RecentTradeRowRenderer = memo(({ index, style, data }: ListChildComponentProps<Trade[]>) => {
  const trade = data[index];
  if (!trade) return null;
  return (
    <div style={style}>
      <RecentTradeRow
        side={trade.side}
        price={trade.price}
        size={trade.size}
        timestamp={trade.timestamp}
        time={trade.time}
      />
    </div>
  );
});

RecentTradeRowRenderer.displayName = "RecentTradeRowRenderer";

const getTradeItemKey = (index: number, data: Trade[]) =>
  data[index]?.id ?? `${data[index]?.timestamp ?? index}-${index}`;

export function RecentTrades({ embedded = false }: RecentTradesProps) {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const { trades, isReference } = useRecentTrades(activeMarket);
  const [filterMode, setFilterMode] = useState<"all" | "whales">("all");

  const containerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(480);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) {
          setListHeight(Math.max(160, Math.floor(h - 56)));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const baseSymbol = activeMarket.split("-")[0] || "ASSET";

  // Filtered trades based on notional whale threshold ($25k)
  const filteredTrades = useMemo(() => {
    if (filterMode === "whales") {
      return trades.filter((t) => t.price * t.size >= 25000);
    }
    return trades;
  }, [trades, filterMode]);

  const whaleCount = useMemo(() => {
    return trades.filter((t) => t.price * t.size >= 25000).length;
  }, [trades]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full min-h-0 flex-col",
        embedded
          ? "bg-[#091416]"
          : "rounded-[20px] border border-border/70 bg-[linear-gradient(180deg,rgba(17,17,24,0.98),rgba(10,10,15,0.98))] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)]"
      )}
    >
      {/* Header Bar */}
      <div
        className={cn(
          "flex items-center justify-between border-b border-[#152327] px-3 py-1.5",
          embedded ? "bg-[#0a1518]" : ""
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[#c8d4d7]">
            {embedded ? "Tape" : "Recent Trades"}
          </span>
          <span className="font-mono text-xs text-[#506068]">{activeMarket}</span>
          {isReference && (
            <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
              Ref
            </span>
          )}
        </div>

        {/* Filter Switcher: All vs Whales */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded border border-[#1d2d32] bg-[#0c181b] p-0.5 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => {
                terminalAudio.playClick();
                setFilterMode("all");
              }}
              className={cn(
                "px-2 py-0.5 rounded transition-colors cursor-pointer",
                filterMode === "all"
                  ? "bg-[#162a30] text-[#22d3ee] font-semibold shadow-[0_0_8px_rgba(34,211,238,0.15)]"
                  : "text-[#506068] hover:text-[#94a3b8]"
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => {
                terminalAudio.playClick();
                setFilterMode("whales");
              }}
              className={cn(
                "px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer",
                filterMode === "whales"
                  ? "bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                  : "text-[#506068] hover:text-amber-400/80"
              )}
              title="Filter institutional trades ≥ $25,000"
            >
              <span>🐋</span>
              <span>Whales</span>
              {whaleCount > 0 && (
                <span className="text-[9px] px-1 rounded-full bg-amber-500/30 text-amber-300">
                  {whaleCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div className="flex items-center justify-between border-b border-[#152327] bg-[#081214] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#506068]">
        <span>Price</span>
        <span>Size ({baseSymbol})</span>
        <span>Time</span>
      </div>

      {/* Trades List */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {isReference && (
          <div className="mx-2 my-1.5 rounded border border-sky-500/20 bg-sky-500/5 px-2.5 py-1 text-[10px] text-sky-200">
            Simulated tape stream for {activeMarket}
          </div>
        )}

        {filteredTrades.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-1 text-center font-mono text-xs text-[#506068]">
            <span>🐋 No whale trades (≥ $25k) detected</span>
            <span className="text-[10px] text-[#3d4d52]">Waiting for high-volume market prints...</span>
          </div>
        ) : (
          <FixedSizeList
            height={listHeight}
            width="100%"
            itemCount={filteredTrades.length}
            itemSize={24}
            itemData={filteredTrades}
            itemKey={getTradeItemKey}
          >
            {RecentTradeRowRenderer}
          </FixedSizeList>
        )}
      </div>
    </div>
  );
}
