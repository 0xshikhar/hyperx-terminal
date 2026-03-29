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
      className="flex h-6 items-center justify-between px-3 text-[11px] font-mono hover:bg-[rgba(255,255,255,0.03)] cursor-default"
      data-ts={timestamp}
    >
      <span className={cn("tabular-nums", side === "buy" ? "text-[#00d084]" : "text-[#ff4757]")}>
        {price.toLocaleString()}
      </span>
      <span className="tabular-nums text-[#8da0a4]">{size.toFixed(4)}</span>
      <span className="tabular-nums text-[#506068]">{time}</span>
    </div>
  );
}, areEqual);

function areEqual(prev: RecentTradeRowProps, next: RecentTradeRowProps) {
  return prev.timestamp === next.timestamp && prev.price === next.price && prev.size === next.size;
}
