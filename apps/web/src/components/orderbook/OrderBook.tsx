import { useMemo } from "react";
import { useMarketStore } from "@/store/marketStore";
import { cn } from "@/lib/utils";

type OrderBookRow = {
  price: number;
  size: number;
  side: "bid" | "ask";
};

export function OrderBook() {
  const { activeMarket } = useMarketStore();

  const rows = useMemo<OrderBookRow[]>(() => {
    const base = activeMarket === "ETH-USD" ? 4870 : 95400;
    return Array.from({ length: 14 }).flatMap((_, index) => {
      const offset = index * 5;
      return [
        { price: base + offset, size: 12 - index, side: "ask" as const },
        { price: base - offset, size: 8 + index, side: "bid" as const },
      ];
    });
  }, [activeMarket]);

  return (
    <div className="h-full rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Order Book</h3>
        <span className="text-xs text-muted-foreground">{activeMarket}</span>
      </div>
      <div className="mt-4 space-y-1">
        {rows.map((row, index) => (
          <div
            key={`${row.side}-${row.price}-${index}`}
            className="flex items-center justify-between text-xs font-mono"
          >
            <span
              className={cn(
                row.side === "bid" ? "text-emerald-500" : "text-rose-500"
              )}
            >
              {row.price.toLocaleString()}
            </span>
            <span className="text-muted-foreground">
              {row.size.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
