import { useState, useEffect } from "react";
import {
  useScaledOrders,
  type ScaledDistribution,
} from "@/hooks/useScaledOrders";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { useOrdersStore } from "@/store/ordersStore";
import { terminalAudio } from "@/lib/terminalAudio";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Layers, Info } from "lucide-react";

interface ScaledOrderFormProps {
  activeMarket: string;
  side: "buy" | "sell";
  leverage: number;
  markPrice: number;
  isPaperTrading: boolean;
  onOrdersPlaced?: () => void;
}

export function ScaledOrderForm({
  activeMarket,
  side,
  leverage,
  markPrice,
  isPaperTrading,
  onOrdersPlaced,
}: ScaledOrderFormProps) {
  const isBuy = side === "buy";
  const executePaperOrder = usePaperTradingStore((s) => s.executeOrder);
  const paperBalance = usePaperTradingStore((s) => s.balance);
  const createOptimisticOrder = useOrdersStore((s) => s.createOptimisticOrder);

  // Default price bands:
  // If Buy: Start near markPrice (e.g. -0.5%), End deeper (e.g. -4%)
  // If Sell: Start near markPrice (e.g. +0.5%), End higher (e.g. +4%)
  const [startPriceStr, setStartPriceStr] = useState<string>("");
  const [endPriceStr, setEndPriceStr] = useState<string>("");
  const [totalSizeStr, setTotalSizeStr] = useState<string>("0.5");
  const [orderCount, setOrderCount] = useState<number>(5);
  const [distribution, setDistribution] = useState<ScaledDistribution>("flat");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize prices based on current mark price
  useEffect(() => {
    if (markPrice > 0 && !startPriceStr && !endPriceStr) {
      if (isBuy) {
        setStartPriceStr((markPrice * 0.995).toFixed(2));
        setEndPriceStr((markPrice * 0.96).toFixed(2));
      } else {
        setStartPriceStr((markPrice * 1.005).toFixed(2));
        setEndPriceStr((markPrice * 1.04).toFixed(2));
      }
    }
  }, [markPrice, isBuy, startPriceStr, endPriceStr]);

  const startPrice = parseFloat(startPriceStr) || 0;
  const endPrice = parseFloat(endPriceStr) || 0;
  const totalSize = parseFloat(totalSizeStr) || 0;

  const {
    orders,
    averagePrice,
    totalNotional,
    requiredMargin,
    isValid,
    validationError,
  } = useScaledOrders({
    startPrice,
    endPrice,
    totalSize,
    orderCount,
    distribution,
    leverage,
  });

  const applyPriceRangePreset = (startPct: number, endPct: number) => {
    if (markPrice <= 0) return;
    const factor = isBuy ? -1 : 1;
    const newStart = markPrice * (1 + (factor * startPct) / 100);
    const newEnd = markPrice * (1 + (factor * endPct) / 100);
    setStartPriceStr(newStart.toFixed(2));
    setEndPriceStr(newEnd.toFixed(2));
  };

  const handlePercentageSize = (pct: number) => {
    if (markPrice <= 0) return;
    const availableFunds = isPaperTrading ? paperBalance : 1000;
    const maxNotional = availableFunds * leverage * (pct / 100);
    const calcSize = maxNotional / markPrice;
    setTotalSizeStr(calcSize.toFixed(4));
  };

  const handleSubmit = async () => {
    if (!isValid || orders.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    terminalAudio.playOrderSubmit();

    try {
      if (isPaperTrading) {
        for (const rung of orders) {
          executePaperOrder(
            {
              market: activeMarket,
              side,
              type: "limit",
              size: rung.size,
              price: rung.price,
              leverage,
            },
            markPrice
          );
        }

        terminalAudio.playOrderFill();
        toast.success(
          `⚡ Placed ${orders.length} laddered limit ${side.toUpperCase()} orders ($${averagePrice.toFixed(2)} Avg)`
        );
      } else {
        // Live order pipeline: submit optimistic orders
        for (const rung of orders) {
          createOptimisticOrder({
            market: activeMarket,
            side,
            type: "limit",
            size: String(rung.size),
            price: String(rung.price),
            leverage,
          });
        }
        toast.success(`Submitted ${orders.length} live scaled orders to execution engine`);
      }

      onOrdersPlaced?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to place scaled orders");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3.5 p-3 text-xs font-mono">
      {/* Header Banner */}
      <div className="flex items-center justify-between rounded border border-[#182e36] bg-[#0a1b20] px-3 py-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#22d3ee]" />
          <span className="font-bold text-white tracking-wide">SCALE LADDER</span>
        </div>
        <span className="text-[10px] text-[#8ea2a6]">
          Distributes {orderCount} limit orders
        </span>
      </div>

      {/* Quick Range Presets */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-[#8ea2a6]">
          <span>Price Band Spread</span>
          <span className="text-[#22d3ee]">Mark: ${markPrice > 0 ? markPrice.toLocaleString() : "--"}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => applyPriceRangePreset(0.5, 3.0)}
            className="rounded border border-[#173038] bg-[#0c1e24] py-1 text-[10px] text-[#8ea2a6] hover:bg-[#132c34] hover:text-white transition-colors cursor-pointer"
          >
            {isBuy ? "-0.5% to -3%" : "+0.5% to +3%"}
          </button>
          <button
            type="button"
            onClick={() => applyPriceRangePreset(1.0, 5.0)}
            className="rounded border border-[#173038] bg-[#0c1e24] py-1 text-[10px] text-[#8ea2a6] hover:bg-[#132c34] hover:text-white transition-colors cursor-pointer"
          >
            {isBuy ? "-1% to -5%" : "+1% to +5%"}
          </button>
          <button
            type="button"
            onClick={() => applyPriceRangePreset(2.0, 10.0)}
            className="rounded border border-[#173038] bg-[#0c1e24] py-1 text-[10px] text-[#8ea2a6] hover:bg-[#132c34] hover:text-white transition-colors cursor-pointer"
          >
            {isBuy ? "-2% to -10%" : "+2% to +10%"}
          </button>
        </div>
      </div>

      {/* Price Range Inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] text-[#8ea2a6]">Start Price</label>
          <input
            type="number"
            step="any"
            value={startPriceStr}
            onChange={(e) => setStartPriceStr(e.target.value)}
            placeholder="0.00"
            className="w-full rounded border border-[#1a333a] bg-[#08181c] px-2.5 py-1.5 text-xs text-white focus:border-[#22d3ee] focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-[#8ea2a6]">End Price</label>
          <input
            type="number"
            step="any"
            value={endPriceStr}
            onChange={(e) => setEndPriceStr(e.target.value)}
            placeholder="0.00"
            className="w-full rounded border border-[#1a333a] bg-[#08181c] px-2.5 py-1.5 text-xs text-white focus:border-[#22d3ee] focus:outline-none"
          />
        </div>
      </div>

      {/* Total Size Input */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-[#8ea2a6]">
          <span>Total Size ({activeMarket.split("-")[0]})</span>
          <div className="flex items-center gap-1 text-[10px]">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handlePercentageSize(pct)}
                className="rounded bg-[#10252b] px-1.5 py-0.5 text-[#8ea2a6] hover:bg-[#173842] hover:text-white transition-colors cursor-pointer"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
        <input
          type="number"
          step="any"
          value={totalSizeStr}
          onChange={(e) => setTotalSizeStr(e.target.value)}
          placeholder="Total size across ladder"
          className="w-full rounded border border-[#1a333a] bg-[#08181c] px-2.5 py-1.5 text-xs text-white focus:border-[#22d3ee] focus:outline-none"
        />
      </div>

      {/* Order Count Selector */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-[#8ea2a6]">
          <span>Order Count</span>
          <span className="text-[#22d3ee] font-semibold">{orderCount} Orders</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {[3, 4, 5, 7, 10].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setOrderCount(count)}
              className={cn(
                "rounded border py-1 text-center text-xs font-semibold transition-all cursor-pointer",
                orderCount === count
                  ? "border-[#22d3ee] bg-[#16363f] text-[#22d3ee]"
                  : "border-[#173038] bg-[#0c1e24] text-[#8ea2a6] hover:bg-[#122c33] hover:text-white"
              )}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Distribution Mode */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-[#8ea2a6]">
          <span>Size Distribution</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { mode: "flat", label: "Flat (Equal)" },
              { mode: "pyramid", label: "Pyramid (Deeper)" },
              { mode: "inverted", label: "Inverted (Near)" },
            ] as const
          ).map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDistribution(mode)}
              className={cn(
                "rounded border py-1 px-1 text-center text-[10px] font-semibold transition-all cursor-pointer",
                distribution === mode
                  ? "border-[#22d3ee] bg-[#16363f] text-[#22d3ee]"
                  : "border-[#173038] bg-[#0c1e24] text-[#8ea2a6] hover:bg-[#122c33] hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Ladder Preview Table */}
      <div className="rounded border border-[#162e35] bg-[#07171b] overflow-hidden">
        <div className="grid grid-cols-5 bg-[#0b1f24] px-2 py-1.5 text-[10px] text-[#627a80] font-semibold uppercase">
          <span>#</span>
          <span>Price</span>
          <span>Size</span>
          <span className="text-right">Total</span>
          <span className="text-right">Depth</span>
        </div>
        <div className="max-h-36 overflow-y-auto divide-y divide-[#13272d]">
          {orders.map((rung) => (
            <div
              key={rung.index}
              className="grid grid-cols-5 items-center px-2 py-1 text-[11px] text-[#dde5e7] hover:bg-[#0f272e]/50"
            >
              <span className="text-[#627a80]">{rung.index}</span>
              <span className={cn("font-medium", isBuy ? "text-[#00d084]" : "text-[#ff4757]")}>
                ${rung.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span>{rung.size.toFixed(4)}</span>
              <span className="text-right text-[#8ea2a6]">${rung.notional.toFixed(0)}</span>
              <div className="flex items-center justify-end pl-2">
                <div className="h-1.5 w-12 bg-[#12262c] rounded-full overflow-hidden">
                  <div
                    style={{ width: `${rung.weightPercent * 2}%` }}
                    className={cn("h-full rounded-full", isBuy ? "bg-[#00d084]" : "bg-[#ff4757]")}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Telemetry */}
      {isValid && (
        <div className="rounded border border-[#152e35] bg-[#091a1f] p-2.5 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-[#8ea2a6]">Avg Execution Price:</span>
            <span className="text-[#22d3ee] font-bold tabular-nums">
              ${averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#8ea2a6]">Total Notional:</span>
            <span className="text-white tabular-nums">${totalNotional.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#8ea2a6]">Est. Margin Required:</span>
            <span className="text-amber-400 tabular-nums">${requiredMargin.toFixed(2)} ({leverage}x)</span>
          </div>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div className="flex items-center gap-1 text-[11px] text-rose-400">
          <Info className="h-3 w-3" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!isValid || isSubmitting}
        className={cn(
          "w-full font-mono font-bold tracking-wider py-5 text-xs transition-all cursor-pointer",
          isBuy
            ? "bg-[#00d084] hover:bg-[#00b875] text-[#051518]"
            : "bg-[#ff4757] hover:bg-[#eb3d4d] text-white"
        )}
      >
        {isSubmitting
          ? "SUBMITTING LADDER..."
          : `PLACE ${orderCount} ${side.toUpperCase()} ORDERS ($${averagePrice.toFixed(2)} AVG)`}
      </Button>
    </div>
  );
}
