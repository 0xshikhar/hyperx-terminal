import { cn } from "@/lib/utils";

type OrderBookDepthBarProps = {
  percent: number;
  side: "bid" | "ask";
};

export function OrderBookDepthBar({ percent, side }: OrderBookDepthBarProps) {
  const clampedPercent = Math.max(0, Math.min(100, percent));

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className={cn(
          "absolute inset-y-0 transition-[width] duration-150 ease-out",
          side === "bid" ? "right-0" : "left-0"
        )}
        style={{ width: `${clampedPercent}%` }}
      >
        <div
          className={cn(
            "h-full w-full",
            side === "bid"
              ? "bg-gradient-to-l from-[rgba(0,208,132,0.18)] to-transparent"
              : "bg-gradient-to-r from-[rgba(255,71,87,0.18)] to-transparent"
          )}
        />
      </div>
    </div>
  );
}
