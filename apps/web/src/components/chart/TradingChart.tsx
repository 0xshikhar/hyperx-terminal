import { useMarketStore } from "@/store/marketStore";

export function TradingChart() {
  const { activeMarket } = useMarketStore();

  return (
    <div className="h-full rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Chart</h3>
        <span className="text-xs text-muted-foreground">{activeMarket}</span>
      </div>
      <div className="mt-4 flex h-64 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        Live candles stream here
      </div>
    </div>
  );
}
