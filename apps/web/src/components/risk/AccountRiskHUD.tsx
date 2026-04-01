import { memo } from "react";
import { cn } from "@/lib/utils";
import { useAccountRisk } from "@/hooks/useAccountRisk";
import { MarginRatioGauge } from "@/components/risk/MarginRatioGauge";
import { ADLIndicator } from "@/components/risk/ADLIndicator";
import { AlertTriangle, ShieldCheck } from "lucide-react";

type AccountRiskHUDProps = {
  variant?: "full" | "compact" | "inline";
  className?: string;
};

export const AccountRiskHUD = memo(function AccountRiskHUD({
  variant = "full",
  className,
}: AccountRiskHUDProps) {
  const {
    equity,
    maintenanceMargin,
    freeMargin,
    marginRatio,
    riskTier,
    adlPriority,
    effectiveLeverage,
    hasOpenPositions,
  } = useAccountRisk();

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <MarginRatioGauge
          variant="inline"
          marginRatio={marginRatio}
          riskTier={riskTier}
        />
        <div className="h-3 w-px bg-[#1a2830]" />
        <ADLIndicator priority={adlPriority} />
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <MarginRatioGauge
          variant="compact"
          marginRatio={marginRatio}
          riskTier={riskTier}
        />
        <div className="h-3.5 w-px bg-[#1a2830]" />
        <ADLIndicator priority={adlPriority} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* HUD Header Bar: Title + ADL queue status */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5">
          {riskTier === "danger" ? (
            <AlertTriangle className="h-3.5 w-3.5 text-[#ff4757] animate-bounce" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5 text-[#22d3ee]" />
          )}
          <span className="text-[11px] font-semibold text-[#dde5e7]">
            Cross-Margin Health
          </span>
          {hasOpenPositions && (
            <span className="font-mono text-[10px] text-[#506068]">
              ({effectiveLeverage.toFixed(1)}x eff.)
            </span>
          )}
        </div>
        <ADLIndicator priority={adlPriority} />
      </div>

      {/* Margin Gauge Visual & Metrics */}
      <MarginRatioGauge
        variant="full"
        marginRatio={marginRatio}
        riskTier={riskTier}
        maintenanceMargin={maintenanceMargin}
        equity={equity}
        freeMargin={freeMargin}
      />
    </div>
  );
});
