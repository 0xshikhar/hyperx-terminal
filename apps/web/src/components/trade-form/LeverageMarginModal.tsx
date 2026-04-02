import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMarginSettingsStore, type MarginMode } from "@/store/marginSettingsStore";
import { terminalAudio } from "@/lib/terminalAudio";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Sliders, Shield, Layers, AlertTriangle, Info, Check } from "lucide-react";

interface LeverageMarginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  market?: string;
  initialMode?: MarginMode;
  initialLeverage?: number;
  onConfirm?: (mode: MarginMode, leverage: number) => void;
}

const PRESET_LEVERAGES = [2, 5, 10, 20, 25, 50];

export function LeverageMarginModal({
  open,
  onOpenChange,
  market = "BTC-USD",
  initialMode,
  initialLeverage,
  onConfirm,
}: LeverageMarginModalProps) {
  const storeMode = useMarginSettingsStore((s) => s.marginMode);
  const storeGetLeverage = useMarginSettingsStore((s) => s.getLeverage);
  const setStoreMarginMode = useMarginSettingsStore((s) => s.setMarginMode);
  const setStoreLeverage = useMarginSettingsStore((s) => s.setLeverage);

  const [mode, setMode] = useState<MarginMode>(initialMode || storeMode);
  const [leverage, setLeverage] = useState<number>(initialLeverage || storeGetLeverage(market));

  // Synchronize when opened
  useEffect(() => {
    if (open) {
      setMode(initialMode || storeMode);
      setLeverage(initialLeverage || storeGetLeverage(market));
    }
  }, [open, initialMode, initialLeverage, storeMode, storeGetLeverage, market]);

  const handleStep = (delta: number) => {
    setLeverage((prev) => Math.max(1, Math.min(50, prev + delta)));
  };

  const handleConfirm = () => {
    terminalAudio.playOrderSubmit();
    setStoreMarginMode(mode);
    setStoreLeverage(leverage, market);
    if (onConfirm) {
      onConfirm(mode, leverage);
    }
    toast.success(`Margin updated: ${mode.toUpperCase()} · ${leverage}x on ${market}`);
    onOpenChange(false);
  };

  // Risk Tier Evaluation
  const isHighRisk = leverage > 20;
  const isModerateRisk = leverage > 10 && leverage <= 20;

  const maxPositionSize =
    leverage <= 10
      ? "$1,000,000"
      : leverage <= 20
      ? "$500,000"
      : leverage <= 35
      ? "$200,000"
      : "$50,000";

  const approxLiqDistance = (90 / leverage).toFixed(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#1a2e35] bg-[#071317] p-0 text-white shadow-2xl overflow-hidden font-mono">
        <DialogHeader className="p-4 border-b border-[#14262c]">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide text-[#dde5e7]">
            <Sliders className="h-4 w-4 text-[#22d3ee]" />
            MARGIN MODE & LEVERAGE
          </DialogTitle>
          <DialogDescription className="text-xs text-[#8ea2a6]">
            Configure collateral margin mode and position leverage for{" "}
            <span className="text-white font-semibold">{market}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* ── Margin Mode Segmented Switcher ── */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#8ea2a6] uppercase tracking-wider block">
              Margin Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  terminalAudio.playClick();
                  setMode("cross");
                }}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 rounded border text-left transition-all cursor-pointer",
                  mode === "cross"
                    ? "border-[#22d3ee] bg-[#0e272e] text-white shadow-sm shadow-[#22d3ee]/20"
                    : "border-[#14262c] bg-[#09171b] text-[#64748b] hover:border-[#1d3d46] hover:text-[#dde5e7]"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="flex items-center gap-1.5 font-bold text-xs">
                    <Layers className="h-3.5 w-3.5 text-[#22d3ee]" />
                    CROSS
                  </span>
                  {mode === "cross" && <Check className="h-3.5 w-3.5 text-[#22d3ee]" />}
                </div>
                <span className="text-[10px] leading-tight text-[#8ea2a6]">
                  Shared account equity protects all positions from liquidation.
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  terminalAudio.playClick();
                  setMode("isolated");
                }}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 rounded border text-left transition-all cursor-pointer",
                  mode === "isolated"
                    ? "border-amber-400 bg-[#2b1f09] text-white shadow-sm shadow-amber-500/20"
                    : "border-[#14262c] bg-[#09171b] text-[#64748b] hover:border-[#1d3d46] hover:text-[#dde5e7]"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="flex items-center gap-1.5 font-bold text-xs">
                    <Shield className="h-3.5 w-3.5 text-amber-400" />
                    ISOLATED
                  </span>
                  {mode === "isolated" && <Check className="h-3.5 w-3.5 text-amber-400" />}
                </div>
                <span className="text-[10px] leading-tight text-[#8ea2a6]">
                  Risk is strictly confined to this position’s individual margin.
                </span>
              </button>
            </div>
          </div>

          {/* ── Leverage Selection & Slider ── */}
          <div className="space-y-3 rounded border border-[#14262c] bg-[#09171b] p-3.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[#8ea2a6] uppercase tracking-wider">
                Adjust Leverage
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStep(-1)}
                  disabled={leverage <= 1}
                  className="flex h-6 w-6 items-center justify-center rounded border border-[#1b3740] bg-[#0d2026] text-xs text-[#8ea2a6] hover:border-[#22d3ee] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  -
                </button>
                <span
                  className={cn(
                    "font-bold text-base min-w-[48px] text-center tabular-nums px-2 py-0.5 rounded border",
                    isHighRisk
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                      : isModerateRisk
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                      : "border-emerald-500/40 bg-emerald-500/10 text-[#00d084]"
                  )}
                >
                  {leverage}x
                </span>
                <button
                  type="button"
                  onClick={() => handleStep(1)}
                  disabled={leverage >= 50}
                  className="flex h-6 w-6 items-center justify-center rounded border border-[#1b3740] bg-[#0d2026] text-xs text-[#8ea2a6] hover:border-[#22d3ee] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Slider */}
            <div className="space-y-1.5 pt-1">
              <input
                type="range"
                min={1}
                max={50}
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                aria-label="Leverage Slider"
                className={cn(
                  "w-full cursor-pointer h-1.5 rounded-lg",
                  isHighRisk
                    ? "accent-rose-500"
                    : isModerateRisk
                    ? "accent-amber-400"
                    : "accent-[#00d084]"
                )}
              />
              <div className="flex justify-between text-[10px] text-[#50666d]">
                <span>1x</span>
                <span>10x</span>
                <span>25x</span>
                <span>50x</span>
              </div>
            </div>

            {/* Rapid Preset Pills */}
            <div className="grid grid-cols-6 gap-1 pt-1">
              {PRESET_LEVERAGES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    terminalAudio.playClick();
                    setLeverage(preset);
                  }}
                  className={cn(
                    "py-1 rounded text-[10px] font-bold transition-all cursor-pointer",
                    leverage === preset
                      ? "bg-[#22d3ee] text-[#051518]"
                      : "bg-[#0f242a] text-[#8ea2a6] hover:bg-[#15343d] hover:text-white"
                  )}
                >
                  {preset}x
                </button>
              ))}
            </div>
          </div>

          {/* ── Tier Info & Warnings ── */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded border border-[#14262c] bg-[#081518]">
              <div>
                <span className="text-[#64748b] block text-[10px]">MAX NOTIONAL SIZE</span>
                <span className="text-[#dde5e7] font-bold">{maxPositionSize}</span>
              </div>
              <div>
                <span className="text-[#64748b] block text-[10px]">EST. LIQ DISTANCE</span>
                <span className="text-amber-400 font-semibold tabular-nums">
                  ~{approxLiqDistance}% adverse move
                </span>
              </div>
            </div>

            {isHighRisk ? (
              <div className="flex items-start gap-2 rounded border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="text-[11px] leading-tight">
                  <strong className="font-bold">High Leverage Warning:</strong> Leverage above 20x
                  significantly increases liquidation sensitivity. High market volatility can
                  trigger instant liquidation.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded border border-[#14262c] bg-[#071317] p-2 text-xs text-[#64748b]">
                <Info className="h-3.5 w-3.5 shrink-0 text-[#22d3ee]" />
                <span className="text-[10px]">
                  Maintenance margin rate is automatically scaled with leverage.
                </span>
              </div>
            )}
          </div>

          {/* ── Confirm CTA ── */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#173038] bg-[#0b1c21] text-[#8ea2a6] hover:bg-[#12282f] hover:text-white flex-1 text-xs py-4 font-bold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              className="flex-1 font-mono font-bold tracking-wider py-4 text-xs bg-[#22d3ee] hover:bg-[#1fb8cf] text-[#051518] shadow-lg shadow-cyan-950/50 cursor-pointer"
            >
              CONFIRM {mode.toUpperCase()} {leverage}X
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
