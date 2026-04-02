import { useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import { useOrderBook } from "@/hooks/useOrderBook";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { useIsPaperTrading } from "@/hooks/useIsPaperTrading";
import { useOrdersStore } from "@/store/ordersStore";
import { terminalAudio } from "@/lib/terminalAudio";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Zap, ChevronUp, ChevronDown, Minus, Plus } from "lucide-react";

interface QuickTradeHUDProps {
  market: string;
}

const STORAGE_KEY = "hyperx_quick_scalp_collapsed";
const SIZE_STORAGE_KEY = "hyperx_quick_scalp_size";

export function QuickTradeHUD({ market }: QuickTradeHUDProps) {
  const isPaperTrading = useIsPaperTrading();
  const executePaperOrder = usePaperTradingStore((s) => s.executeOrder);
  const createOptimisticOrder = useOrdersStore((s) => s.createOptimisticOrder);

  const marketItem = useMarketStore((s) => s.markets?.find((m) => m.symbol === market));
  const { aggregatedBids = [], aggregatedAsks = [] } = useOrderBook(market) || {};

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [sizeStr, setSizeStr] = useState<string>(() => {
    try {
      return localStorage.getItem(SIZE_STORAGE_KEY) || "0.1";
    } catch {
      return "0.1";
    }
  });

  const [isExecuting, setIsExecuting] = useState(false);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {}
  };

  const handleSizeChange = (val: string) => {
    setSizeStr(val);
    try {
      localStorage.setItem(SIZE_STORAGE_KEY, val);
    } catch {}
  };

  const adjustSize = (delta: number) => {
    const current = parseFloat(sizeStr) || 0;
    const next = Math.max(0.001, Number((current + delta).toFixed(4)));
    handleSizeChange(String(next));
  };

  const lastPrice = marketItem?.lastPrice || 100;
  const bestBid = aggregatedBids[0]?.price || Number((lastPrice * 0.9999).toFixed(2));
  const bestAsk = aggregatedAsks[0]?.price || Number((lastPrice * 1.0001).toFixed(2));
  const spread = Math.max(0, bestAsk - bestBid);
  const spreadPct = bestAsk > 0 ? (spread / bestAsk) * 100 : 0;

  const currentSize = parseFloat(sizeStr) || 0;
  const leverage = 10;
  const estNotional = currentSize * lastPrice;
  const estMargin = estNotional / leverage;

  const handleExecute = async (side: "buy" | "sell") => {
    if (currentSize <= 0) {
      toast.error("Please enter a valid size");
      return;
    }

    const execPrice = side === "buy" ? bestAsk : bestBid;
    setIsExecuting(true);
    terminalAudio.playOrderSubmit();

    try {
      if (isPaperTrading) {
        executePaperOrder(
          {
            market,
            side,
            type: "market",
            size: currentSize,
            leverage,
          },
          execPrice
        );

        terminalAudio.playOrderFill();
        toast.success(
          `⚡ Scalp Filled: ${side.toUpperCase()} ${currentSize} ${market} @ $${execPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        );
      } else {
        createOptimisticOrder({
          market,
          side,
          type: "market",
          size: String(currentSize),
          leverage,
        });
        toast.success(`⚡ Scalp Submitted: ${side.toUpperCase()} ${currentSize} ${market}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  // Base asset symbol (e.g. BTC, ETH, SOL)
  const baseAsset = market.split("-")[0] || "BASE";

  // Dynamic quick presets
  const sizePresets = baseAsset === "BTC"
    ? ["0.01", "0.05", "0.1", "0.5", "1.0"]
    : baseAsset === "ETH"
    ? ["0.1", "0.5", "1.0", "5.0", "10.0"]
    : ["1.0", "5.0", "10.0", "25.0", "50.0"];

  if (isCollapsed) {
    return (
      <div className="absolute top-12 left-4 z-30 flex items-center gap-1.5 rounded-md border border-[#1b343c] bg-[#071518]/90 px-2.5 py-1 text-xs font-mono shadow-xl backdrop-blur-md transition-all hover:border-[#22d3ee]/60 select-none">
        <button
          type="button"
          onClick={toggleCollapse}
          className="flex items-center gap-1 text-[#22d3ee] hover:text-white transition-colors cursor-pointer"
          title="Expand Quick-Trade Scalp HUD"
        >
          <Zap className="h-3 w-3 fill-[#22d3ee]" />
          <span className="font-bold">SCALP</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        <span className="text-[#647b81]">|</span>
        <span className="text-[#8ea2a6]">{currentSize} {baseAsset}</span>
        <button
          type="button"
          onClick={() => handleExecute("sell")}
          className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 hover:bg-rose-500/30 transition-colors cursor-pointer"
        >
          SELL ${bestBid.toLocaleString(undefined, { minimumFractionDigits: 1 })}
        </button>
        <button
          type="button"
          onClick={() => handleExecute("buy")}
          className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer"
        >
          BUY ${bestAsk.toLocaleString(undefined, { minimumFractionDigits: 1 })}
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-12 left-4 z-30 w-72 rounded-lg border border-[#1a353e] bg-[#071518]/95 p-2.5 text-xs font-mono shadow-2xl backdrop-blur-md select-none">
      {/* HUD Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#14282f]">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 fill-[#22d3ee] text-[#22d3ee]" />
          <span className="font-bold text-white tracking-wider text-[11px]">QUICK SCALP</span>
          <span className="rounded bg-[#112a32] px-1.5 py-0.2 text-[9px] text-[#22d3ee] font-semibold">
            {leverage}x
          </span>
        </div>
        <button
          type="button"
          onClick={toggleCollapse}
          className="rounded p-1 text-[#627a80] hover:bg-[#10272f] hover:text-white transition-colors cursor-pointer"
          title="Minimize Scalp HUD"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Size Stepper & Input */}
      <div className="pt-2 space-y-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => adjustSize(-0.01)}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#1b343c] bg-[#0a1e24] text-[#8ea2a6] hover:bg-[#122e37] hover:text-white transition-colors cursor-pointer"
          >
            <Minus className="h-3 w-3" />
          </button>
          <div className="relative flex-1">
            <input
              type="number"
              step="any"
              value={sizeStr}
              onChange={(e) => handleSizeChange(e.target.value)}
              className="w-full rounded border border-[#1b343c] bg-[#091a1f] px-2.5 py-1 text-center font-bold text-white focus:border-[#22d3ee] focus:outline-none"
            />
            <span className="pointer-events-none absolute right-2 top-1 text-[10px] text-[#627a80]">
              {baseAsset}
            </span>
          </div>
          <button
            type="button"
            onClick={() => adjustSize(0.01)}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#1b343c] bg-[#0a1e24] text-[#8ea2a6] hover:bg-[#122e37] hover:text-white transition-colors cursor-pointer"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Quick Size Preset Chips */}
        <div className="grid grid-cols-5 gap-1">
          {sizePresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleSizeChange(preset)}
              className={cn(
                "rounded border py-0.5 text-center text-[10px] font-semibold transition-all cursor-pointer",
                sizeStr === preset
                  ? "border-[#22d3ee] bg-[#16363f] text-[#22d3ee]"
                  : "border-[#162d35] bg-[#0c1f25] text-[#8ea2a6] hover:bg-[#122d36] hover:text-white"
              )}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* 1-Click Execution Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2.5">
        {/* Short Button */}
        <button
          type="button"
          onClick={() => handleExecute("sell")}
          disabled={isExecuting || currentSize <= 0}
          className="flex flex-col items-center justify-center rounded border border-rose-500/40 bg-rose-500/15 p-2 transition-all hover:bg-rose-500/25 active:scale-[0.98] cursor-pointer disabled:opacity-50"
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">
            SELL / SHORT
          </span>
          <span className="font-mono text-sm font-bold text-white tabular-nums">
            ${bestBid.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
          </span>
        </button>

        {/* Long Button */}
        <button
          type="button"
          onClick={() => handleExecute("buy")}
          disabled={isExecuting || currentSize <= 0}
          className="flex flex-col items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/15 p-2 transition-all hover:bg-emerald-500/25 active:scale-[0.98] cursor-pointer disabled:opacity-50"
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
            BUY / LONG
          </span>
          <span className="font-mono text-sm font-bold text-white tabular-nums">
            ${bestAsk.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
          </span>
        </button>
      </div>

      {/* Spread & Margin Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[#13272e] text-[10px] text-[#627a80]">
        <span>Spread: {spreadPct.toFixed(2)}% (${spread.toFixed(2)})</span>
        <span>Margin: ${estMargin.toFixed(2)}</span>
      </div>
    </div>
  );
}
