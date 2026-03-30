import { useMemo } from "react";
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
    const abs = Math.max(0, bestAsk - bestBid);
    const mid = (bestAsk + bestBid) / 2;
    const bps = mid > 0 ? (abs / mid) * 10000 : 0;
    const pct = mid > 0 ? (abs / mid) * 100 : 0;
    return { bestBid, bestAsk, mid, abs, pct, bps };
  }, [asks, bids]);

  if (!spread) {
    return (
      <div className="flex h-7 items-center justify-center text-[10px] font-mono text-[#506068]">
        -- / -- (Spread: --)
      </div>
    );
  }

  return (
    <div className="flex h-7 items-center justify-between border-y border-[#152327] bg-[#0b181c]/70 px-3 text-[10px] font-mono select-none">
      <span className="text-[#00d084] font-medium" title="Best Bid">
        ${spread.bestBid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <div className="flex items-center gap-1 text-[#64748b]">
        <span>Spread:</span>
        <span className="text-[#dde5e7] font-semibold">
          ${spread.abs.toFixed(2)}
        </span>
        <span className="rounded bg-[#122327] px-1 py-0.2 text-[9px] text-[#22d3ee] border border-[#1d4a50]">
          {spread.bps.toFixed(1)} bps
        </span>
      </div>
      <span className="text-[#ff4757] font-medium" title="Best Ask">
        ${spread.bestAsk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
