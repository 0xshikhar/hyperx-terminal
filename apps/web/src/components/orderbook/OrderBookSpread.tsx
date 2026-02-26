import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { OrderbookLevel } from "@/store/orderbookStore";

type OrderBookSpreadProps = {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
};

export function OrderBookSpread({ bids, asks }: OrderBookSpreadProps) {
  const spread = useMemo(() => {
    const bestBid = bids[0]?.price;
    const bestAsk = asks[0]?.price;
    if (!bestBid || !bestAsk) return null;
    const abs = bestAsk - bestBid;
    const pct = (abs / bestAsk) * 100;
    return { bestBid, bestAsk, abs, pct };
  }, [asks, bids]);

  if (!spread) {
    return (
      <div className="flex h-8 items-center justify-center text-xs text-muted-foreground">
        --
      </div>
    );
  }

  return (
    <div className="flex h-8 items-center justify-between px-2 text-xs font-mono">
      <span className="text-muted-foreground">{spread.bestBid.toLocaleString()}</span>
      <span className={cn("text-muted-foreground")}>
        {spread.abs.toFixed(2)} ({spread.pct.toFixed(3)}%)
      </span>
      <span className="text-muted-foreground">{spread.bestAsk.toLocaleString()}</span>
    </div>
  );
}
