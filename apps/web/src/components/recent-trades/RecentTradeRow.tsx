import { memo } from "react";
import { cn } from "@/lib/utils";
import { dispatchTerminalAction } from "@/lib/terminalActions";
import { terminalAudio } from "@/lib/terminalAudio";

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
  const handleClick = () => {
    terminalAudio.playClick();
    dispatchTerminalAction({
      type: "set-order-price",
      price,
    });
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      title={`Click to use price: $${price.toLocaleString()}`}
      className="flex h-6 items-center justify-between px-3 text-[11px] font-mono hover:bg-[rgba(255,255,255,0.06)] active:bg-[rgba(255,255,255,0.1)] cursor-pointer select-none transition-colors"
      data-ts={timestamp}
    >
      <span className={cn("tabular-nums font-medium", side === "buy" ? "text-[#00d084]" : "text-[#ff4757]")}>
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
