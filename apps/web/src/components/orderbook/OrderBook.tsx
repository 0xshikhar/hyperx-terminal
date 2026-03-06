import { useMarketStore } from "@/store/marketStore";
import { useOrderBook } from "@/hooks/useOrderBook";
import { OrderBookSide } from "@/components/orderbook/OrderBookSide";
import { OrderBookSpread } from "@/components/orderbook/OrderBookSpread";

export function OrderBook() {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const { aggregation, setAggregation, bidRows, askRows, aggregatedBids, aggregatedAsks } =
    useOrderBook(activeMarket);

  return (
    <div className="h-full rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Order Book</h3>
        <div className="flex items-center gap-2">
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
        <OrderBookSide rows={askRows} height={256} />
        <div className="border-y border-border">
          <OrderBookSpread bids={aggregatedBids} asks={aggregatedAsks} />
        </div>
        <OrderBookSide rows={bidRows} height={256} />
      </div>
    </div>
  );
}
