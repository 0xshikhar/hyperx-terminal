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

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col",
        embedded
          ? "bg-[#091416]"
          : "rounded-[20px] border border-border/70 bg-[linear-gradient(180deg,rgba(17,17,24,0.98),rgba(10,10,15,0.98))] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)]"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between",
          embedded ? "border-b border-[#152327] px-4 py-3" : ""
        )}
      >
        {!embedded ? <h3 className="text-sm font-semibold">Order Book</h3> : <div className="text-xs font-medium text-[#8da0a4]">Depth</div>}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
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
                ? "Reference"
                : connectionState === "connected"
                  ? "Stale"
                  : "Recovering"}
          </span>
          <span className={cn("text-xs", embedded ? "text-[#8da0a4]" : "text-muted-foreground")}>
            {activeMarket}
          </span>
          <select
            value={aggregation}
            onChange={(event) => setAggregation(Number(event.target.value))}
            className={cn(
              "rounded-md px-2 py-1 text-xs outline-none",
              embedded
                ? "border border-[#213136] bg-[#102125] text-[#dde5e7]"
                : "border border-border bg-background"
            )}
          >
            {[1, 2, 5, 10, 25, 50].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={cn("min-h-0 flex-1", embedded ? "px-4 py-3" : "mt-3")}>
        {!feedHealth.isFresh && (
          <div
            className={cn(
              "mb-3 rounded-md px-3 py-2 text-xs",
              isReference
                ? "border border-sky-500/20 bg-sky-500/5 text-sky-200"
                : "border border-amber-500/20 bg-amber-500/5 text-amber-300"
            )}
          >
            {isReference
              ? "Live depth is unavailable, so the terminal is rendering a deterministic reference ladder from the current market snapshot."
              : connectionState === "connected"
                ? "The socket is connected, but the orderbook feed is quiet. Rendering the last known depth snapshot."
                : "The orderbook feed is paused while the socket reconnects. Depth levels will resume when the stream is healthy."}
          </div>
        )}
        <OrderBookSide rows={askRows} height={Math.max(180, 220)} />
        <div className="border-y border-border">
          <OrderBookSpread bids={aggregatedBids} asks={aggregatedAsks} />
        </div>
        <OrderBookSide rows={bidRows} height={Math.max(180, 220)} />
      </div>
    </div>
  );
}
