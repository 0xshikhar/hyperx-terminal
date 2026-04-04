import { useMemo, useEffect, useRef, useState } from "react";
import type { OrderbookLevel } from "@/store/orderbookStore";
import { useMarketStore } from "@/store/marketStore";
import { dispatchTerminalAction } from "@/lib/terminalActions";
import { terminalAudio } from "@/lib/terminalAudio";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";

type OrderBookSpreadProps = {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
};

export function OrderBookSpread({ bids, asks }: OrderBookSpreadProps) {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const market = useMarketStore((s) => s.markets.find((m) => m.symbol === activeMarket));
  const currentPrice = market?.lastPrice ?? market?.markPrice ?? 0;

  const prevPriceRef = useRef(currentPrice);
  const [direction, setDirection] = useState<"up" | "down" | "neutral">("neutral");
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (currentPrice > 0 && prevPriceRef.current > 0 && currentPrice !== prevPriceRef.current) {
      const isUp = currentPrice > prevPriceRef.current;
      setDirection(isUp ? "up" : "down");
      setFlash(isUp ? "up" : "down");
      const timer = setTimeout(() => setFlash(null), 450);
      prevPriceRef.current = currentPrice;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = currentPrice;
  }, [currentPrice]);

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

  const displayPrice = currentPrice > 0 ? currentPrice : spread?.mid ?? 0;

  const handleClickPrice = () => {
    if (displayPrice <= 0) return;
    terminalAudio.playClick();
    dispatchTerminalAction({
      type: "set-order-price",
      price: displayPrice,
    });
  };

  const isUp = direction === "up" || (direction === "neutral" && (market?.changePercent24h ?? 0) >= 0);

  return (
    <div
      data-testid="orderbook-spread-row"
      className={cn(
        "flex h-8 items-center justify-between border-y border-[#152327] px-3 font-mono text-[11px] select-none transition-colors duration-300",
        flash === "up"
          ? "bg-emerald-500/20"
          : flash === "down"
            ? "bg-rose-500/20"
            : "bg-[#091518]/90"
      )}
    >
      {/* Left: Prominent Flashing Last Price Ticker (Institutional Anchor) */}
      <button
        type="button"
        onClick={handleClickPrice}
        title="Last Fill Price (Click to set limit order price)"
        className="flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity group"
      >
        <span
          className={cn(
            "text-sm font-bold tabular-nums tracking-tight transition-colors",
            isUp ? "text-[#00d084]" : "text-[#ff4757]"
          )}
        >
          ${displayPrice.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: displayPrice >= 1000 ? 2 : 4,
          })}
        </span>
        {direction === "up" ? (
          <ArrowUp className="h-3.5 w-3.5 text-[#00d084] stroke-[2.5] animate-bounce" />
        ) : direction === "down" ? (
          <ArrowDown className="h-3.5 w-3.5 text-[#ff4757] stroke-[2.5] animate-bounce" />
        ) : (
          <span className={cn("text-[10px]", isUp ? "text-[#00d084]" : "text-[#ff4757]")}>
            {isUp ? "▲" : "▼"}
          </span>
        )}
      </button>

      {/* Right: Spread in USD and basis points */}
      <div className="flex items-center gap-2 text-[10px] text-[#64748b]">
        {spread ? (
          <div className="flex items-center gap-1">
            <span className="text-[#556b73]">Spread</span>
            <span className="font-semibold text-[#c8d4d7] tabular-nums">
              ${spread.abs.toFixed(2)}
            </span>
            <span className="rounded bg-[#122327] px-1 py-0.2 text-[9px] text-[#22d3ee] border border-[#1d4a50] tabular-nums font-semibold">
              {spread.bps.toFixed(1)} bps
            </span>
          </div>
        ) : (
          <span className="text-[#556b73]">Spread: --</span>
        )}
      </div>
    </div>
  );
}
