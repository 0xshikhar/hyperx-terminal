import { memo } from "react";
import { cn } from "@/lib/utils";
import { OrderBookDepthBar } from "@/components/orderbook/OrderBookDepthBar";

export type OrderBookRowData = {
  price: number;
  size: number;
  depthPercent: number;
  side: "bid" | "ask";
  isMine?: boolean;
};

export const OrderBookRow = memo(function OrderBookRow({
  price,
  size,
  depthPercent,
  side,
  isMine = false,
}: OrderBookRowData) {
  return (
    <div className="relative flex h-6 items-center justify-between px-3 text-[11px] font-mono cursor-default hover:bg-[rgba(255,255,255,0.03)]">
      <OrderBookDepthBar percent={depthPercent} side={side} />
      <span
        className={cn(
          "price-cell relative z-10",
          side === "bid" ? "text-[#00d084]" : "text-[#ff4757]",
          isMine && "font-semibold"
        )}
      >
        {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className={cn("relative z-10 tabular-nums text-[#8da0a4]", isMine && "text-foreground")}>
        {size.toFixed(4)}
      </span>
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
    prev.depthPercent === next.depthPercent &&
    prev.side === next.side &&
    prev.isMine === next.isMine
  );
}
