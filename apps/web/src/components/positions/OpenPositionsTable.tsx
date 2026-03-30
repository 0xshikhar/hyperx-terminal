import { useMemo, useState, memo } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { usePositions } from "@/hooks/usePositions";
import { useIsPaperTrading } from "@/hooks/useIsPaperTrading";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { cn } from "@/lib/utils";
import type { Position } from "@/store/positionsStore";
import { toast } from "sonner";
import { X, Share2, RefreshCw } from "lucide-react";
import { PnLShareModal } from "@/components/positions/PnLShareModal";
import { terminalAudio } from "@/lib/terminalAudio";

const ROW_HEIGHT = 40;

const headers = ["Market", "Side", "Size", "Entry", "Mark", "Liq Price", "PnL", "Margin", "Lev", "Actions"];

const formatNumber = (value: number, fractionDigits = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

const formatPrice = (value: number) => formatNumber(value, value >= 1000 ? 2 : 4);

interface RowItemData {
  positions: Position[];
  isPaperTrading: boolean;
  onClose: (pos: Position) => void;
  onReverse: (pos: Position) => void;
  onShare: (pos: Position) => void;
}

const PositionRow = memo(({ index, style, data }: ListChildComponentProps<RowItemData>) => {
  const { positions, onClose, onReverse, onShare } = data;
  const position = positions[index];
  if (!position) return null;
  const pnlClass = position.pnl >= 0 ? "text-[#00d084]" : "text-[#ff4757]";

  const liqPrice =
    position.side === "long"
      ? Math.max(0, position.entryPrice * (1 - 0.9 / (position.leverage || 10)))
      : position.entryPrice * (1 + 0.9 / (position.leverage || 10));

  // Risk closeness (within 5% of liquidation is critical danger)
  const isNearLiquidation =
    position.side === "long"
      ? position.markPrice <= liqPrice * 1.05
      : position.markPrice >= liqPrice * 0.95;

  return (
    <div
      style={style}
      className={cn(
        "grid grid-cols-10 items-center border-b border-[#142228] px-2 text-xs font-mono text-white hover:bg-[#112025]/50 transition-colors",
        isNearLiquidation && "bg-rose-950/20 border-rose-500/30"
      )}
    >
      <div className="flex items-center gap-1.5 font-semibold">
        <span>{position.market}</span>
        {isNearLiquidation && (
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" title="Close to liquidation price!" />
        )}
      </div>
      <span className={cn("uppercase font-medium", position.side === "long" ? "text-[#00d084]" : "text-[#ff4757]")}>
        {position.side}
      </span>
      <span className="tabular-nums">{formatNumber(position.size, 4)}</span>
      <span className="text-[#c8d4d7] tabular-nums">${formatPrice(position.entryPrice)}</span>
      <span className="text-[#c8d4d7] tabular-nums">${formatPrice(position.markPrice)}</span>
      <span className={cn("tabular-nums", isNearLiquidation ? "text-rose-400 font-bold" : "text-amber-400/90")}>
        ${formatPrice(liqPrice)}
      </span>
      <span className={cn("tabular-nums font-semibold", pnlClass)}>
        {position.pnl >= 0 ? "+" : ""}
        ${formatNumber(position.pnl, 2)} ({position.pnlPercent >= 0 ? "+" : ""}
        {formatNumber(position.pnlPercent, 2)}%)
      </span>
      <span className="text-[#c8d4d7] tabular-nums">${formatNumber(position.margin, 2)}</span>
      <span className="text-[#8ea4a9]">{position.leverage}x</span>
      <div className="flex items-center gap-1">
        {/* Share PnL */}
        <button
          onClick={() => onShare(position)}
          className="flex h-6 w-6 items-center justify-center rounded border border-[#1e3b43] bg-[#0c242a] text-[#22d3ee] hover:bg-[#12363f] hover:text-white transition-colors"
          title="Share P&L Card"
        >
          <Share2 className="h-2.5 w-2.5" />
        </button>

        {/* Reverse Position */}
        <button
          onClick={() => onReverse(position)}
          className="flex h-6 w-6 items-center justify-center rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors"
          title="Reverse Position (Flip side at market)"
        >
          <RefreshCw className="h-2.5 w-2.5" />
        </button>

        {/* Market Close */}
        <button
          onClick={() => onClose(position)}
          className="flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/20 transition-colors"
          title="Market close position"
        >
          <X className="h-2.5 w-2.5" />
          Close
        </button>
      </div>
    </div>
  );
});

PositionRow.displayName = "PositionRow";

export function OpenPositionsTable() {
  const isPaperTrading = useIsPaperTrading();
  const { positions: realPositions, isLoading, error, fetchPositions } = usePositions();
  const paperPositions = usePaperTradingStore((s) => s.positions);
  const closePaperPosition = usePaperTradingStore((s) => s.closePosition);
  const executeOrder = usePaperTradingStore((s) => s.executeOrder);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  const positions = useMemo(() => {
    return isPaperTrading ? paperPositions : realPositions;
  }, [isPaperTrading, paperPositions, realPositions]);

  const handleClose = (position: Position) => {
    terminalAudio.playClick();
    if (isPaperTrading) {
      const { realizedPnl } = closePaperPosition(position.id);
      terminalAudio.playOrderFill();
      toast.success(
        `Closed ${position.side.toUpperCase()} ${position.market} (${realizedPnl >= 0 ? "+" : ""}$${realizedPnl.toFixed(2)})`
      );
    } else {
      toast.info(`Closing live ${position.market} position on Starknet...`);
    }
  };

  const handleReverse = (position: Position) => {
    terminalAudio.playOrderSubmit();
    if (isPaperTrading) {
      closePaperPosition(position.id);
      const oppositeSide = position.side === "long" ? "sell" : "buy";
      executeOrder(
        {
          market: position.market,
          side: oppositeSide,
          type: "market",
          size: position.size,
          leverage: position.leverage || 10,
        },
        position.markPrice
      );
      terminalAudio.playOrderFill();
      toast.success(
        `⚡ Reversed position: Now ${oppositeSide.toUpperCase()} ${position.size} ${position.market}`
      );
    } else {
      toast.info(`Reverse position submitted for ${position.market}...`);
    }
  };

  const handleShare = (position: Position) => {
    terminalAudio.playClick();
    setSelectedPosition(position);
    setShareModalOpen(true);
  };

  const rowData: RowItemData = useMemo(
    () => ({
      positions,
      isPaperTrading,
      onClose: handleClose,
      onReverse: handleReverse,
      onShare: handleShare,
    }),
    [positions, isPaperTrading]
  );

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
          itemData={rowData}
        >
          {PositionRow}
        </FixedSizeList>
      )}

      {/* PnL Share Card Modal */}
      <PnLShareModal
        position={selectedPosition}
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
      />
    </div>
  );
}
