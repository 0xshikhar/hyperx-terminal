import { useRef, useState, useEffect, useMemo } from "react";
import { useMarketStore } from "@/store/marketStore";
import { useOrderBook } from "@/hooks/useOrderBook";
import { OrderBookSide } from "@/components/orderbook/OrderBookSide";
import { OrderBookSpread } from "@/components/orderbook/OrderBookSpread";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";
import { cn } from "@/lib/utils";

type OrderBookProps = {
  embedded?: boolean;
};

export function OrderBook({ embedded = false }: OrderBookProps) {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const { aggregation, setAggregation, bidRows, askRows, aggregatedBids, aggregatedAsks, isReference } =
    useOrderBook(activeMarket);
  const connectionState = useRuntimeHealthStore((state) => state.connectionState);
  const getMarketFeedHealth = useRuntimeHealthStore((state) => state.getMarketFeedHealth);
  const feedHealth = getMarketFeedHealth(activeMarket);

  const containerRef = useRef<HTMLDivElement>(null);
  const [sideHeight, setSideHeight] = useState(220);

  // Dynamic height adjustment based on container height
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) {
          // Subtract header (~32px), column labels (~24px), spread (~28px), and safety padding
          const available = Math.max(120, Math.floor((h - 84) / 2));
          setSideHeight(available);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // In institutional order books, highest ask is at the top descending to lowest ask near spread
  const reversedAskRows = useMemo(() => {
    return askRows.slice().reverse();
  }, [askRows]);

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
      {/* Controls / Status Bar */}
      <div
        className={cn(
          "flex items-center justify-between border-b border-[#152327] px-3 py-2",
          embedded ? "bg-[#0a1518]" : ""
        )}
      >
        <div className="flex items-center gap-2">
          {!embedded && (
            <h3 className="font-mono text-xs font-semibold text-[#c8d4d7]">
              Order Book
            </h3>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wider",
              feedHealth.isFresh
                ? "bg-emerald-500/10 text-emerald-400"
                : isReference
                  ? "bg-sky-500/10 text-sky-300"
                  : "bg-amber-500/10 text-amber-400"
            )}
          >
            {feedHealth.isFresh
              ? "Live"
              : isReference
                ? "Ref"
                : connectionState === "connected"
                  ? "Stale"
                  : "Offline"}
          </span>
          <span className="font-mono text-xs font-semibold text-[#c8d4d7]">
            {activeMarket}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[#506068]">Tick</span>
          <select
            value={aggregation}
            onChange={(event) => setAggregation(Number(event.target.value))}
            className="rounded border border-[#213136] bg-[#102125] px-1.5 py-0.5 font-mono text-[11px] text-[#dde5e7] outline-none hover:border-[#2f4349]"
          >
            {[1, 2, 5, 10, 25, 50].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Column Headers */}
      <div className="flex items-center justify-between border-b border-[#152327] bg-[#081214] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#506068]">
        <span>Price</span>
        <span>Size ({baseSymbol})</span>
      </div>

      {/* Ladder Body */}
      <div className="min-h-0 flex-1 flex flex-col justify-between overflow-hidden">
        {!feedHealth.isFresh && !isReference && (
          <div className="mx-2 my-1 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-300">
            Feed paused · reconnecting
          </div>
        )}

        {/* Asks (Red) */}
        <div className="min-h-0 flex-1 overflow-hidden flex flex-col justify-end">
          <OrderBookSide rows={reversedAskRows} height={sideHeight} />
        </div>

        {/* Spread Divider */}
        <div className="border-y border-[#1a2830] bg-[#0c181b]">
          <OrderBookSpread bids={aggregatedBids} asks={aggregatedAsks} />
        </div>

        {/* Bids (Green) */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <OrderBookSide rows={bidRows} height={sideHeight} />
        </div>
      </div>
    </div>
  );
}
