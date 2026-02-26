import { memo } from "react";
import { cn } from "@/lib/utils";

export type RecentTradeRowProps = {
  side: "buy" | "sell";
  price: number;
  size: number;
  timestamp: number;
  time: string;
};

export const RecentTradeRow = memo(function RecentTradeRow({
  side,
  price,
  size,
  timestamp,
  time,
}: RecentTradeRowProps) {
  return (
    <div
      className="flex h-8 items-center justify-between px-2 text-xs font-mono"
      data-ts={timestamp}
    >
      <span className="text-muted-foreground">{time}</span>
      <span className={cn(side === "buy" ? "text-emerald-500" : "text-rose-500")}>
        {price.toLocaleString()}
      </span>
      <span className="text-muted-foreground">{size.toFixed(4)}</span>
    </div>
  );
}, areEqual);

function areEqual(prev: RecentTradeRowProps, next: RecentTradeRowProps) {
  return prev.timestamp === next.timestamp && prev.price === next.price && prev.size === next.size;
}
