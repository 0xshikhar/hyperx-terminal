import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useIsPaperTrading } from "@/hooks/useIsPaperTrading";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { terminalAudio } from "@/lib/terminalAudio";
import { cn } from "@/lib/utils";
import type { Position } from "@/store/positionsStore";
import { toast } from "sonner";
import { Percent, ArrowDownRight, ArrowUpRight } from "lucide-react";

interface PartialCloseModalProps {
  position: Position | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseSuccess?: () => void;
}

export function PartialCloseModal({
  position,
  open,
  onOpenChange,
  onCloseSuccess,
}: PartialCloseModalProps) {
  const isPaperTrading = useIsPaperTrading();
  const partialClosePosition = usePaperTradingStore((s) => s.partialClosePosition);
  const paperBalance = usePaperTradingStore((s) => s.balance);

  const [closeType, setCloseType] = useState<"market" | "limit">("market");
  const [percentage, setPercentage] = useState<number>(50);
  const [customSize, setCustomSize] = useState<string>("");
  const [limitPrice, setLimitPrice] = useState<string>("");

  useEffect(() => {
    if (position) {
      const initialSize = (position.size * 0.5).toFixed(4);
      setPercentage(50);
      setCustomSize(initialSize);
      setLimitPrice(position.markPrice.toFixed(2));
      setCloseType("market");
    }
  }, [position, open]);

  if (!position) return null;

  const totalSize = position.size;
  const isLong = position.side === "long";
  const effectivePrice = closeType === "limit" ? Number(limitPrice) || position.markPrice : position.markPrice;

  const handlePercentageChange = (pct: number) => {
    setPercentage(pct);
    const newSize = (totalSize * (pct / 100)).toFixed(4);
    setCustomSize(newSize);
  };

  const handleCustomSizeChange = (val: string) => {
    setCustomSize(val);
    const numericVal = parseFloat(val);
    if (!isNaN(numericVal) && totalSize > 0) {
      const pct = Math.min(100, Math.max(0, (numericVal / totalSize) * 100));
      setPercentage(Math.round(pct));
    }
  };

  const parsedSize = Math.min(totalSize, Math.max(0, parseFloat(customSize) || 0));
  const remainingSize = Math.max(0, totalSize - parsedSize);
  const direction = isLong ? 1 : -1;
  const estimatedRealizedPnl = (effectivePrice - position.entryPrice) * parsedSize * direction;
  const marginReleased = totalSize > 0 ? position.margin * (parsedSize / totalSize) : 0;
  const estimatedBalanceAfter = isPaperTrading
    ? paperBalance + marginReleased + estimatedRealizedPnl
    : 0;

  const isProfit = estimatedRealizedPnl >= 0;

  const handleSubmit = () => {
    if (parsedSize <= 0) {
      toast.error("Please enter a valid size to close");
      return;
    }

    terminalAudio.playOrderSubmit();

    if (isPaperTrading) {
      const result = partialClosePosition(
        position.id,
        parsedSize,
        closeType === "limit" ? Number(limitPrice) : undefined,
        closeType
      );

      terminalAudio.playOrderFill();

      if (closeType === "limit") {
        toast.success(
          `Placed limit reduce-only order: ${parsedSize.toFixed(4)} ${position.market} @ $${Number(limitPrice).toLocaleString()}`
        );
      } else {
        const sign = result.realizedPnl >= 0 ? "+" : "";
        toast.success(
          `Closed ${parsedSize.toFixed(4)} ${position.market} (${sign}$${result.realizedPnl.toFixed(2)})`
        );
      }

      onCloseSuccess?.();
      onOpenChange(false);
    } else {
      toast.info(`Submitted live partial close for ${parsedSize.toFixed(4)} ${position.market}`);
      onCloseSuccess?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#1a2e35] bg-[#071317] p-0 text-white shadow-2xl overflow-hidden font-mono">
        <DialogHeader className="p-4 border-b border-[#14262c]">
          <DialogTitle className="flex items-center gap-2 text-sm tracking-wide text-[#dde5e7]">
            <Percent className="h-4 w-4 text-[#22d3ee]" />
            PARTIAL POSITION CLOSE
          </DialogTitle>
          <DialogDescription className="text-xs text-[#8ea2a6]">
            Scale out of your position with precision sizing and instant PnL preview.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Position Info Banner */}
          <div className="rounded border border-[#173038] bg-[#0b1c21] p-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#14262c]">
              <div className="flex items-center gap-2 font-semibold">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                    isLong ? "bg-emerald-500/20 text-[#00d084]" : "bg-rose-500/20 text-[#ff4757]"
                  )}
                >
                  {position.side} {position.leverage}x
                </span>
                <span className="text-white">{position.market}</span>
              </div>
              <span className="text-[#8ea2a6]">Total: {position.size.toFixed(4)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
              <div>
                <span className="text-[#627a80] block text-[10px]">ENTRY</span>
                <span className="text-[#dde5e7]">${position.entryPrice.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[#627a80] block text-[10px]">MARK</span>
                <span className="text-[#dde5e7]">${position.markPrice.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[#627a80] block text-[10px]">CURRENT PNL</span>
                <span className={cn("font-semibold", position.pnl >= 0 ? "text-[#00d084]" : "text-[#ff4757]")}>
                  {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Execution Type Switcher */}
          <div className="grid grid-cols-2 rounded border border-[#182c33] bg-[#09181c] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setCloseType("market")}
              className={cn(
                "py-1.5 rounded text-center transition-all font-semibold cursor-pointer",
                closeType === "market"
                  ? "bg-[#16363f] text-[#22d3ee] shadow"
                  : "text-[#7f9499] hover:text-white"
              )}
            >
              Market Close
            </button>
            <button
              type="button"
              onClick={() => setCloseType("limit")}
              className={cn(
                "py-1.5 rounded text-center transition-all font-semibold cursor-pointer",
                closeType === "limit"
                  ? "bg-[#16363f] text-[#22d3ee] shadow"
                  : "text-[#7f9499] hover:text-white"
              )}
            >
              Limit Close (Reduce-Only)
            </button>
          </div>

          {/* Limit Price Input if closeType === "limit" */}
          {closeType === "limit" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-[#8ea2a6]">
                <span>Limit Price (USD)</span>
                <button
                  type="button"
                  onClick={() => setLimitPrice(position.markPrice.toFixed(2))}
                  className="text-[10px] text-[#22d3ee] hover:underline cursor-pointer"
                >
                  Use Mark (${position.markPrice.toFixed(2)})
                </button>
              </div>
              <input
                type="number"
                step="any"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="Enter limit exit price"
                className="w-full rounded border border-[#19333b] bg-[#08171b] px-3 py-2 text-xs text-white focus:border-[#22d3ee] focus:outline-none"
              />
            </div>
          )}

          {/* Quick Percentage Pills */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[#8ea2a6]">
              <span>Close Percentage</span>
              <span className="text-[#22d3ee] font-semibold">{percentage}%</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handlePercentageChange(pct)}
                  className={cn(
                    "py-1.5 rounded border text-xs font-semibold transition-all cursor-pointer",
                    percentage === pct
                      ? "border-[#22d3ee] bg-[#16363f] text-[#22d3ee]"
                      : "border-[#193238] bg-[#0a1b20] text-[#8ea2a6] hover:bg-[#112830] hover:text-white"
                  )}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Slider */}
          <div className="pt-1">
            <input
              type="range"
              min="1"
              max="100"
              value={percentage}
              onChange={(e) => handlePercentageChange(Number(e.target.value))}
              className="w-full h-1.5 bg-[#12282f] rounded-lg appearance-none cursor-pointer accent-[#22d3ee]"
            />
          </div>

          {/* Close Size Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-[#8ea2a6]">
              <span>Close Quantity</span>
              <span>Max: {totalSize.toFixed(4)}</span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                value={customSize}
                onChange={(e) => handleCustomSizeChange(e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-[#19333b] bg-[#08171b] px-3 py-2 pr-16 text-xs text-white focus:border-[#22d3ee] focus:outline-none"
              />
              <span className="absolute right-3 top-2 text-xs text-[#627a80]">
                {position.market.split("-")[0] || "BASE"}
              </span>
            </div>
          </div>

          {/* Dynamic Telemetry Preview */}
          <div className="rounded border border-[#152e35] bg-[#091a1f]/80 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#8ea2a6]">Est. Realized P&L:</span>
              <span className={cn("font-bold tabular-nums flex items-center gap-1", isProfit ? "text-[#00d084]" : "text-[#ff4757]")}>
                {isProfit ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {isProfit ? "+" : ""}${estimatedRealizedPnl.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#8ea2a6]">Margin Released:</span>
              <span className="text-white tabular-nums">${marginReleased.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#8ea2a6]">Remaining Position:</span>
              <span className="text-[#dde5e7] tabular-nums font-semibold">
                {remainingSize.toFixed(4)} {position.market.split("-")[0]}
              </span>
            </div>

            {isPaperTrading && (
              <div className="flex items-center justify-between pt-1 border-t border-[#13282e]">
                <span className="text-[#627a80]">Est. Balance After:</span>
                <span className="text-[#22d3ee] tabular-nums font-semibold">
                  ${estimatedBalanceAfter.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={parsedSize <= 0}
            className={cn(
              "w-full font-mono font-bold tracking-wider py-5 text-xs transition-all cursor-pointer",
              closeType === "market"
                ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-950/50"
                : "bg-[#22d3ee] hover:bg-[#1fb8cf] text-[#051518] shadow-cyan-950/50"
            )}
          >
            {closeType === "market"
              ? `CLOSE ${parsedSize.toFixed(4)} AT MARKET`
              : `PLACE REDUCE-ONLY LIMIT ORDER`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
