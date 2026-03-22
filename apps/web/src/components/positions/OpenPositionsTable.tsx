import { useMemo } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { usePositions } from "@/hooks/usePositions";
import { useNetworkStore } from "@/store/networkStore";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { cn } from "@/lib/utils";
import type { Position } from "@/store/positionsStore";
import { toast } from "sonner";
import { X } from "lucide-react";

const ROW_HEIGHT = 38;

const headers = ["Market", "Side", "Size", "Entry", "Mark", "PnL", "Margin", "Lev", "Action"];

const formatNumber = (value: number, fractionDigits = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

const formatPrice = (value: number) => formatNumber(value, value >= 1000 ? 2 : 4);

export function OpenPositionsTable() {
  const isPaperTrading = useNetworkStore((s) => s.isPaperTrading);
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
    const pnlClass = position.pnl >= 0 ? "text-emerald-400" : "text-rose-400";

    return (
      <div
        style={style}
        className="grid grid-cols-9 items-center border-b border-border/50 px-2 text-xs font-mono text-foreground hover:bg-secondary/20"
      >
        <span className="font-semibold">{position.market}</span>
        <span className={cn("uppercase font-medium", position.side === "long" ? "text-emerald-400" : "text-rose-400")}>
          {position.side}
        </span>
        <span>{formatNumber(position.size, 4)}</span>
        <span>{formatPrice(position.entryPrice)}</span>
        <span>{formatPrice(position.markPrice)}</span>
        <span className={pnlClass}>
          {position.pnl >= 0 ? "+" : ""}
          {formatNumber(position.pnl, 2)} ({position.pnlPercent >= 0 ? "+" : ""}
          {formatNumber(position.pnlPercent, 2)}%)
        </span>
        <span>{formatNumber(position.margin, 2)}</span>
        <span>{position.leverage}x</span>
        <span>
          {isPaperTrading ? (
            <button
              onClick={() => {
                const { realizedPnl } = closePaperPosition(position.id);
                toast.success(
                  `Closed ${position.side.toUpperCase()} ${position.market} (${realizedPnl >= 0 ? "+" : ""}$${realizedPnl.toFixed(2)})`
                );
              }}
              className="flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/20"
              title="Market close position"
            >
              <X className="h-2.5 w-2.5" />
              Close
            </button>
          ) : (
            <span className="text-muted-foreground text-[10px]">--</span>
          )}
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="grid grid-cols-9 border-b border-border px-2 py-2 text-[10px] uppercase text-muted-foreground font-mono">
        {headers.map((header) => (
          <span key={header}>{header}</span>
        ))}
      </div>
      {!isPaperTrading && isLoading ? (
        <div className="px-3 py-8 text-xs text-muted-foreground">Loading positions…</div>
      ) : !isPaperTrading && error ? (
        <div className="flex flex-col items-center gap-2 px-3 py-8">
          <p className="text-xs text-rose-400">Failed to load positions</p>
          <button
            onClick={() => fetchPositions()}
            className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Retry
          </button>
        </div>
      ) : positions.length === 0 ? (
        <div className="px-3 py-8 text-center text-xs text-muted-foreground">
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
