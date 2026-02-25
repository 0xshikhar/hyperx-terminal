import { useMemo } from "react";
import { useMarketStore } from "@/store/marketStore";
import { cn } from "@/lib/utils";

type TradeRow = {
  price: number;
  size: number;
  side: "buy" | "sell";
  timestamp: string;
};

export function RecentTrades() {
  const { activeMarket } = useMarketStore();
  const trades = useMemo<TradeRow[]>(() => {
    const timestamps = [
      "12:01:30",
      "12:01:10",
      "12:00:52",
      "12:00:30",
      "12:00:05",
      "11:59:44",
      "11:59:21",
      "11:59:00",
      "11:58:40",
      "11:58:15",
      "11:57:49",
      "11:57:21",
    ];
    return timestamps.map((timestamp, index) => ({
      price: 95000 + index * 2.5,
      size: 0.05 + index * 0.01,
      side: index % 2 === 0 ? ("buy" as const) : ("sell" as const),
      timestamp,
    }));
  }, [activeMarket]);

  return (
    <div className="h-full rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Trades</h3>
        <span className="text-xs text-muted-foreground">{activeMarket}</span>
      </div>
      <div className="mt-4 space-y-1 text-xs font-mono">
        {trades.map((trade) => (
          <div
            key={`${trade.timestamp}-${trade.price}`}
            className="flex items-center justify-between"
          >
            <span
              className={cn(
                trade.side === "buy" ? "text-emerald-500" : "text-rose-500"
              )}
            >
              {trade.price.toLocaleString()}
            </span>
            <span className="text-muted-foreground">{trade.size.toFixed(3)}</span>
            <span className="text-muted-foreground">{trade.timestamp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
