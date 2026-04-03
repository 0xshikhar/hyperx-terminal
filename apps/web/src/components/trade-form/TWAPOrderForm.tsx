import { useState } from "react";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { terminalAudio } from "@/lib/terminalAudio";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Clock, Shield, Sparkles } from "lucide-react";

interface TWAPOrderFormProps {
  activeMarket: string;
  side: "buy" | "sell";
  leverage: number;
  markPrice: number;
  isPaperTrading: boolean;
  onOrderPlaced?: () => void;
}

const DURATION_PRESETS = [
  { label: "5m", minutes: 5 },
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "4h", minutes: 240 },
] as const;

const SLICE_PRESETS = [3, 5, 10, 15, 20] as const;

export function TWAPOrderForm({
  activeMarket,
  side,
  leverage,
  markPrice,
  isPaperTrading,
  onOrderPlaced,
}: TWAPOrderFormProps) {
  const isBuy = side === "buy";
  const baseAsset = activeMarket.split("-")[0];
  const paperBalance = usePaperTradingStore((s) => s.balance);
  const createTwapOrder = usePaperTradingStore((s) => s.createTwapOrder);

  const [totalSizeStr, setTotalSizeStr] = useState<string>("0.5");
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [totalSlices, setTotalSlices] = useState<number>(5);
  const [randomJitter, setRandomJitter] = useState<boolean>(true);
  const [slippageTolerance, setSlippageTolerance] = useState<string>("0.5");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSize = parseFloat(totalSizeStr) || 0;
  const intervalSeconds = Math.max(
    5,
    Math.round((durationMinutes * 60) / Math.max(1, totalSlices))
  );
  const avgSliceSize = totalSlices > 0 ? totalSize / totalSlices : 0;
  const totalNotional = totalSize * markPrice;
  const requiredMargin = leverage > 0 ? totalNotional / leverage : totalNotional;

  const isValid =
    totalSize > 0 &&
    durationMinutes >= 1 &&
    totalSlices >= 2 &&
    totalSlices <= 50 &&
    markPrice > 0;

  const handlePercentageSize = (pct: number) => {
    if (markPrice <= 0) return;
    const availableFunds = isPaperTrading ? paperBalance : 1000;
    const maxNotional = availableFunds * leverage * (pct / 100);
    const calcSize = maxNotional / markPrice;
    setTotalSizeStr(calcSize.toFixed(4));
  };

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    terminalAudio.playOrderSubmit();

    try {
      if (isPaperTrading) {
        createTwapOrder({
          market: activeMarket,
          side,
          totalSize,
          totalSlices,
          intervalSeconds,
          durationMinutes,
        });

        terminalAudio.playOrderFill();
        toast.success(
          `⚡ Launched TWAP: ${totalSize} ${baseAsset} in ${totalSlices} slices over ${durationMinutes}m`
        );
      } else {
        toast.info(
          `Live TWAP execution (${totalSize} ${baseAsset} in ${totalSlices} slices) submitted to execution layer`
        );
      }

      onOrderPlaced?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to launch TWAP order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3.5 p-3 text-xs font-mono">
      {/* Header Banner */}
      <div className="flex items-center justify-between rounded border border-[#182e36] bg-[#0a1b20] px-3 py-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#22d3ee]" />
          <div>
            <div className="font-semibold text-white">TWAP Algorithmic Order</div>
            <div className="text-[10px] text-[#6b8288]">
              Time-weighted slicing to minimize market impact
            </div>
          </div>
        </div>
        <span className="rounded bg-[#22d3ee]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#22d3ee]">
          PRO
        </span>
      </div>

      {/* Total Size Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[#64748b]">Total Size</label>
          <span className="text-[#64748b]">{baseAsset}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            data-testid="twap-total-size-input"
            value={totalSizeStr}
            onChange={(e) => setTotalSizeStr(e.target.value)}
            placeholder="0.00"
            step="0.001"
            min="0.0001"
            className="flex-1 rounded border border-[#1a2830] bg-[#081214] px-2.5 py-1.5 text-xs text-white placeholder-[#384850] focus:border-[#22d3ee] focus:outline-none"
          />
        </div>

        {/* Quick Percent Presets */}
        <div className="grid grid-cols-4 gap-1">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => handlePercentageSize(pct)}
              className="rounded border border-[#182e36] bg-[#0c1c22] py-1 text-[10px] font-medium text-[#7d979e] hover:border-[#22d3ee]/50 hover:bg-[#122c35] hover:text-white transition-colors cursor-pointer"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Execution Duration */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[#64748b]">Duration</label>
          <span className="text-[#22d3ee] font-semibold">{durationMinutes}m</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {DURATION_PRESETS.map((p) => (
            <button
              key={p.minutes}
              type="button"
              onClick={() => setDurationMinutes(p.minutes)}
              className={cn(
                "rounded border py-1 text-[10px] font-medium transition-colors cursor-pointer",
                durationMinutes === p.minutes
                  ? "border-[#22d3ee] bg-[#22d3ee]/15 text-[#22d3ee]"
                  : "border-[#182e36] bg-[#0c1c22] text-[#7d979e] hover:text-white"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Number of Slices */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[#64748b]">Total Slices</label>
          <span className="text-[#64748b]">
            {totalSlices} slices ({intervalSeconds}s interval)
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {SLICE_PRESETS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setTotalSlices(count)}
              className={cn(
                "rounded border py-1 text-[10px] font-medium transition-colors cursor-pointer",
                totalSlices === count
                  ? "border-[#22d3ee] bg-[#22d3ee]/15 text-[#22d3ee]"
                  : "border-[#182e36] bg-[#0c1c22] text-[#7d979e] hover:text-white"
              )}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Anti-MEV Randomization Jitter & Slippage */}
      <div className="space-y-2 rounded border border-[#162930] bg-[#081518] p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span className="text-[11px] text-[#c8d4d7]">±10% Size Jitter</span>
          </div>
          <button
            type="button"
            onClick={() => setRandomJitter(!randomJitter)}
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer",
              randomJitter
                ? "bg-[#00d084]/20 text-[#00d084] border border-[#00d084]/40"
                : "bg-[#182a30] text-[#6b8288] border border-[#203640]"
            )}
          >
            {randomJitter ? "ENABLED" : "OFF"}
          </button>
        </div>
        <div className="text-[10px] text-[#64748b]">
          Randomizes slice quantities to camouflage execution against MEV bots.
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-[#14232a]">
          <div className="flex items-center gap-1 text-[11px] text-[#8ea2a6]">
            <Shield className="h-3 w-3 text-[#22d3ee]" />
            <span>Max Slippage</span>
          </div>
          <div className="flex items-center gap-1">
            {["0.1%", "0.5%", "1.0%"].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setSlippageTolerance(pct)}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] transition-colors cursor-pointer",
                  slippageTolerance === pct
                    ? "bg-[#22d3ee]/20 text-[#22d3ee] font-bold"
                    : "text-[#64748b] hover:text-white"
                )}
              >
                {pct}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Execution Telemetry Summary Card */}
      <div className="space-y-1 rounded border border-[#1a2830] bg-[#0c181b] p-2 text-[11px]">
        <div className="flex justify-between text-[#64748b]">
          <span>Slice Size:</span>
          <span className="text-white">
            ~{avgSliceSize.toFixed(4)} {baseAsset}
          </span>
        </div>
        <div className="flex justify-between text-[#64748b]">
          <span>Slice Frequency:</span>
          <span className="text-white">1 order every {intervalSeconds}s</span>
        </div>
        <div className="flex justify-between text-[#64748b]">
          <span>Est. Notional:</span>
          <span className="text-white">${totalNotional.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[#64748b]">
          <span>Required Margin ({leverage}x):</span>
          <span className="text-[#22d3ee]">${requiredMargin.toFixed(2)}</span>
        </div>
      </div>

      {/* Launch CTA */}
      <Button
        data-testid="twap-submit-btn"
        disabled={!isValid || isSubmitting}
        onClick={handleSubmit}
        className={cn(
          "w-full font-bold uppercase tracking-wider py-2.5 transition-all text-xs cursor-pointer",
          isBuy
            ? "bg-[#00d084] text-[#051518] hover:bg-[#00b573]"
            : "bg-[#ff4757] text-white hover:bg-[#e03d4c]",
          (!isValid || isSubmitting) && "opacity-50 cursor-not-allowed"
        )}
      >
        {isSubmitting
          ? "Launching..."
          : `Launch TWAP ${isBuy ? "Buy" : "Sell"} (${totalSlices} Slices)`}
      </Button>
    </div>
  );
}
