import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Star, TrendingUp, Sparkles, Layers } from "lucide-react";
import { useActiveMarket, useSetActiveMarket, useMarketStore, type MarketSnapshot } from "@/store/marketStore";
import { useShallow } from "zustand/react/shallow";
import { terminalAudio } from "@/lib/terminalAudio";
import { cn } from "@/lib/utils";

type MarketSelectorModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CategoryTab = "all" | "favorites" | "perps" | "gainers";

const FAVORITES_STORAGE_KEY = "hyperx-favorite-markets";
const DEFAULT_FAVORITES = ["BTC-USD", "ETH-USD", "HYPE-USD"];

export function MarketSelectorModal({ open, onOpenChange }: MarketSelectorModalProps) {
  const activeMarket = useActiveMarket();
  const setActiveMarket = useSetActiveMarket();
  const markets = useMarketStore(useShallow((s) => s.markets));

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryTab>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Favorites state persisted in localStorage
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return DEFAULT_FAVORITES;
  });

  const toggleFavorite = useCallback((symbol: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    terminalAudio.playClick();
    setFavorites((prev) => {
      const next = prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol];
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Filter & sort markets
  const displayMarkets = useMemo(() => {
    let list = [...markets];

    if (category === "favorites") {
      list = list.filter((m) => favorites.includes(m.symbol));
    } else if (category === "gainers") {
      list = list
        .filter((m) => m.changePercent24h > 0)
        .sort((a, b) => b.changePercent24h - a.changePercent24h);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.symbol.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          (m.displaySymbol && m.displaySymbol.toLowerCase().includes(q))
      );
    }

    return list;
  }, [markets, category, favorites, search]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [category, search]);

  // Auto-focus input on open
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Keyboard navigation on window while modal is open
  useEffect(() => {
    if (!open) return;
    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, displayMarkets.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? Math.max(0, displayMarkets.length - 1) : prev - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = displayMarkets[selectedIndex];
        if (selected) {
          terminalAudio.playClick();
          setActiveMarket(selected.symbol);
          onOpenChange(false);
        }
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [open, displayMarkets, selectedIndex, setActiveMarket, onOpenChange]);

  const handleSelectMarket = (symbol: string) => {
    terminalAudio.playClick();
    setActiveMarket(symbol);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl border-[#1a2d32] bg-[#071316]/95 backdrop-blur-xl p-0 text-[#c8d4d7] shadow-2xl overflow-hidden sm:rounded-xl"
      >
        <DialogHeader className="border-b border-[#142327] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#22d3ee]" />
              <DialogTitle className="text-sm font-semibold tracking-wide text-white">
                Select Market
              </DialogTitle>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-[#506068]">
              <kbd className="rounded border border-[#1f3137] bg-[#0c191c] px-1.5 py-0.5 text-[#8aa1a7]">
                ↑↓
              </kbd>
              <span>navigate</span>
              <kbd className="ml-1 rounded border border-[#1f3137] bg-[#0c191c] px-1.5 py-0.5 text-[#8aa1a7]">
                ↵
              </kbd>
              <span>select</span>
              <kbd className="ml-1 rounded border border-[#1f3137] bg-[#0c191c] px-1.5 py-0.5 text-[#8aa1a7]">
                esc
              </kbd>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Search and switch trading markets on HyperX Terminal
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="border-b border-[#142327] px-4 py-2.5">
          <div className="flex items-center gap-2.5 rounded-lg border border-[#1a2d32] bg-[#09171a] px-3 py-2 focus-within:border-[#22d3ee]/60 focus-within:ring-1 focus-within:ring-[#22d3ee]/30 transition-all">
            <Search className="h-4 w-4 shrink-0 text-[#506068]" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search markets (e.g. BTC, ETH, SOL, HYPE)..."
              className="w-full bg-transparent font-mono text-sm text-white placeholder:text-[#506068] outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs text-[#506068] hover:text-[#c8d4d7]"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 border-b border-[#142327] bg-[#081417] px-4 py-2 text-xs">
          <button
            onClick={() => setCategory("all")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
              category === "all"
                ? "bg-[#10272d] text-[#22d3ee] border border-[#1b3f49]"
                : "text-[#64748b] hover:text-[#c8d4d7] hover:bg-[#0c1a1e]"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>All ({markets.length})</span>
          </button>
          <button
            onClick={() => setCategory("favorites")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
              category === "favorites"
                ? "bg-[#10272d] text-[#eab308] border border-[#3e3415]"
                : "text-[#64748b] hover:text-[#c8d4d7] hover:bg-[#0c1a1e]"
            )}
          >
            <Star className="h-3.5 w-3.5 fill-current" />
            <span>Watchlist ({favorites.length})</span>
          </button>
          <button
            onClick={() => setCategory("gainers")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
              category === "gainers"
                ? "bg-[#10272d] text-[#00d084] border border-[#1b4334]"
                : "text-[#64748b] hover:text-[#c8d4d7] hover:bg-[#0c1a1e]"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Top Gainers</span>
          </button>
        </div>

        {/* Markets Table */}
        <div className="max-h-[360px] overflow-y-auto">
          {/* Table Header */}
          <div className="grid grid-cols-12 items-center border-b border-[#142327] bg-[#081215] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#506068]">
            <div className="col-span-5">Market</div>
            <div className="col-span-2 text-right">Last Price</div>
            <div className="col-span-2 text-right">24h Change</div>
            <div className="col-span-2 text-right">24h Volume</div>
            <div className="col-span-1 text-right">Funding</div>
          </div>

          {/* Rows */}
          {displayMarkets.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#506068]">
              No markets found matching "{search}"
            </div>
          ) : (
            displayMarkets.map((market: MarketSnapshot, idx: number) => {
              const isActive = market.symbol === activeMarket;
              const isSelected = idx === selectedIndex;
              const isFav = favorites.includes(market.symbol);
              const isPositive = market.changePercent24h >= 0;

              return (
                <div
                  key={market.symbol}
                  onClick={() => handleSelectMarket(market.symbol)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "grid grid-cols-12 items-center px-4 py-2.5 transition-colors cursor-pointer border-b border-[#0e1c20]",
                    isSelected
                      ? "bg-[#0e242a]"
                      : isActive
                        ? "bg-[#0a1b20]"
                        : "hover:bg-[#0a181b]"
                  )}
                >
                  {/* Symbol & Name */}
                  <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(market.symbol, e)}
                      title={isFav ? "Remove from watchlist" : "Add to watchlist"}
                      className="text-[#45585f] hover:text-[#eab308] transition-colors p-0.5"
                    >
                      <Star
                        className={cn(
                          "h-3.5 w-3.5",
                          isFav ? "fill-[#eab308] text-[#eab308]" : ""
                        )}
                      />
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-white">
                          {market.displaySymbol ?? market.symbol}
                        </span>
                        <span className="rounded bg-[#0d262c] px-1 py-0.2 text-[9px] font-bold text-[#22d3ee] border border-[#16424b]">
                          PERP
                        </span>
                        {isActive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#22d3ee]" />
                        )}
                      </div>
                      <div className="text-[10px] text-[#556b73] truncate">
                        {market.name}
                      </div>
                    </div>
                  </div>

                  {/* Last Price */}
                  <div className="col-span-2 text-right font-mono text-xs font-semibold text-white">
                    ${market.lastPrice.toLocaleString(undefined, {
                      minimumFractionDigits: market.lastPrice >= 100 ? 2 : 4,
                      maximumFractionDigits: market.lastPrice >= 100 ? 2 : 4,
                    })}
                  </div>

                  {/* 24h Change */}
                  <div
                    className={cn(
                      "col-span-2 text-right font-mono text-xs font-medium",
                      isPositive ? "text-[#00d084]" : "text-[#ff4757]"
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {market.changePercent24h.toFixed(2)}%
                  </div>

                  {/* 24h Volume */}
                  <div className="col-span-2 text-right font-mono text-xs text-[#8aa1a7]">
                    ${(market.volume24h >= 1_000_000
                      ? `${(market.volume24h / 1_000_000).toFixed(1)}M`
                      : `${(market.volume24h / 1_000).toFixed(1)}K`)}
                  </div>

                  {/* Funding */}
                  <div className="col-span-1 text-right font-mono text-[11px] text-[#8aa1a7]">
                    {(market.fundingRate * 100).toFixed(4)}%
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
