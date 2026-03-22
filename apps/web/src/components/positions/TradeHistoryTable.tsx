import { useState, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { listTradeHistory, type TradeHistoryDto } from "@/services/apiClient/positions.api";
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
import { useWallet } from "@/components/wallet/useWallet";
import { usePaperTradingStore } from "@/store/paperTradingStore";

const PAGE_SIZE = 20;

const formatNumber = (value: number, fractionDigits = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

const formatTime = (value: string) => new Date(value).toLocaleTimeString();

export function TradeHistoryTable() {
  const [page, setPage] = useState(1);
  const network = useNetworkStore((s) => s.network);
  const isPaperWallet = useWallet((s) => s.isPaperWallet);
  const isPaperTrading = useNetworkStore((s) => s.isPaperTrading) || isPaperWallet;

  const paperHistory = usePaperTradingStore((s) => s.tradeHistory);

  const { data, isLoading, isError, refetch } = useQuery<{ items: TradeHistoryDto[]; total: number }>({
    queryKey: ["trade-history", page, network],
    queryFn: () => listTradeHistory(page),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false,
    enabled: !isPaperTrading,
  });

  const { items, totalPages } = useMemo(() => {
    if (isPaperTrading) {
      const mapped: TradeHistoryDto[] = paperHistory.map((h) => ({
        id: h.id,
        market: h.market,
        side: h.side,
        size: h.size,
        price: h.price,
        fee: 0,
        pnl: h.realizedPnl ?? 0,
        executedAt: new Date(h.timestamp).toISOString(),
      }));
      const total = mapped.length;
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const pageItems = mapped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      return { items: pageItems, totalPages: pages };
    }

    const liveItems = data?.items ?? [];
    const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
    return { items: liveItems, totalPages: pages };
  }, [isPaperTrading, paperHistory, data, page]);

  return (
    <div className="rounded-md border border-border bg-background">
      {!isPaperTrading && isLoading ? (
        <div className="px-3 py-8 text-xs text-muted-foreground">Loading history…</div>
      ) : !isPaperTrading && isError ? (
        <div className="flex flex-col items-center gap-2 px-3 py-8">
          <p className="text-xs text-rose-400">Failed to load history</p>
          <button
            onClick={() => refetch()}
            className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="px-3 py-8 text-xs text-muted-foreground text-center">
          {isPaperTrading
            ? "No paper trades executed yet. Place an order to test."
            : "No trades yet."}
        </div>
      ) : (
        <>
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Market</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>PnL</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row: TradeHistoryDto) => (
                <TableRow key={row.id}>
                  <TableCell className="font-semibold">{row.market}</TableCell>
                  <TableCell
                    className={cn(
                      "uppercase font-medium",
                      row.side === "buy" ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {row.side}
                  </TableCell>
                  <TableCell>{formatNumber(row.size, 4)}</TableCell>
                  <TableCell>{formatNumber(row.price, row.price >= 1000 ? 2 : 4)}</TableCell>
                  <TableCell>{formatNumber(row.fee, 2)}</TableCell>
                  <TableCell className={row.pnl >= 0 ? "text-emerald-400 font-medium" : "text-rose-400 font-medium"}>
                    {row.pnl >= 0 ? "+" : ""}
                    {formatNumber(row.pnl, 2)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatTime(row.executedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
