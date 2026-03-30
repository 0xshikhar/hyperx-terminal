import { useMemo } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { usePositions } from "@/hooks/usePositions";
import { useIsPaperTrading } from "@/hooks/useIsPaperTrading";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { cn } from "@/lib/utils";
import type { Position } from "@/store/positionsStore";
import { toast } from "sonner";
import { X } from "lucide-react";

const ROW_HEIGHT = 38;

const headers = ["Market", "Side", "Size", "Entry", "Mark", "Liq Price", "PnL", "Margin", "Lev", "Action"];

const formatNumber = (value: number, fractionDigits = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

const formatPrice = (value: number) => formatNumber(value, value >= 1000 ? 2 : 4);

export function OpenPositionsTable() {
  const isPaperTrading = useIsPaperTrading();
  const { positions: realPositions, isLoading, error, fetchPositions } = usePositions();
  const paperPositions = usePaperTradingStore((s) => s.positions);
  const closePaperPosition = usePaperTradingStore((s) => s.closePosition);

  const positions = useMemo(() => {
    return isPaperTrading ? paperPositions : realPositions;
  }, [isPaperTrading, paperPositions, realPositions]);

  const listData = useMemo(() => positions, [positions]);

  const Row = ({ index, style, data }: ListChildComponentProps<Position[]>) => {
    const position = data[index];
    if (!position) return null;
    const pnlClass = position.pnl >= 0 ? "text-[#00d084]" : "text-[#ff4757]";

    const liqPrice =
      position.side === "long"
        ? Math.max(0, position.entryPrice * (1 - 0.9 / (position.leverage || 10)))
        : position.entryPrice * (1 + 0.9 / (position.leverage || 10));

    return (
      <div
        style={style}
        className="grid grid-cols-10 items-center border-b border-[#142228] px-2 text-xs font-mono text-white hover:bg-[#112025]/50"
      >
        <span className="font-semibold">{position.market}</span>
        <span className={cn("uppercase font-medium", position.side === "long" ? "text-[#00d084]" : "text-[#ff4757]")}>
          {position.side}
        </span>
        <span>{formatNumber(position.size, 4)}</span>
        <span className="text-[#c8d4d7]">{formatPrice(position.entryPrice)}</span>
        <span className="text-[#c8d4d7]">{formatPrice(position.markPrice)}</span>
        <span className="text-amber-400/90">{formatPrice(liqPrice)}</span>
        <span className={pnlClass}>
          {position.pnl >= 0 ? "+" : ""}
          {formatNumber(position.pnl, 2)} ({position.pnlPercent >= 0 ? "+" : ""}
          {formatNumber(position.pnlPercent, 2)}%)
        </span>
        <span className="text-[#c8d4d7]">{formatNumber(position.margin, 2)}</span>
        <span className="text-[#8ea4a9]">{position.leverage}x</span>
        <span>
          <button
            onClick={() => {
              if (isPaperTrading) {
                const { realizedPnl } = closePaperPosition(position.id);
                toast.success(
                  `Closed ${position.side.toUpperCase()} ${position.market} (${realizedPnl >= 0 ? "+" : ""}$${realizedPnl.toFixed(2)})`
                );
              } else {
                toast.info(`Closing live ${position.market} position on Starknet...`);
              }
            }}
            className="flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/20"
            title="Market close position"
          >
            <X className="h-2.5 w-2.5" />
            Close
          </button>
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-md border border-[#1a2830] bg-[#0c181b]">
      <div className="grid grid-cols-10 border-b border-[#1a2830] px-2 py-2 text-[10px] uppercase text-[#64748b] font-mono">
        {headers.map((header) => (
          <span key={header}>{header}</span>
        ))}
      </div>
      {!isPaperTrading && isLoading ? (
        <div className="px-3 py-8 text-xs text-[#64748b] text-center">Loading positions…</div>
      ) : !isPaperTrading && error ? (
        <div className="flex flex-col items-center gap-2 px-3 py-8">
          <p className="text-xs text-rose-400">Failed to load positions</p>
          <button
            onClick={() => fetchPositions()}
            className="rounded border border-[#1a2830] px-3 py-1 text-xs text-[#8ea4a9] hover:text-white"
          >
            Retry
          </button>
        </div>
      ) : positions.length === 0 ? (
        <div className="px-3 py-8 text-center text-xs text-[#64748b]">
          {isPaperTrading
            ? "No open paper positions. Place a market or limit order above to test execution."
            : "No open positions."}
        </div>
      ) : (
        <FixedSizeList
          height={Math.min(ROW_HEIGHT * positions.length, 260)}
          width="100%"
          itemCount={positions.length}
          itemSize={ROW_HEIGHT}
          itemData={listData}
        >
          {Row}
        </FixedSizeList>
      )}
    </div>
  );
}
