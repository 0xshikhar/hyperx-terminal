import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketStore, type MarketSnapshot } from "@/store/marketStore";

export function MarketSelector() {
  const { activeMarket, markets, setActiveMarket } = useMarketStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredMarkets = useMemo(() => {
    if (!search) return markets;
    const q = search.toLowerCase();
    return markets.filter(
      (market: MarketSnapshot) =>
        market.symbol.toLowerCase().includes(q) ||
        market.name.toLowerCase().includes(q)
    );
  }, [markets, search]);

  const activeSnapshot = markets.find(
    (market: MarketSnapshot) => market.symbol === activeMarket
  );

  return (
    <div className="relative rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Active Market</p>
          <p className="text-lg font-semibold">{activeMarket}</p>
        </div>
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
        >
          Switch
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
          />
        </button>
      </div>

      {activeSnapshot && (
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div>
            <p className="text-[10px] uppercase">Last Price</p>
            <p className="text-sm font-mono text-foreground">
              ${activeSnapshot.lastPrice.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase">24h Change</p>
            <p
              className={cn(
                "text-sm font-mono",
                activeSnapshot.changePercent24h >= 0
                  ? "text-emerald-500"
                  : "text-rose-500"
              )}
            >
              {activeSnapshot.changePercent24h >= 0 ? "+" : ""}
              {activeSnapshot.changePercent24h.toFixed(2)}%
            </p>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="mt-4 space-y-2 rounded-md border border-border bg-background p-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search markets"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
          <div className="max-h-56 space-y-1 overflow-auto">
            {filteredMarkets.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                No markets matched "{search}". Try a symbol like `BTC` or `ETH`.
              </div>
            ) : (
              filteredMarkets.map((market: MarketSnapshot) => (
                <button
                  key={market.symbol}
                  onClick={() => {
                    setActiveMarket(market.symbol);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                    market.symbol === activeMarket
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{market.symbol}</span>
                    <span className="text-[10px] uppercase">{market.name}</span>
                  </div>
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
