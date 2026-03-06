import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePositions } from "@/hooks/usePositions";

type ChartPositionOverlayProps = {
  market: string;
};

export function ChartPositionOverlay({ market }: ChartPositionOverlayProps) {
  const { positions } = usePositions();

  const active = useMemo(
    () => positions.filter((position) => position.market === market),
    [positions, market]
  );

  if (active.length === 0) return null;

  return (
    <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-border bg-background/80 px-3 py-2 text-xs backdrop-blur">
      <p className="text-[10px] uppercase text-muted-foreground">Open Positions</p>
      <div className="mt-2 space-y-1">
        {active.map((position) => (
          <div key={position.id} className="flex items-center justify-between gap-3">
            <span className="font-semibold">{position.size.toFixed(4)}</span>
            <span
              className={cn(
                "uppercase",
                position.side === "long" ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {position.side}
            </span>
            <span className="text-muted-foreground">@ {position.entryPrice.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
