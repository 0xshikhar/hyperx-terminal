import { useMarketStore } from "@/store/marketStore";
import { useOrderBook } from "@/hooks/useOrderBook";
import { OrderBookSide } from "@/components/orderbook/OrderBookSide";
import { OrderBookSpread } from "@/components/orderbook/OrderBookSpread";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";
import { cn } from "@/lib/utils";

export function OrderBook() {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const { aggregation, setAggregation, bidRows, askRows, aggregatedBids, aggregatedAsks } =
    useOrderBook(activeMarket);
  const connectionState = useRuntimeHealthStore((state) => state.connectionState);
  const getMarketFeedHealth = useRuntimeHealthStore((state) => state.getMarketFeedHealth);
  const feedHealth = getMarketFeedHealth(activeMarket);

  return (
    <div className="h-full rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Order Book</h3>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
              feedHealth.isFresh ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            )}
          >
            {feedHealth.isFresh ? "Live" : connectionState === "connected" ? "Stale" : "Recovering"}
          </span>
          <span className="text-xs text-muted-foreground">{activeMarket}</span>
          <select
            value={aggregation}
            onChange={(event) => setAggregation(Number(event.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            {[1, 2, 5, 10, 25, 50].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        {!feedHealth.isFresh && (
          <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
            {connectionState === "connected"
              ? "The socket is connected, but the orderbook feed is quiet. Rendering the last known depth snapshot."
              : "The orderbook feed is paused while the socket reconnects. Depth levels will resume when the stream is healthy."}
          </div>
        )}
        <OrderBookSide rows={askRows} height={256} />
        <div className="border-y border-border">
          <OrderBookSpread bids={aggregatedBids} asks={aggregatedAsks} />
        </div>
        <OrderBookSide rows={bidRows} height={256} />
      </div>
    </div>
  );
}
