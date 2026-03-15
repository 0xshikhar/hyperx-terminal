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
        (market.displaySymbol ?? "").toLowerCase().includes(q) ||
        (market.venueSymbol ?? "").toLowerCase().includes(q) ||
        market.name.toLowerCase().includes(q)
    );
  }, [markets, query]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[18px] border border-[#213136] bg-[#091416]">
      <div className="flex items-center justify-between border-b border-[#152327] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#dde5e7]">Market Screener</h2>
          <p className="text-xs text-[#7e8c91]">Live pricing snapshots across major pairs</p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search markets"
          className="w-48 rounded-md border border-[#213136] bg-[#102125] px-3 py-2 text-sm text-[#d8dfe1] outline-none placeholder:text-[#64767b] focus:border-[#53d8c8]"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-2 p-4">
        {filteredMarkets.map((market: MarketSnapshot) => {
          const displaySymbol = market.displaySymbol ?? market.symbol;
          return (
            <button
              key={market.symbol}
              onClick={() => {
                setActiveMarket(market.symbol);
                navigate("/terminal");
              }}
              className="flex w-full items-center justify-between rounded-md border border-[#1d2b2f] bg-[#0c181b] px-3 py-3 text-left transition-colors hover:border-[#2a3a3f] hover:bg-[#0f1d21]"
            >
              <div>
                <p className="font-medium text-[#dde5e7]">{displaySymbol}</p>
                <p className="text-xs text-[#7e8c91]">{market.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-[#d8dfe1]">
                  ${market.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p
                  className={cn(
                    "text-xs font-mono",
                    market.changePercent24h >= 0
                      ? "text-[#53d8c8]"
                      : "text-[#f16d75]"
                  )}
                >
                  {market.changePercent24h >= 0 ? "+" : ""}
                  {market.changePercent24h.toFixed(2)}%
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
