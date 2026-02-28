import { useMemo } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { usePositions } from "@/hooks/usePositions";
import { cn } from "@/lib/utils";
import type { Position } from "@/store/positionsStore";

const ROW_HEIGHT = 36;

const headers = ["Market", "Side", "Size", "Entry", "Mark", "PnL", "Margin", "Lev"];

const formatNumber = (value: number, fractionDigits = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

const formatPrice = (value: number) => formatNumber(value, value >= 1000 ? 2 : 4);

export function OpenPositionsTable() {
  const { positions, isLoading, error, fetchPositions } = usePositions();
  const listData = useMemo(() => positions, [positions]);

  const Row = ({ index, style, data }: ListChildComponentProps<Position[]>) => {
    const position = data[index];
    if (!position) return null;
    const pnlClass = position.pnl >= 0 ? "text-emerald-500" : "text-rose-500";
    return (
      <div
        style={style}
        className="grid grid-cols-8 items-center border-b border-border px-2 text-xs font-mono text-foreground"
      >
        <span className="font-semibold">{position.market}</span>
        <span className={cn("uppercase", position.side === "long" ? "text-emerald-400" : "text-rose-400")}>
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
      </div>
    );
  };

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="grid grid-cols-8 border-b border-border px-2 py-2 text-[10px] uppercase text-muted-foreground">
        {headers.map((header) => (
          <span key={header}>{header}</span>
        ))}
      </div>
      {isLoading ? (
        <div className="px-3 py-8 text-xs text-muted-foreground">Loading positions…</div>
      ) : error ? (
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
        <div className="px-3 py-8 text-xs text-muted-foreground">No open positions.</div>
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
