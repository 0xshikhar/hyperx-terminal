import { cn } from "@/lib/utils";

type OrderBookDepthBarProps = {
  percent: number;
  side: "bid" | "ask";
};

export function OrderBookDepthBar({ percent, side }: OrderBookDepthBarProps) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-sm">
      <div
        className={cn(
          "h-full opacity-15 transition-[width] duration-200 ease-out",
          side === "bid" ? "bg-emerald-500" : "bg-rose-500"
        )}
        style={{
          width: `${Math.max(0, Math.min(100, percent))}%`,
          marginLeft: side === "bid" ? "auto" : undefined,
        }}
      />
    </div>
  );
}
