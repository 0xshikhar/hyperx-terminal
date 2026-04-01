import { memo } from "react";
import { cn } from "@/lib/utils";
import { useFundingCountdown } from "@/hooks/useFundingCountdown";

type SettlementCountdownProps = {
  fundingRate?: number;
  className?: string;
};

export const SettlementCountdown = memo(function SettlementCountdown({
  fundingRate = 0.000086,
  className,
}: SettlementCountdownProps) {
  const { formattedCountdown } = useFundingCountdown();
  // fundingRate in store is a fraction (e.g. 0.000086 = 0.0086%)
  const ratePercent = (fundingRate * 100).toFixed(4);
  const isPositive = fundingRate >= 0;

  return (
    <div
      title={`Next 1h funding settlement in ${formattedCountdown}. Rate: ${isPositive ? "+" : ""}${ratePercent}%. Longs pay shorts when rate is positive.`}
      className={cn("flex shrink-0 flex-col gap-0.5 px-4 py-2 select-none cursor-help", className)}
    >
      <div className="text-[10px] uppercase tracking-[0.1em] text-[#506068]">
        Funding / Countdown
      </div>
      <div className="flex items-center gap-1.5 font-mono text-xs">
        <span className={cn("font-medium", isPositive ? "text-[#00d084]" : "text-[#ff4757]")}>
          {isPositive ? "+" : ""}{ratePercent}%
        </span>
        <span className="text-[#3b4d52] font-mono text-[11px]">in</span>
        <span className="tabular-nums text-[#22d3ee] font-semibold">
          {formattedCountdown}
        </span>
      </div>
    </div>
  );
});
