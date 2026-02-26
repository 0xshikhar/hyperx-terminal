import { useEffect, useMemo } from "react";
import { useMarketStore } from "@/store/marketStore";
import { useOrderbookStore, type OrderbookLevel } from "@/store/orderbookStore";
import { wsClient } from "@/services/wsClient";
import { OrderBookSide } from "@/components/orderbook/OrderBookSide";
import { OrderBookSpread } from "@/components/orderbook/OrderBookSpread";
import type { OrderBookRowData } from "@/components/orderbook/OrderBookRow";

export function OrderBook() {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const aggregation = useOrderbookStore((s) => s.aggregation);
  const setAggregation = useOrderbookStore((s) => s.setAggregation);
  const bids = useOrderbookStore((s) => s.bids);
  const asks = useOrderbookStore((s) => s.asks);

  useEffect(() => {
    useOrderbookStore.getState().setMarket(activeMarket);
    wsClient.subscribe("orderbook", activeMarket);
    return () => {
      wsClient.unsubscribe("orderbook", activeMarket);
    };
  }, [activeMarket]);

  const aggregated = useMemo(() => {
    const aggregateSide = (levels: OrderbookLevel[]) => {
      if (aggregation <= 1) return levels;
      const map = new Map<number, number>();
      for (const level of levels) {
        const bucket = Math.round(level.price / aggregation) * aggregation;
        map.set(bucket, (map.get(bucket) ?? 0) + level.size);
      }
      const rows = Array.from(map.entries()).map(([price, size]) => ({ price, size }));
      rows.sort((a, b) => b.price - a.price);
      return rows;
    };

    return {
      bids: aggregateSide(bids),
      asks: aggregateSide(asks).sort((a, b) => a.price - b.price),
    };
  }, [aggregation, asks, bids]);

  const bidRows = useMemo<OrderBookRowData[]>(() => {
    const max = aggregated.bids.reduce((acc, level) => Math.max(acc, level.size), 0) || 1;
    return aggregated.bids.slice(0, 100).map((level) => ({
      price: level.price,
      size: level.size,
      depthPercent: (level.size / max) * 100,
      side: "bid" as const,
    }));
  }, [aggregated.bids]);

  const askRows = useMemo<OrderBookRowData[]>(() => {
    const max = aggregated.asks.reduce((acc, level) => Math.max(acc, level.size), 0) || 1;
    return aggregated.asks.slice(0, 100).map((level) => ({
      price: level.price,
      size: level.size,
      depthPercent: (level.size / max) * 100,
      side: "ask" as const,
    }));
  }, [aggregated.asks]);

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
          <OrderBookSpread bids={aggregated.bids} asks={aggregated.asks} />
        </div>
        <OrderBookSide rows={bidRows} height={256} />
      </div>
    </div>
  );
}
