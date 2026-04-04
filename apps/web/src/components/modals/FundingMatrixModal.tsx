import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMarketStore } from "@/store/marketStore";
import { dispatchTerminalAction } from "@/lib/terminalActions";
import { terminalAudio } from "@/lib/terminalAudio";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Activity,
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  HelpCircle,
  Percent,
} from "lucide-react";

interface FundingMatrixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SortField = "apr" | "rate1h" | "volume" | "symbol";
type SortDirection = "asc" | "desc";
type FilterType = "all" | "shorts-earn" | "longs-earn" | "high-yield";

export function FundingMatrixModal({ open, onOpenChange }: FundingMatrixModalProps) {
  const markets = useMarketStore((s) => s.markets);
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const setActiveMarket = useMarketStore((s) => s.setActiveMarket);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortField, setSortField] = useState<SortField>("apr");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Next funding countdown (per-hour mark e.g. xx:00)
  const [countdown, setCountdown] = useState<string>("00:00");
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const minutes = 59 - now.getUTCMinutes();
      const seconds = 59 - now.getUTCSeconds();
      setCountdown(
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Process and calculate APR metrics for each market
  const marketMetrics = useMemo(() => {
    return markets.map((m) => {
      const rate1h = m.fundingRate ?? 0;
      const rate1hPercent = rate1h * 100;
      const rate8hPercent = rate1h * 8 * 100;
      // Annualized APR = rate1h * 24 * 365 * 100
      const aprPercent = rate1h * 24 * 365 * 100;
      // If funding rate is positive: Longs pay Shorts -> Shorts earn yield
      // If funding rate is negative: Shorts pay Longs -> Longs earn yield
      const yieldSide: "sell" | "buy" = aprPercent >= 0 ? "sell" : "buy";
      const yieldRole = aprPercent >= 0 ? "Shorts Earn Yield" : "Longs Earn Yield";

      return {
        ...m,
        rate1hPercent,
        rate8hPercent,
        aprPercent,
        absApr: Math.abs(aprPercent),
        yieldSide,
        yieldRole,
      };
    });
  }, [markets]);

  // Filter and sort
  const filteredMarkets = useMemo(() => {
    return marketMetrics
      .filter((m) => {
        // Search filter
        if (
          searchQuery &&
          !m.symbol.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !m.name.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }

        // Category filter
        if (filterType === "shorts-earn") {
          return m.aprPercent > 0;
        }
        if (filterType === "longs-earn") {
          return m.aprPercent < 0;
        }
        if (filterType === "high-yield") {
          return m.absApr >= 15;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "apr") {
          cmp = a.absApr - b.absApr;
        } else if (sortField === "rate1h") {
          cmp = a.rate1hPercent - b.rate1hPercent;
        } else if (sortField === "volume") {
          cmp = a.volume24h - b.volume24h;
        } else if (sortField === "symbol") {
          cmp = a.symbol.localeCompare(b.symbol);
        }
        return sortDirection === "desc" ? -cmp : cmp;
      });
  }, [marketMetrics, searchQuery, filterType, sortField, sortDirection]);

  // Quick stats summary
  const summaryStats = useMemo(() => {
    if (marketMetrics.length === 0) {
      return { topYield: null, avgApr: 0 };
    }
    const sorted = [...marketMetrics].sort((a, b) => b.absApr - a.absApr);
    const top = sorted[0];
    const totalApr = marketMetrics.reduce((acc, m) => acc + m.absApr, 0);
    const avg = totalApr / marketMetrics.length;
    return { topYield: top, avgApr: avg };
  }, [marketMetrics]);

  const handleCaptureYield = (m: (typeof marketMetrics)[0]) => {
    terminalAudio.playOrderSubmit();
    setActiveMarket(m.symbol);

    // Dispatch terminal action to prefill trade form with the yield-earning side
    const targetPrice = m.markPrice || m.lastPrice;
    dispatchTerminalAction({
      type: "prefill-order",
      side: m.yieldSide,
      price: targetPrice,
    });

    toast.success(
      `Yield Capture Initiated: ${m.symbol} set to ${m.yieldSide.toUpperCase()} (${m.yieldRole})`,
      {
        description: `APR: ${m.aprPercent >= 0 ? "+" : ""}${m.aprPercent.toFixed(2)}% · Settlement in ${countdown}`,
      }
    );

    onOpenChange(false);
  };

  const toggleSort = (field: SortField) => {
    terminalAudio.playClick();
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="funding-matrix-modal"
        className="max-w-4xl border-[#1d2d32] bg-[#0c1417] text-[#c8d4d7] p-0 shadow-[0_25px_80px_rgba(0,0,0,0.85)] max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header Strip */}
        <div className="border-b border-[#18262b] px-6 py-4 bg-[#0a1214]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-[#ecf2f3] tracking-wide flex items-center gap-2">
                  Cross-Market Funding & APR Matrix
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
                    CARRY YIELD
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-[#71878d]">
                  Monitor funding arbitrage opportunities & annualized yield across Starknet perp markets
                </DialogDescription>
              </div>
            </div>

            {/* Next Settlement Countdown */}
            <div className="flex items-center gap-2 rounded-lg border border-[#1d2d32] bg-[#0e191d] px-3 py-1.5 font-mono text-xs shadow-inner">
              <Clock className="h-3.5 w-3.5 text-[#22d3ee] animate-spin" />
              <span className="text-[#64748b]">Next Funding:</span>
              <span className="font-bold text-[#ecf2f3]">{countdown}</span>
            </div>
          </div>

          {/* Quick Metrics Banners */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-[#1a2b30] bg-[#0f1b20] p-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#64748b]">Top Carry Yield</span>
                <div className="font-mono text-sm font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                  {summaryStats.topYield?.symbol || "--"}
                  <span className="text-xs font-normal text-emerald-300/80">
                    ({summaryStats.topYield?.aprPercent ? `${summaryStats.topYield.aprPercent.toFixed(1)}%` : "--"} APR)
                  </span>
                </div>
              </div>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>

            <div className="rounded-lg border border-[#1a2b30] bg-[#0f1b20] p-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#64748b]">Mean Absolute APR</span>
                <div className="font-mono text-sm font-bold text-[#22d3ee] mt-0.5">
                  {summaryStats.avgApr.toFixed(2)}% APR
                </div>
              </div>
              <Percent className="h-4 w-4 text-[#22d3ee]" />
            </div>

            <div className="rounded-lg border border-[#1a2b30] bg-[#0f1b20] p-2.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#64748b]">Arbitrage Strategy</span>
                <div className="font-mono text-xs font-semibold text-[#e2e8f0] mt-0.5">
                  Delta-Neutral Spot/Perp
                </div>
              </div>
              <Zap className="h-4 w-4 text-amber-400" />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#18262b] px-6 py-3 bg-[#0a1214]">
          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {(
              [
                { id: "all", label: "All Markets" },
                { id: "shorts-earn", label: "Shorts Earn (+Rate)" },
                { id: "longs-earn", label: "Longs Earn (-Rate)" },
                { id: "high-yield", label: "High APR (≥15%)" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  terminalAudio.playClick();
                  setFilterType(tab.id);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-all",
                  filterType === tab.id
                    ? "bg-[#162a30] text-[#22d3ee] font-semibold shadow-[0_0_8px_rgba(34,211,238,0.2)]"
                    : "text-[#64748b] hover:bg-[#121f24] hover:text-[#94a3b8]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#506068]" />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-[#1d2d32] bg-[#0c181b] pl-8 pr-3 py-1 text-xs text-[#dde5e7] placeholder-[#506068] focus:border-[#22d3ee] focus:outline-none"
            />
          </div>
        </div>

        {/* Matrix Table */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
          <table className="w-full border-collapse text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#18262b] text-[10px] uppercase font-semibold text-[#506068]">
                <th
                  onClick={() => toggleSort("symbol")}
                  className="cursor-pointer py-2.5 pl-2 pr-4 hover:text-[#94a3b8] transition-colors"
                >
                  <span className="flex items-center gap-1">
                    Market
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="py-2.5 px-3 text-right">Mark Price</th>
                <th
                  onClick={() => toggleSort("rate1h")}
                  className="cursor-pointer py-2.5 px-3 text-right hover:text-[#94a3b8] transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    1h Rate
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="py-2.5 px-3 text-right">8h Pred.</th>
                <th
                  onClick={() => toggleSort("apr")}
                  className="cursor-pointer py-2.5 px-3 text-right hover:text-[#94a3b8] transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    Annualized APR
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="py-2.5 px-3 text-center">Yield Flow</th>
                <th
                  onClick={() => toggleSort("volume")}
                  className="cursor-pointer py-2.5 px-3 text-right hover:text-[#94a3b8] transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    24h Volume
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="py-2.5 pl-3 pr-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#132025]">
              {filteredMarkets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#506068]">
                    No markets found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredMarkets.map((m) => {
                  const isCurrent = m.symbol === activeMarket;
                  const isPositive = m.rate1hPercent >= 0;

                  return (
                    <tr
                      key={m.symbol}
                      className={cn(
                        "group transition-colors hover:bg-[#101e23]/70",
                        isCurrent && "bg-cyan-500/5"
                      )}
                    >
                      {/* Market / Symbol */}
                      <td className="py-3 pl-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full",
                              isPositive ? "bg-emerald-400" : "bg-cyan-400"
                            )}
                          />
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-[#ecf2f3]">
                              {m.symbol}
                              {isCurrent && (
                                <span className="rounded bg-cyan-500/20 px-1 py-0.2 text-[9px] font-semibold text-cyan-300">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#64748b]">{m.name}</div>
                          </div>
                        </div>
                      </td>

                      {/* Mark Price */}
                      <td className="py-3 px-3 text-right font-medium text-[#c8d4d7]">
                        ${(m.markPrice || m.lastPrice).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </td>

                      {/* 1h Rate */}
                      <td className="py-3 px-3 text-right">
                        <span
                          className={cn(
                            "font-bold",
                            isPositive ? "text-emerald-400" : "text-cyan-400"
                          )}
                        >
                          {isPositive ? "+" : ""}
                          {m.rate1hPercent.toFixed(4)}%
                        </span>
                      </td>

                      {/* 8h Predicted */}
                      <td className="py-3 px-3 text-right text-[#94a3b8]">
                        {isPositive ? "+" : ""}
                        {m.rate8hPercent.toFixed(4)}%
                      </td>

                      {/* Annualized APR */}
                      <td className="py-3 px-3 text-right">
                        <span
                          className={cn(
                            "inline-block rounded px-2 py-0.5 font-bold",
                            isPositive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                              : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_8px_rgba(34,211,238,0.15)]"
                          )}
                        >
                          {isPositive ? "+" : ""}
                          {m.aprPercent.toFixed(2)}%
                        </span>
                      </td>

                      {/* Yield Flow Direction */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            m.yieldSide === "sell"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-cyan-500/10 text-cyan-300"
                          )}
                        >
                          {m.yieldSide === "sell" ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {m.yieldRole}
                        </span>
                      </td>

                      {/* 24h Volume */}
                      <td className="py-3 px-3 text-right text-[#8299a0]">
                        ${(m.volume24h / 1_000_000).toFixed(2)}M
                      </td>

                      {/* 1-Click Action */}
                      <td className="py-3 pl-3 pr-2 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleCaptureYield(m)}
                          className={cn(
                            "h-7 px-2.5 text-[11px] font-mono font-semibold transition-all",
                            m.yieldSide === "sell"
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                              : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                          )}
                        >
                          <Zap className="mr-1 h-3 w-3" />
                          Capture
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info note */}
        <div className="border-t border-[#18262b] bg-[#081012] px-6 py-2.5 flex items-center justify-between text-[11px] text-[#64748b]">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-3.5 w-3.5 text-[#506068]" />
            <span>
              <strong>Carry Trade Primer:</strong> To capture positive APR delta-neutrally, buy Spot and open an equivalent Short Perp. Funding settlements are paid continuously every hour directly to your margin balance.
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs text-[#94a3b8] hover:text-white"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
