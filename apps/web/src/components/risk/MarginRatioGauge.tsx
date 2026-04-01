import { memo } from "react";
import { cn } from "@/lib/utils";
import type { RiskTier } from "@/hooks/useAccountRisk";

type MarginRatioGaugeProps = {
  marginRatio: number; // 0 to 100
  riskTier: RiskTier;
  maintenanceMargin?: number;
  equity?: number;
  freeMargin?: number;
  variant?: "full" | "compact" | "inline";
  className?: string;
};

export const MarginRatioGauge = memo(function MarginRatioGauge({
  marginRatio,
  riskTier,
  maintenanceMargin = 0,
  equity = 0,
  freeMargin = 0,
  variant = "full",
  className,
}: MarginRatioGaugeProps) {
  const percent = Math.min(100, Math.max(0, marginRatio));

  const tierColors = {
    healthy: {
      text: "text-[#00d084]",
      border: "border-[#00d084]/30",
      bg: "bg-[#00d084]/10",
      bar: "bg-[#00d084]",
      glow: "shadow-[0_0_8px_rgba(0,208,132,0.5)]",
      badge: "HEALTHY",
    },
    caution: {
      text: "text-[#f59e0b]",
      border: "border-[#f59e0b]/30",
      bg: "bg-[#f59e0b]/10",
      bar: "bg-[#f59e0b]",
      glow: "shadow-[0_0_8px_rgba(245,158,11,0.5)]",
      badge: "CAUTION",
    },
    danger: {
      text: "text-[#ff4757]",
      border: "border-[#ff4757]/40",
      bg: "bg-[#ff4757]/15",
      bar: "bg-[#ff4757]",
      glow: "shadow-[0_0_12px_rgba(255,71,87,0.8)]",
      badge: "LIQ RISK",
    },
  }[riskTier];

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2 font-mono text-xs", className)}>
        <span className="text-[#64748b]">Margin Ratio:</span>
        <div className="flex items-center gap-1.5">
          <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-[#152327]">
            <div
              className={cn("h-full rounded-full transition-all duration-300", tierColors.bar)}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className={cn("font-semibold tabular-nums", tierColors.text)}>
            {percent.toFixed(1)}%
          </span>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <span className="text-[#64748b] uppercase tracking-wider font-mono">Margin Ratio</span>
            <span className={cn("font-mono font-semibold tabular-nums", tierColors.text)}>
              {percent.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-[#111e22]">
            <div
              className={cn("h-full rounded-full transition-all duration-300", tierColors.bar)}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider border",
            tierColors.bg,
            tierColors.border,
            tierColors.text,
            riskTier === "danger" && "animate-pulse"
          )}
        >
          {tierColors.badge}
        </span>
      </div>
    );
  }

  // Full / Card Mode for TradeForm and Balances Tab
  return (
    <div
      className={cn(
        "rounded-lg border border-[#16272c] bg-[#091518] p-3 space-y-2.5",
        riskTier === "danger" && "border-[#ff4757]/40 bg-[#170a0c]/80",
        className
      )}
    >
      {/* Top Header: Title, Ratio %, and Status Pill */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#c8d4d7]">Margin Ratio</span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider border",
              tierColors.bg,
              tierColors.border,
              tierColors.text,
              riskTier === "danger" && "animate-pulse"
            )}
          >
            {tierColors.badge}
          </span>
        </div>
        <span className={cn("font-mono text-base font-bold tabular-nums", tierColors.text)}>
          {percent.toFixed(2)}%
        </span>
      </div>

      {/* Progress Track with 50% Caution and 80% Danger Markers */}
      <div className="space-y-1">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#0e1d21]">
          {/* 50% Caution tick marker */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-[#1a2d33] z-10" />
          {/* 80% Danger tick marker */}
          <div className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-[#253940] z-10" />

          {/* Active fill */}
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              tierColors.bar,
              tierColors.glow
            )}
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Legend Scale */}
        <div className="flex items-center justify-between text-[9px] font-mono text-[#506068]">
          <span>0% Safe</span>
          <span className="pl-6">50% Caution</span>
          <span>80% Danger</span>
          <span>100% Liq</span>
        </div>
      </div>

      {/* Metrics Breakdown (Maintenance Margin, Equity, Free Margin) */}
      <div className="grid grid-cols-3 gap-2 border-t border-[#132328] pt-2 text-[11px] font-mono">
        <div>
          <span className="block text-[10px] uppercase text-[#506068]">Maint. Margin</span>
          <span className="text-[#c8d4d7] font-medium tabular-nums">
            ${maintenanceMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase text-[#506068]">Margin Balance</span>
          <span className="text-[#c8d4d7] font-medium tabular-nums">
            ${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase text-[#506068]">Free Margin</span>
          <span className="text-[#00d084] font-medium tabular-nums">
            ${freeMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
});
