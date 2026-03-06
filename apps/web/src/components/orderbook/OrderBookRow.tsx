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
    <div className="relative flex h-8 items-center justify-between px-2 text-xs font-mono">
      <OrderBookDepthBar percent={depthPercent} side={side} />
      <span
        className={cn(
          side === "bid" ? "text-emerald-500" : "text-rose-500",
          isMine && "font-semibold"
        )}
      >
        {price.toLocaleString()}
      </span>
      <span className={cn("text-muted-foreground", isMine && "text-foreground")}>
        {size.toFixed(4)}
      </span>
      {isMine && (
        <span
          className={cn(
            "absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full",
            side === "bid" ? "bg-emerald-400" : "bg-rose-400"
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
