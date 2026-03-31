import { memo } from "react";
import { cn } from "@/lib/utils";
import { OrderBookDepthBar } from "@/components/orderbook/OrderBookDepthBar";
import { dispatchTerminalAction } from "@/lib/terminalActions";
import { terminalAudio } from "@/lib/terminalAudio";

export type OrderBookRowData = {
  price: number;
  size: number;
  total?: number;
  depthPercent: number;
  side: "bid" | "ask";
  isMine?: boolean;
};

export const OrderBookRow = memo(function OrderBookRow({
  price,
  size,
  total,
  depthPercent,
  side,
  isMine = false,
}: OrderBookRowData) {
  const handleClickRow = () => {
    terminalAudio.playClick();
    dispatchTerminalAction({
      type: "prefill-order",
      price,
      side: side === "ask" ? "buy" : "sell",
      size: size.toFixed(4),
    });
  };

  const handleClickPrice = (e: React.MouseEvent) => {
    e.stopPropagation();
    terminalAudio.playClick();
    dispatchTerminalAction({
      type: "set-order-price",
      price,
    });
  };

  const handleClickSize = (e: React.MouseEvent) => {
    e.stopPropagation();
    terminalAudio.playClick();
    dispatchTerminalAction({
      type: "set-order-size",
      size: size.toFixed(4),
    });
  };

  const handleClickTotal = (e: React.MouseEvent) => {
    e.stopPropagation();
    terminalAudio.playClick();
    if (total !== undefined) {
      dispatchTerminalAction({
        type: "set-order-size",
        size: total.toFixed(4),
      });
    }
  };

  const formattedTotal = total !== undefined ? total.toFixed(4) : "--";

  return (
    <div
      onClick={handleClickRow}
      role="button"
      tabIndex={0}
      title={`Click to fill: ${side === "ask" ? "Buy" : "Sell"} @ $${price}`}
      className="group relative flex h-6 items-center px-3 cursor-pointer hover:bg-[rgba(255,255,255,0.06)] active:bg-[rgba(255,255,255,0.1)] transition-colors select-none"
    >
      <OrderBookDepthBar percent={depthPercent} side={side} />
      <div className="relative z-10 grid w-full grid-cols-3 items-center text-[11px] font-mono">
        <span
          onClick={handleClickPrice}
          title={`Click to set price: $${price}`}
          className={cn(
            "price-cell text-left hover:underline hover:brightness-125 transition-all truncate",
            side === "bid" ? "text-[#00d084]" : "text-[#ff4757]",
            isMine && "font-semibold"
          )}
        >
          {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span
          onClick={handleClickSize}
          title={`Click to set size: ${size.toFixed(4)}`}
          className={cn(
            "text-right tabular-nums text-[#8da0a4] hover:text-white hover:underline transition-colors truncate",
            isMine && "text-foreground font-semibold"
          )}
        >
          {size.toFixed(4)}
        </span>
        <span
          onClick={handleClickTotal}
          title={`Click to sweep depth up to $${price}: ${formattedTotal}`}
          className="text-right tabular-nums text-[#4e656d] hover:text-[#22d3ee] hover:underline transition-colors truncate"
        >
          {formattedTotal}
        </span>
      </div>
      {isMine && (
        <span
          className={cn(
            "absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full",
            side === "bid" ? "bg-[#00d084]" : "bg-[#ff4757]"
          )}
        />
      )}
    </div>
  );
}, areEqual);

function areEqual(prev: OrderBookRowData, next: OrderBookRowData) {
  return (
    prev.price === next.price &&
    prev.size === next.size &&
    prev.total === next.total &&
    prev.depthPercent === next.depthPercent &&
    prev.side === next.side &&
    prev.isMine === next.isMine
  );
}
