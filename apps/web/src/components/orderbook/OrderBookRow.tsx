import { memo } from "react";
import { cn } from "@/lib/utils";
import { OrderBookDepthBar } from "@/components/orderbook/OrderBookDepthBar";

export type OrderBookRowData = {
  price: number;
  size: number;
  depthPercent: number;
  side: "bid" | "ask";
};

export const OrderBookRow = memo(function OrderBookRow({
  price,
  size,
  depthPercent,
  side,
}: OrderBookRowData) {
  return (
    <div className="relative flex h-8 items-center justify-between px-2 text-xs font-mono">
      <OrderBookDepthBar percent={depthPercent} side={side} />
      <span
        className={cn(side === "bid" ? "text-emerald-500" : "text-rose-500")}
      >
        {price.toLocaleString()}
      </span>
      <span className="text-muted-foreground">{size.toFixed(4)}</span>
    </div>
  );
}, areEqual);

function areEqual(prev: OrderBookRowData, next: OrderBookRowData) {
  return prev.price === next.price && prev.size === next.size;
}
