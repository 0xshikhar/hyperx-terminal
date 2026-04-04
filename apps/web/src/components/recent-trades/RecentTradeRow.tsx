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
  const notional = price * size;
  const isWhale = notional >= 25000;
  const isLarge = notional >= 10000 && !isWhale;

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
      title={`Click to set price: $${price.toLocaleString()} · Notional: $${Math.round(notional).toLocaleString()}`}
      className={cn(
        "flex h-6 items-center justify-between px-3 text-[11px] font-mono cursor-pointer select-none transition-colors",
        isWhale
          ? "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-l-2 border-amber-400 shadow-[inset_0_0_8px_rgba(245,158,11,0.1)] hover:bg-amber-500/20"
          : isLarge
            ? "bg-cyan-500/5 hover:bg-cyan-500/10"
            : "hover:bg-[rgba(255,255,255,0.06)] active:bg-[rgba(255,255,255,0.1)]"
      )}
      data-ts={timestamp}
    >
      {/* Price */}
      <span
        className={cn(
          "tabular-nums font-semibold",
          side === "buy" ? "text-[#00d084]" : "text-[#ff4757]"
        )}
      >
        {price.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: price >= 1000 ? 2 : 4,
        })}
      </span>

      {/* Size with Whale Tag */}
      <div className="flex items-center gap-1.5 tabular-nums">
        <span
          className={cn(
            isWhale
              ? "text-amber-300 font-bold"
              : isLarge
                ? "text-white font-medium"
                : "text-[#8da0a4]"
          )}
        >
          {size.toFixed(4)}
        </span>
        {isWhale && (
          <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[8px] font-bold text-amber-400 border border-amber-500/30 tracking-tight">
            🐋 ${Math.round(notional / 1000)}k
          </span>
        )}
      </div>

      {/* Time */}
      <span className="tabular-nums text-[#506068] text-[10px]">{time}</span>
    </div>
  );
}, areEqual);

function areEqual(prev: RecentTradeRowProps, next: RecentTradeRowProps) {
  return (
    prev.timestamp === next.timestamp &&
    prev.price === next.price &&
    prev.size === next.size &&
    prev.side === next.side
  );
}
