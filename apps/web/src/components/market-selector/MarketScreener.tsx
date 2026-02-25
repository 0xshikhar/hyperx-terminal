import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useMarketStore, type MarketSnapshot } from "@/store/marketStore";

export function MarketScreener() {
  const navigate = useNavigate();
  const { markets, setActiveMarket } = useMarketStore();
  const [query, setQuery] = useState("");

  const filteredMarkets = useMemo(() => {
    if (!query) return markets;
    const q = query.toLowerCase();
    return markets.filter(
      (market: MarketSnapshot) =>
        market.symbol.toLowerCase().includes(q) ||
        market.name.toLowerCase().includes(q)
    );
  }, [markets, query]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Market Screener</h2>
          <p className="text-xs text-muted-foreground">
            Live pricing snapshots across major pairs
          </p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search markets"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-4 space-y-2">
        {filteredMarkets.map((market: MarketSnapshot) => (
          <button
            key={market.symbol}
            onClick={() => {
              setActiveMarket(market.symbol);
              navigate("/terminal");
            }}
            className="flex w-full items-center justify-between rounded-md border border-border px-3 py-3 text-left transition-colors hover:bg-muted"
          >
            <div>
              <p className="font-medium">{market.symbol}</p>
              <p className="text-xs text-muted-foreground">{market.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono">
                ${market.lastPrice.toLocaleString()}
              </p>
              <p
                className={cn(
                  "text-xs font-mono",
                  market.changePercent24h >= 0
                    ? "text-emerald-500"
                    : "text-rose-500"
                )}
              >
                {market.changePercent24h >= 0 ? "+" : ""}
                {market.changePercent24h.toFixed(2)}%
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
