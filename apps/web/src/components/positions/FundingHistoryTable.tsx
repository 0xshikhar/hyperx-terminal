import { useState, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { listFundingHistory, type FundingHistoryDto } from "@/services/apiClient/positions.api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useNetworkStore } from "@/store/networkStore";
import { useIsPaperTrading } from "@/hooks/useIsPaperTrading";
import { usePaperTradingStore, type PaperFundingRecord } from "@/store/paperTradingStore";
import { useMarketStore } from "@/store/marketStore";
import { Info } from "lucide-react";

const PAGE_SIZE = 20;

const formatNumber = (value: number, fractionDigits = 4) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

const formatTime = (value: string) => {
  try {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return value;
  }
};

export function FundingHistoryTable() {
  const [page, setPage] = useState(1);
  const network = useNetworkStore((s) => s.network);
  const isPaperTrading = useIsPaperTrading();
  const paperFundingHistory = usePaperTradingStore((s) => s.fundingHistory);
  const paperPositions = usePaperTradingStore((s) => s.positions);
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const markets = useMarketStore((s) => s.markets);
  const market = markets.find((m) => m.symbol === activeMarket);
  const currentFundingRate = market?.fundingRate ?? 0.0001;

  const { data, isLoading, isError, refetch } = useQuery<{ items: FundingHistoryDto[]; total: number }>({
    queryKey: ["funding-history", page, network],
    queryFn: () => listFundingHistory(page),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false,
    enabled: !isPaperTrading,
  });

  const { items, totalPages } = useMemo(() => {
    if (isPaperTrading) {
      const mapped: FundingHistoryDto[] = paperFundingHistory.map((f: PaperFundingRecord) => ({
        id: f.id,
        market: f.market,
        rate: f.rate,
        payment: f.payment,
        time: f.time,
      }));
      const total = mapped.length;
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const pageItems = mapped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      return { items: pageItems, totalPages: pages };
    }

    const liveItems = data?.items ?? [];
    const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
    return { items: liveItems, totalPages: pages };
  }, [isPaperTrading, paperFundingHistory, data, page]);

  // Estimate next funding payment for active paper position
  const activePos = paperPositions.find((p) => p.market === activeMarket);
  const estPayment = activePos
    ? -1 * activePos.size * activePos.markPrice * currentFundingRate * (activePos.side === "long" ? 1 : -1)
    : 0;

  return (
    <div className="space-y-3">
      {/* Funding Rate Overview banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#1a2830] bg-[#0c181b] px-3.5 py-2 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[#8ea4a9]">
            <Info className="h-3.5 w-3.5 text-[#22d3ee]" />
            <span>Market Rate ({activeMarket}):</span>
            <span className={cn("font-mono font-semibold", currentFundingRate >= 0 ? "text-[#00d084]" : "text-[#ff4757]")}>
              {currentFundingRate >= 0 ? "+" : ""}{(currentFundingRate * 100).toFixed(4)}% / 1h
            </span>
          </div>
          {activePos && (
            <div className="flex items-center gap-1.5 text-[#8ea4a9]">
              <span>Est. Next Payment:</span>
              <span className={cn("font-mono font-semibold", estPayment >= 0 ? "text-[#00d084]" : "text-[#ff4757]")}>
                {estPayment >= 0 ? "+" : ""}${estPayment.toFixed(3)}
              </span>
              <span className="text-[10px] text-[#64748b]">({activePos.side.toUpperCase()} {activePos.size})</span>
            </div>
          )}
        </div>
        <span className="text-[11px] text-[#64748b]">
          {isPaperTrading ? "⚡ Periodic simulated funding settlement" : "Settled hourly on Starknet"}
        </span>
      </div>

      <div className="rounded-md border border-[#1a2830] bg-[#0c181b]">
        {!isPaperTrading && isLoading ? (
          <div className="px-3 py-8 text-xs text-[#64748b] text-center">Loading live funding history…</div>
        ) : !isPaperTrading && isError ? (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <p className="text-xs text-rose-400">Unable to reach exchange funding endpoint</p>
            <button
              onClick={() => refetch()}
              className="rounded border border-[#1a2830] bg-[#091416] px-3 py-1 text-xs text-[#8ea4a9] hover:text-white"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-[#64748b]">
            {isPaperTrading
              ? "No paper funding payments settled yet. Funding payments are simulated automatically every 60s for open positions."
              : "No funding history recorded for this account."}
          </div>
        ) : (
          <>
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="border-b border-[#1a2830] hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Market</TableHead>
                  <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Rate</TableHead>
                  <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Payment</TableHead>
                  <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row: FundingHistoryDto) => (
                  <TableRow key={row.id} className="border-b border-[#142228] hover:bg-[#112025]/50 font-mono">
                    <TableCell className="font-semibold text-white">{row.market}</TableCell>
                    <TableCell className={row.rate >= 0 ? "text-[#00d084]" : "text-[#ff4757]"}>
                      {row.rate >= 0 ? "+" : ""}
                      {formatNumber(row.rate, 4)}%
                    </TableCell>
                    <TableCell className={cn(row.payment >= 0 ? "text-[#00d084]" : "text-[#ff4757]")}>
                      {row.payment >= 0 ? "+" : ""}${formatNumber(row.payment, 2)}
                    </TableCell>
                    <TableCell className="text-[#8ea4a9]">{formatTime(row.time)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#1a2830] px-3 py-2 text-xs text-[#64748b]">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                    className="h-7 text-xs border-[#1a2830] bg-[#091416] text-[#c8d4d7] hover:bg-[#112025]"
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page === totalPages}
                    className="h-7 text-xs border-[#1a2830] bg-[#091416] text-[#c8d4d7] hover:bg-[#112025]"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
