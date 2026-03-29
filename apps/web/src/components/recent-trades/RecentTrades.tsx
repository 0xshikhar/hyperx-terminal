import { memo, useRef, useState, useEffect } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { useMarketStore } from "@/store/marketStore";
import { RecentTradeRow } from "@/components/recent-trades/RecentTradeRow";
import { useRecentTrades } from "@/hooks/useRecentTrades";
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
  const { trades, listData, isReference } = useRecentTrades(activeMarket);

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
          "flex items-center justify-between border-b border-[#152327] px-3 py-2",
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
        <span className="text-[11px] text-[#506068]">{trades.length} trades</span>
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

        <FixedSizeList
          height={listHeight}
          width="100%"
          itemCount={trades.length}
          itemSize={24}
          itemData={listData}
          itemKey={getTradeItemKey}
        >
          {RecentTradeRowRenderer}
        </FixedSizeList>
      </div>
    </div>
  );
}
