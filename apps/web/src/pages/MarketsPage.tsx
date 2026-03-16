import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  BarChart3,
  Percent,
  Clock,
  ArrowUpDown,
  Filter,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketStore } from "@/store/marketStore";

const TABS = [
  { id: "all", label: "All Markets" },
  { id: "perps", label: "Perpetuals" },
  { id: "spot", label: "Spot" },
  { id: "favorites", label: "Favorites" },
  { id: "gainers", label: "Top Gainers" },
  { id: "losers", label: "Top Losers" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type SortKey = "symbol" | "price" | "change" | "volume" | "oi";
type SortDir = "asc" | "desc";

export function MarketsPage() {
  const navigate = useNavigate();
  const { activeMarket, markets, setActiveMarket } = useMarketStore();
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const activeMarketData = markets.find((m) => m.symbol === activeMarket) ?? markets[0];

  // Filter markets based on tab
  const filteredMarkets = useMemo(() => {
    let filtered = markets;

    if (activeTab === "perps") {
      filtered = markets.filter((m) => m.symbol.includes("-USD"));
    } else if (activeTab === "spot") {
      filtered = markets.filter((m) => !m.symbol.includes("-USD"));
    } else if (activeTab === "gainers") {
      filtered = [...markets].sort((a, b) => b.changePercent24h - a.changePercent24h);
    } else if (activeTab === "losers") {
      filtered = [...markets].sort((a, b) => a.changePercent24h - b.changePercent24h);
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortKey) {
        case "symbol":
          aVal = a.symbol;
          bVal = b.symbol;
          break;
        case "price":
          aVal = a.lastPrice;
          bVal = b.lastPrice;
          break;
        case "change":
          aVal = a.changePercent24h;
          bVal = b.changePercent24h;
          break;
        case "volume":
          aVal = a.volume24h;
          bVal = b.volume24h;
          break;
        case "oi":
          aVal = a.openInterest;
          bVal = b.openInterest;
          break;
        default:
          aVal = a.volume24h;
          bVal = b.volume24h;
      }

      if (typeof aVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortDir === "asc" ? aVal - (bVal as number) : (bVal as number) - aVal;
    });
  }, [markets, activeTab, searchQuery, sortKey, sortDir]);

  // Global market stats
  const totalVolume = markets.reduce((sum, m) => sum + m.volume24h, 0);
  const totalOI = markets.reduce((sum, m) => sum + m.openInterest, 0);
  const avgChange =
    markets.reduce((sum, m) => sum + m.changePercent24h, 0) / (markets.length || 1);
  const topGainer = [...markets].sort((a, b) => b.changePercent24h - a.changePercent24h)[0];
  const topLoser = [...markets].sort((a, b) => a.changePercent24h - b.changePercent24h)[0];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#081214] text-[#d8dfe1]">
      {/* Header - Compact Stats */}
      <header className="border-b border-[#162326] bg-[#0a1518]">
        <div className="flex flex-col gap-3 px-5 py-3">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#112327] text-[#53d8c8]">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Markets</h1>
                <p className="text-xs text-[#708084]">
                  {markets.length} markets • ${(totalVolume / 1e9).toFixed(2)}B 24h volume
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-[#708084]">Top Gainer</p>
                <p className="font-mono text-sm font-semibold text-[#53d8c8]">
                  {topGainer?.symbol} +{topGainer?.changePercent24h.toFixed(2)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#708084]">Top Loser</p>
                <p className="font-mono text-sm font-semibold text-[#f16d75]">
                  {topLoser?.symbol} {topLoser?.changePercent24h.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* Compact Stats Row */}
          <div className="grid grid-cols-5 gap-2">
            <CompactStat
              icon={DollarSign}
              label="24h Volume"
              value={`$${(totalVolume / 1e9).toFixed(2)}B`}
            />
            <CompactStat
              icon={Activity}
              label="Open Interest"
              value={`$${(totalOI / 1e9).toFixed(2)}B`}
            />
            <CompactStat
              icon={avgChange >= 0 ? TrendingUp : TrendingDown}
              label="Avg Change"
              value={`${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%`}
              positive={avgChange >= 0}
            />
            <CompactStat
              icon={Percent}
              label="Funding Rate"
              value={`${(activeMarketData?.fundingRate ?? 0).toFixed(4)}%`}
            />
            <CompactStat
              icon={Clock}
              label="Mark Price"
              value={`$${activeMarketData?.lastPrice.toFixed(2) ?? "--"}`}
            />
          </div>
        </div>

        {/* Tab Navigation + Search */}
        <div className="flex items-center justify-between border-b border-[#162326] px-5">
          <div className="flex">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "text-white"
                    : "text-[#6b6b74] hover:text-[#a0a0a8]"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#53d8c8]" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b6b74]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search markets..."
                className="w-64 rounded-md border border-[#213136] bg-[#102125] py-2 pl-9 pr-3 text-sm text-[#d8dfe1] placeholder-[#64767b] outline-none focus:border-[#53d8c8]"
              />
            </div>
            <button className="rounded-md border border-[#213136] bg-[#102125] p-2 text-[#6b6b74] hover:text-[#d8dfe1]">
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Markets Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-[#0a1518]">
            <tr className="border-b border-[#162326] text-xs uppercase text-[#708084]">
              <th className="px-5 py-3 font-medium">
                <button
                  onClick={() => handleSort("symbol")}
                  className="flex items-center gap-1 hover:text-white"
                >
                  Market
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-5 py-3 font-medium text-right">
                <button
                  onClick={() => handleSort("price")}
                  className="ml-auto flex items-center gap-1 hover:text-white"
                >
                  Price
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-5 py-3 font-medium text-right">
                <button
                  onClick={() => handleSort("change")}
                  className="ml-auto flex items-center gap-1 hover:text-white"
                >
                  24h Change
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-5 py-3 font-medium text-right">
                <button
                  onClick={() => handleSort("volume")}
                  className="ml-auto flex items-center gap-1 hover:text-white"
                >
                  24h Volume
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-5 py-3 font-medium text-right">
                <button
                  onClick={() => handleSort("oi")}
                  className="ml-auto flex items-center gap-1 hover:text-white"
                >
                  Open Interest
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-5 py-3 font-medium text-right">Funding</th>
              <th className="px-5 py-3 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredMarkets.map((market) => {
              const isActive = market.symbol === activeMarket;
              const isPositive = market.changePercent24h >= 0;

              return (
                <tr
                  key={market.symbol}
                  onClick={() => setActiveMarket(market.symbol)}
                  className={cn(
                    "cursor-pointer border-b border-[#162326] transition-colors hover:bg-[#0f1d21]",
                    isActive && "bg-[#0f1d21]"
                  )}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#6b6b74] hover:text-[#53d8c8]"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                      <div>
                        <p className="font-medium text-white">{market.symbol}</p>
                        <p className="text-xs text-[#708084]">{market.name}</p>
                      </div>
                      {isActive && (
                        <span className="rounded bg-[#2a555c] px-1.5 py-0.5 text-[10px] text-[#53d8c8]">
                          Active
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono text-sm text-white">
                      ${market.lastPrice.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={cn(
                        "font-mono text-sm",
                        isPositive ? "text-[#53d8c8]" : "text-[#f16d75]"
                      )}
                    >
                      {isPositive ? "+" : ""}
                      {market.changePercent24h.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono text-sm text-white">
                      ${(market.volume24h / 1e6).toFixed(2)}M
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono text-sm text-white">
                      ${(market.openInterest / 1e6).toFixed(2)}M
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono text-sm text-[#53d8c8]">
                      {market.fundingRate.toFixed(4)}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMarket(market.symbol);
                        navigate("/terminal");
                      }}
                      className="rounded-md bg-[#53d8c8] px-3 py-1.5 text-xs font-medium text-[#041013] transition-colors hover:bg-[#00e090]"
                    >
                      Trade
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredMarkets.length === 0 && (
          <div className="flex h-64 items-center justify-center text-[#708084]">
            <p>No markets found matching your search</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact Stat Card
function CompactStat({
  icon: Icon,
  label,
  value,
  positive,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-md border border-[#162326] bg-[#0c181b] px-3 py-2">
      <div className="flex items-center gap-1.5">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            positive === undefined
              ? "text-[#708084]"
              : positive
                ? "text-[#53d8c8]"
                : "text-[#f16d75]"
          )}
        />
        <span className="text-[10px] uppercase tracking-[0.1em] text-[#708084]">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-semibold",
          positive === undefined
            ? "text-white"
            : positive
              ? "text-[#53d8c8]"
              : "text-[#f16d75]"
        )}
      >
        {value}
      </p>
    </div>
  );
}
