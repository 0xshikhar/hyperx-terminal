import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useMarketStore } from "@/store/marketStore";

export function MarketTickerStrip() {
  const { activeMarket, markets, setActiveMarket } = useMarketStore();

  const sortedMarkets = useMemo(
    () => [...markets].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [markets]
  );

  return (
    <div className="rounded-lg border border-border bg-card/80 p-2 backdrop-blur-sm">
      <div className="flex flex-wrap items-stretch gap-2">
        {sortedMarkets.map((market) => {
          const isActive = market.symbol === activeMarket;
          const displaySymbol = market.displaySymbol ?? market.symbol;
          return (
            <button
              key={market.symbol}
              onClick={() => setActiveMarket(market.symbol)}
              className={cn(
                "min-w-[180px] flex-1 rounded-md border px-3 py-2 text-left transition-colors",
                isActive
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-background hover:border-primary/20 hover:bg-muted/40"
              )}
              >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">{displaySymbol}</span>
                <span
                  className={cn(
                    "font-mono text-xs",
                    market.changePercent24h >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {market.changePercent24h >= 0 ? "+" : ""}
                  {market.changePercent24h.toFixed(2)}%
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{market.name}</span>
                <span className="font-mono text-foreground">
                  ${market.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
