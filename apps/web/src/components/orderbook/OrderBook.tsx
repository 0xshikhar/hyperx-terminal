import { useRef, useState, useEffect, useMemo } from "react";
import { useMarketStore } from "@/store/marketStore";
import { useOrderBook } from "@/hooks/useOrderBook";
import { OrderBookSide } from "@/components/orderbook/OrderBookSide";
import { OrderBookSpread } from "@/components/orderbook/OrderBookSpread";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";
import { terminalAudio } from "@/lib/terminalAudio";
import { cn } from "@/lib/utils";

type OrderBookProps = {
  embedded?: boolean;
};

type ViewMode = "both" | "bids" | "asks";

export function OrderBook({ embedded = false }: OrderBookProps) {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const { aggregation, setAggregation, bidRows, askRows, aggregatedBids, aggregatedAsks, isReference } =
    useOrderBook(activeMarket);
  const connectionState = useRuntimeHealthStore((state) => state.connectionState);
  const getMarketFeedHealth = useRuntimeHealthStore((state) => state.getMarketFeedHealth);
  const feedHealth = getMarketFeedHealth(activeMarket);

  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const containerRef = useRef<HTMLDivElement>(null);
  const [sideHeight, setSideHeight] = useState(220);

  // Dynamic height adjustment based on container height & viewMode
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) {
          if (viewMode === "both") {
            const available = Math.max(100, Math.floor((h - 84) / 2));
            setSideHeight(available);
          } else {
            const available = Math.max(160, Math.floor(h - 60));
            setSideHeight(available);
          }
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [viewMode]);

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
          "flex items-center justify-between border-b border-[#152327] px-3 py-1.5",
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

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded border border-[#1d2d32] bg-[#0c181b] p-0.5">
            <button
              onClick={() => {
                terminalAudio.playClick();
                setViewMode("both");
              }}
              title="Both Asks and Bids"
              className={cn(
                "rounded p-1 transition-colors",
                viewMode === "both"
                  ? "bg-[#162a30] text-[#22d3ee]"
                  : "text-[#506068] hover:text-[#94a3b8]"
              )}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <rect x="2" y="2" width="12" height="2" rx="0.5" fill="#ff4757" />
                <rect x="2" y="5" width="8" height="2" rx="0.5" fill="#ff4757" />
                <rect x="2" y="9" width="8" height="2" rx="0.5" fill="#00d084" />
                <rect x="2" y="12" width="12" height="2" rx="0.5" fill="#00d084" />
              </svg>
            </button>
            <button
              onClick={() => {
                terminalAudio.playClick();
                setViewMode("bids");
              }}
              title="Bids Only"
              className={cn(
                "rounded p-1 transition-colors",
                viewMode === "bids"
                  ? "bg-[#162a30] text-[#00d084]"
                  : "text-[#506068] hover:text-[#94a3b8]"
              )}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <rect x="2" y="2" width="12" height="2" rx="0.5" fill="#00d084" />
                <rect x="2" y="5" width="9" height="2" rx="0.5" fill="#00d084" />
                <rect x="2" y="8" width="11" height="2" rx="0.5" fill="#00d084" />
                <rect x="2" y="11" width="7" height="2" rx="0.5" fill="#00d084" />
              </svg>
            </button>
            <button
              onClick={() => {
                terminalAudio.playClick();
                setViewMode("asks");
              }}
              title="Asks Only"
              className={cn(
                "rounded p-1 transition-colors",
                viewMode === "asks"
                  ? "bg-[#162a30] text-[#ff4757]"
                  : "text-[#506068] hover:text-[#94a3b8]"
              )}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <rect x="2" y="2" width="7" height="2" rx="0.5" fill="#ff4757" />
                <rect x="2" y="5" width="11" height="2" rx="0.5" fill="#ff4757" />
                <rect x="2" y="8" width="9" height="2" rx="0.5" fill="#ff4757" />
                <rect x="2" y="11" width="12" height="2" rx="0.5" fill="#ff4757" />
              </svg>
            </button>
          </div>

          <div className="h-3.5 w-px bg-[#1d2d32]" />

          {/* Tick Aggregation */}
          <div className="flex items-center gap-1">
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
      </div>

      {/* Column Headers (3 columns: Price, Size, Total) */}
      <div className="grid grid-cols-3 items-center border-b border-[#152327] bg-[#081214] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#506068]">
        <span className="text-left">Price</span>
        <span className="text-right">Size ({baseSymbol})</span>
        <span className="text-right">Total ({baseSymbol})</span>
      </div>

      {/* Ladder Body */}
      <div className="min-h-0 flex-1 flex flex-col justify-between overflow-hidden">
        {!feedHealth.isFresh && !isReference && (
          <div className="mx-2 my-1 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-300">
            Feed paused · reconnecting
          </div>
        )}

        {/* Both Mode: Asks top, Spread middle, Bids bottom */}
        {viewMode === "both" && (
          <>
            <div className="min-h-0 flex-1 overflow-hidden flex flex-col justify-end">
              <OrderBookSide rows={reversedAskRows} height={sideHeight} />
            </div>

            <div className="border-y border-[#1a2830] bg-[#0c181b]">
              <OrderBookSpread bids={aggregatedBids} asks={aggregatedAsks} />
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              <OrderBookSide rows={bidRows} height={sideHeight} />
            </div>
          </>
        )}

        {/* Bids Only Mode: Spread on top, full height Bids */}
        {viewMode === "bids" && (
          <>
            <div className="border-b border-[#1a2830] bg-[#0c181b]">
              <OrderBookSpread bids={aggregatedBids} asks={aggregatedAsks} />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <OrderBookSide rows={bidRows} height={sideHeight} />
            </div>
          </>
        )}

        {/* Asks Only Mode: Full height Asks, Spread on bottom */}
        {viewMode === "asks" && (
          <>
            <div className="min-h-0 flex-1 overflow-hidden flex flex-col justify-end">
              <OrderBookSide rows={reversedAskRows} height={sideHeight} />
            </div>
            <div className="border-t border-[#1a2830] bg-[#0c181b]">
              <OrderBookSpread bids={aggregatedBids} asks={aggregatedAsks} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
