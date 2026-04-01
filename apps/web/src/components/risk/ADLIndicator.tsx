import { memo } from "react";
import { cn } from "@/lib/utils";

type ADLIndicatorProps = {
  priority: number; // 0 to 5
  showLabel?: boolean;
  className?: string;
};

export const ADLIndicator = memo(function ADLIndicator({
  priority,
  showLabel = true,
  className,
}: ADLIndicatorProps) {
  const clamped = Math.min(5, Math.max(0, priority));

  // Determine bar color based on priority level
  const getBarColor = (index: number) => {
    if (index >= clamped) return "bg-[#162529]"; // Dim inactive bar
    if (clamped <= 2) return "bg-[#00d084] shadow-[0_0_6px_rgba(0,208,132,0.6)]"; // Low ADL risk (Green)
    if (clamped === 3) return "bg-[#f59e0b] shadow-[0_0_6px_rgba(245,158,11,0.6)]"; // Moderate ADL risk (Amber)
    if (clamped === 4) return "bg-[#ff6b6b] shadow-[0_0_6px_rgba(255,107,107,0.7)]"; // High ADL risk
    return "bg-[#ff4757] shadow-[0_0_8px_rgba(255,71,87,0.9)] animate-pulse"; // Critical / Priority 5
  };

  const getTooltipText = () => {
    if (clamped === 0) return "ADL: Inactive (no open positions)";
    if (clamped <= 2) return `ADL Queue: Level ${clamped}/5 (Low Priority · Safe from auto-deleveraging)`;
    if (clamped === 3) return `ADL Queue: Level ${clamped}/5 (Moderate Priority · Balanced risk)`;
    return `ADL Queue: Level ${clamped}/5 (High Priority · Position may be auto-deleveraged if insurance fund is exhausted)`;
  };

  return (
    <div
      title={getTooltipText()}
      className={cn("flex items-center gap-1.5 cursor-help select-none", className)}
    >
      {showLabel && (
        <span className="text-[10px] font-mono font-medium tracking-wider text-[#64748b]">
          ADL
        </span>
      )}
      <div className="flex items-center gap-0.5">
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className={cn(
              "h-2.5 w-1 rounded-[1px] transition-all duration-300",
              getBarColor(index)
            )}
          />
        ))}
      </div>
    </div>
  );
});
