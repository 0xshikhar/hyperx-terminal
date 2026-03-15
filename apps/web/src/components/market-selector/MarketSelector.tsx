import { useMemo, useState } from "react";
import { Activity, ChevronRight, Search, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketStore, type MarketSnapshot } from "@/store/marketStore";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";

export function MarketSelector() {
  const { activeMarket, markets, setActiveMarket } = useMarketStore();
  const [search, setSearch] = useState("");
  const connectionState = useRuntimeHealthStore((state) => state.connectionState);

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
  const activeDisplaySymbol = activeSnapshot?.displaySymbol ?? activeMarket;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[20px] border border-border/70 bg-[linear-gradient(180deg,rgba(17,17,24,0.98),rgba(10,10,15,0.98))] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            Market Ladder
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">{activeDisplaySymbol}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pricing, funding, and routing context for the active pair
          </p>
        </div>
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.24em]",
            connectionState === "connected"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/20 bg-amber-500/10 text-amber-300"
          )}
        >
          <Activity className="h-3 w-3" />
          {connectionState === "connected" ? "Live feed" : "Reference mode"}
        </div>
      </div>

      {activeSnapshot && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MetricCard
            label="Last Price"
            value={`$${activeSnapshot.lastPrice.toLocaleString(undefined, {
              maximumFractionDigits: activeSnapshot.lastPrice >= 100 ? 2 : 4,
            })}`}
          />
          <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">24h Change</p>
            <p
              className={cn(
                "mt-2 text-base font-mono",
                activeSnapshot.changePercent24h >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              )}
            >
              {activeSnapshot.changePercent24h >= 0 ? "+" : ""}
              {activeSnapshot.changePercent24h.toFixed(2)}%
            </p>
          </div>
          <MetricCard
            label="24h Volume"
            value={`$${compactNumber(activeSnapshot.volume24h)}`}
          />
          <MetricCard
            label="Open Interest"
            value={`$${compactNumber(activeSnapshot.openInterest)}`}
          />
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search trading pairs"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {filteredMarkets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
            No markets matched "{search}". Try `BTC`, `ETH`, or `STRK`.
          </div>
        ) : (
          filteredMarkets.map((market: MarketSnapshot) => {
            const isActive = market.symbol === activeMarket;
            const displaySymbol = market.displaySymbol ?? market.symbol;
            return (
              <button
                key={market.symbol}
                onClick={() => setActiveMarket(market.symbol)}
                className={cn(
                  "group w-full rounded-2xl border px-3 py-3 text-left transition-all",
                  isActive
                    ? "border-primary/35 bg-primary/10 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]"
                    : "border-border/60 bg-background/55 hover:border-primary/20 hover:bg-background/80"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{displaySymbol}</span>
                      {isActive ? <ChevronRight className="h-3 w-3 text-primary" /> : null}
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      {market.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm text-foreground">
                      ${market.lastPrice.toLocaleString(undefined, {
                        maximumFractionDigits: market.lastPrice >= 100 ? 2 : 4,
                      })}
                    </div>
                    <div
                      className={cn(
                        "mt-1 font-mono text-[11px]",
                        market.changePercent24h >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {market.changePercent24h >= 0 ? "+" : ""}
                      {market.changePercent24h.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-300" />
          <div>
            If Paradex or the API path degrades, the terminal stays usable with reference data instead of collapsing the workspace.
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
      <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-mono text-foreground">{value}</p>
    </div>
  );
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
