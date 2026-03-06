import { cn } from "@/lib/utils";
import { candleIntervals, type CandleInterval } from "@/services/wsClient";

type ChartToolbarProps = {
  interval: CandleInterval;
  onIntervalChange: (interval: CandleInterval) => void;
};

export function ChartToolbar({ interval, onIntervalChange }: ChartToolbarProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {candleIntervals.map((value) => (
        <button
          key={value}
          onClick={() => onIntervalChange(value)}
          className={cn(
            "rounded-md border px-2 py-1 uppercase",
            interval === value
              ? "border-primary text-primary"
              : "border-border text-muted-foreground"
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
