import { useMemo } from "react";
import { Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketStore } from "@/store/marketStore";
import { useUIStore } from "@/store/uiStore";

export function Sidebar() {
  const { activeMarket, markets, setActiveMarket } = useMarketStore();
  const favoriteMarkets = useUIStore((s) => s.favoriteMarkets);
  const sortedMarkets = useMemo(
    () =>
      [...markets].sort((a, b) => {
        const aFav = favoriteMarkets.includes(a.symbol);
        const bFav = favoriteMarkets.includes(b.symbol);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return b.changePercent24h - a.changePercent24h;
      }),
    [markets, favoriteMarkets]
  );

  return (
    <aside className="hidden w-64 flex-col border-r border-border bg-card md:flex">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4" />
          Markets
        </div>
        <Star className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 overflow-auto">
        {sortedMarkets.map((market) => {
          const isActive = market.symbol === activeMarket;
          const isFavorite = favoriteMarkets.includes(market.symbol);
          return (
            <button
              key={market.symbol}
              onClick={() => setActiveMarket(market.symbol)}
              className={cn(
                "flex w-full items-center justify-between px-4 py-2 text-sm transition-colors",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                {market.symbol}
                {isFavorite && <Star className="h-3 w-3 text-primary" />}
              </span>
              <span
                className={cn(
                  "text-xs font-mono",
                  market.changePercent24h >= 0
                    ? "text-emerald-500"
                    : "text-rose-500"
                )}
              >
                {market.changePercent24h >= 0 ? "+" : ""}
                {market.changePercent24h.toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
