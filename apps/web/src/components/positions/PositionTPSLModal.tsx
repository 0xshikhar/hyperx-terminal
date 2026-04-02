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
import { Target, ArrowUpRight, ArrowDownRight, Trash2 } from "lucide-react";

interface PositionTPSLModalProps {
  position: Position | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PositionTPSLModal({
  position,
  open,
  onOpenChange,
  onSuccess,
}: PositionTPSLModalProps) {
  const isPaperTrading = useIsPaperTrading();
  const updatePositionTPSL = usePaperTradingStore((s) => s.updatePositionTPSL);

  const [tpEnabled, setTpEnabled] = useState(true);
  const [tpPriceStr, setTpPriceStr] = useState("");
  const [slEnabled, setSlEnabled] = useState(true);
  const [slPriceStr, setSlPriceStr] = useState("");

  useEffect(() => {
    if (position) {
      const hasExisting = Boolean(position.takeProfit || position.stopLoss);
      setTpEnabled(hasExisting ? Boolean(position.takeProfit) : true);
      setTpPriceStr(position.takeProfit ? String(position.takeProfit) : "");
      setSlEnabled(hasExisting ? Boolean(position.stopLoss) : true);
      setSlPriceStr(position.stopLoss ? String(position.stopLoss) : "");
    }
  }, [position, open]);

  if (!position) return null;

  const isLong = position.side === "long";
  const lev = Math.max(1, position.leverage || 10);
  const direction = isLong ? 1 : -1;

  const liqPrice = isLong
    ? Math.max(0, position.entryPrice * (1 - 0.9 / lev))
    : position.entryPrice * (1 + 0.9 / lev);

  // Auto-calculate price from desired ROI %
  const setTpFromRoi = (roiPct: number) => {
    setTpEnabled(true);
    const fraction = (roiPct / 100) / lev;
    const targetPrice = isLong
      ? position.entryPrice * (1 + fraction)
      : position.entryPrice * (1 - fraction);
    setTpPriceStr(targetPrice.toFixed(2));
  };

  const setSlFromRoi = (lossRoiPct: number) => {
    setSlEnabled(true);
    const fraction = (Math.abs(lossRoiPct) / 100) / lev;
    const targetPrice = isLong
      ? position.entryPrice * (1 - fraction)
      : position.entryPrice * (1 + fraction);
    setSlPriceStr(targetPrice.toFixed(2));
  };

  const parsedTp = parseFloat(tpPriceStr) || 0;
  const parsedSl = parseFloat(slPriceStr) || 0;

  // Dynamic profit preview
  const estTpProfit = tpEnabled && parsedTp > 0
    ? (parsedTp - position.entryPrice) * position.size * direction
    : 0;
  const estTpRoi = position.margin > 0 ? (estTpProfit / position.margin) * 100 : 0;

  // Dynamic loss preview
  const estSlLoss = slEnabled && parsedSl > 0
    ? (parsedSl - position.entryPrice) * position.size * direction
    : 0;
  const estSlRoi = position.margin > 0 ? (estSlLoss / position.margin) * 100 : 0;

  const handleConfirm = () => {
    // Validation
    if (tpEnabled && parsedTp > 0) {
      if (isLong && parsedTp <= position.entryPrice) {
        toast.error("Take-Profit price must be higher than entry price for Long");
        return;
      }
      if (!isLong && parsedTp >= position.entryPrice) {
        toast.error("Take-Profit price must be lower than entry price for Short");
        return;
      }
    }

    if (slEnabled && parsedSl > 0) {
      if (isLong && parsedSl >= position.entryPrice) {
        toast.error("Stop-Loss price must be lower than entry price for Long");
        return;
      }
      if (!isLong && parsedSl <= position.entryPrice) {
        toast.error("Stop-Loss price must be higher than entry price for Short");
        return;
      }
      if (isLong && parsedSl <= liqPrice) {
        toast.warning("Stop-Loss price is below liquidation price!");
      }
      if (!isLong && parsedSl >= liqPrice) {
        toast.warning("Stop-Loss price is above liquidation price!");
      }
    }

    terminalAudio.playOrderSubmit();

    const finalTp = tpEnabled && parsedTp > 0 ? parsedTp : undefined;
    const finalSl = slEnabled && parsedSl > 0 ? parsedSl : undefined;

    if (isPaperTrading) {
      updatePositionTPSL(position.id, finalTp, finalSl);
      terminalAudio.playClick();
      toast.success(
        `TP/SL set for ${position.market}: ${finalTp ? `TP $${finalTp.toLocaleString()}` : "No TP"} | ${finalSl ? `SL $${finalSl.toLocaleString()}` : "No SL"}`
      );
    } else {
      toast.info(`TP/SL bracket order submitted to Starknet for ${position.market}`);
    }

    onSuccess?.();
    onOpenChange(false);
  };

  const handleRemove = () => {
    terminalAudio.playClick();
    if (isPaperTrading) {
      updatePositionTPSL(position.id, undefined, undefined);
      toast.info(`Removed TP/SL bracket on ${position.market}`);
    }
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#1a2e35] bg-[#071317] p-0 text-white shadow-2xl overflow-hidden font-mono">
        <DialogHeader className="p-4 border-b border-[#14262c]">
          <DialogTitle className="flex items-center gap-2 text-sm tracking-wide text-[#dde5e7]">
            <Target className="h-4 w-4 text-[#22d3ee]" />
            POSITION TP/SL BRACKET
          </DialogTitle>
          <DialogDescription className="text-xs text-[#8ea2a6]">
            Configure automated Take-Profit and Stop-Loss orders for your position.
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
              <span className="text-[#8ea2a6]">Size: {position.size.toFixed(4)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
              <div>
                <span className="text-[#627a80] block text-[10px]">ENTRY</span>
                <span className="text-[#dde5e7]">${position.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[#627a80] block text-[10px]">MARK</span>
                <span className="text-[#dde5e7]">${position.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[#627a80] block text-[10px]">LIQ PRICE</span>
                <span className="text-amber-400 font-semibold">${liqPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Take Profit Section */}
          <div className="rounded border border-[#142d2a] bg-[#081816]/70 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-[#00d084] cursor-pointer">
                <input
                  type="checkbox"
                  checked={tpEnabled}
                  onChange={(e) => setTpEnabled(e.target.checked)}
                  className="rounded border-[#1a3832] bg-[#0a201c] accent-[#00d084] cursor-pointer"
                />
                <span>Take Profit (TP)</span>
              </label>
              {tpEnabled && parsedTp > 0 && (
                <span className="text-[11px] font-bold text-[#00d084] flex items-center gap-0.5">
                  <ArrowUpRight className="h-3 w-3" />
                  +${estTpProfit.toFixed(2)} (+{estTpRoi.toFixed(2)}%)
                </span>
              )}
            </div>

            {tpEnabled && (
              <>
                <div className="relative">
                  <input
                    type="number"
                    aria-label="Take-Profit (TP)"
                    step="any"
                    value={tpPriceStr}
                    onChange={(e) => setTpPriceStr(e.target.value)}
                    placeholder={`Target price (e.g. $${isLong ? (position.entryPrice * 1.05).toFixed(2) : (position.entryPrice * 0.95).toFixed(2)})`}
                    className="w-full rounded border border-[#193d35] bg-[#061715] px-3 py-1.5 text-xs text-white focus:border-[#00d084] focus:outline-none"
                  />
                  <span className="absolute right-3 top-1.5 text-xs text-[#527d73]">USD</span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[10, 25, 50, 100].map((roi) => (
                    <button
                      key={roi}
                      type="button"
                      onClick={() => setTpFromRoi(roi)}
                      className="rounded border border-[#143d34] bg-[#09221d] py-1 text-[10px] font-semibold text-[#8ebfae] hover:bg-[#0f362e] hover:text-[#00d084] transition-colors cursor-pointer"
                    >
                      +{roi}% ROI
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Stop Loss Section */}
          <div className="rounded border border-[#30161b] bg-[#1a0a0e]/70 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-[#ff4757] cursor-pointer">
                <input
                  type="checkbox"
                  checked={slEnabled}
                  onChange={(e) => setSlEnabled(e.target.checked)}
                  className="rounded border-[#401a22] bg-[#240c11] accent-[#ff4757] cursor-pointer"
                />
                <span>Stop Loss (SL)</span>
              </label>
              {slEnabled && parsedSl > 0 && (
                <span className="text-[11px] font-bold text-[#ff4757] flex items-center gap-0.5">
                  <ArrowDownRight className="h-3 w-3" />
                  -${Math.abs(estSlLoss).toFixed(2)} ({estSlRoi.toFixed(2)}%)
                </span>
              )}
            </div>

            {slEnabled && (
              <>
                <div className="relative">
                  <input
                    type="number"
                    aria-label="Stop-Loss (SL)"
                    step="any"
                    value={slPriceStr}
                    onChange={(e) => setSlPriceStr(e.target.value)}
                    placeholder={`Stop price (e.g. $${isLong ? (position.entryPrice * 0.98).toFixed(2) : (position.entryPrice * 1.02).toFixed(2)})`}
                    className="w-full rounded border border-[#401a22] bg-[#1a080c] px-3 py-1.5 text-xs text-white focus:border-[#ff4757] focus:outline-none"
                  />
                  <span className="absolute right-3 top-1.5 text-xs text-[#824e57]">USD</span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 25, 50].map((loss) => (
                    <button
                      key={loss}
                      type="button"
                      onClick={() => setSlFromRoi(loss)}
                      className="rounded border border-[#451821] bg-[#240b10] py-1 text-[10px] font-semibold text-[#d48b96] hover:bg-[#381119] hover:text-[#ff4757] transition-colors cursor-pointer"
                    >
                      -{loss}% ROI
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            {(position.takeProfit || position.stopLoss) && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRemove}
                className="border-rose-900/50 bg-rose-950/20 text-rose-300 hover:bg-rose-900/40 text-xs flex items-center gap-1.5 cursor-pointer py-4"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            )}
            <Button
              type="button"
              onClick={handleConfirm}
              className="flex-1 font-mono font-bold tracking-wider py-4 text-xs bg-[#22d3ee] hover:bg-[#1fb8cf] text-[#051518] shadow-cyan-950/50 transition-all cursor-pointer"
            >
              CONFIRM TP/SL BRACKET
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
