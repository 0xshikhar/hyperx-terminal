import { useState } from "react";
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
import { useTradingModeStore } from "@/store/tradingModeStore";

const PAGE_SIZE = 20;

const demoItems: TradeHistoryDto[] = [
  {
    id: "demo-trade-1",
    market: "BTC-USD",
    side: "buy",
    size: 0.18,
    price: 94580,
    fee: 3.42,
    pnl: 128.55,
    executedAt: "2026-05-24T01:15:00Z",
  },
  {
    id: "demo-trade-2",
    market: "ETH-USD",
    side: "sell",
    size: 1.75,
    price: 4878.4,
    fee: 2.1,
    pnl: -34.2,
    executedAt: "2026-05-24T01:03:00Z",
  },
  {
    id: "demo-trade-3",
    market: "STRK-USD",
    side: "buy",
    size: 900,
    price: 2.31,
    fee: 0.84,
    pnl: 19.75,
    executedAt: "2026-05-24T00:44:00Z",
  },
];

const formatNumber = (value: number, fractionDigits = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

const formatTime = (value: string) => new Date(value).toLocaleTimeString();

export function TradeHistoryTable() {
  const [page, setPage] = useState(1);
  const tradingMode = useTradingModeStore((s) => s.mode);
  const shouldFetch = tradingMode === "real";
  const { data, isLoading } = useQuery<{ items: TradeHistoryDto[]; total: number }>({
    queryKey: ["trade-history", page, tradingMode],
    queryFn: () => listTradeHistory(page),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false,
    enabled: shouldFetch,
  });

  const items = shouldFetch ? (data?.items ?? []) : demoItems;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="rounded-md border border-border bg-background">
      {isLoading ? (
        <div className="px-3 py-8 text-xs text-muted-foreground">Loading history…</div>
      ) : items.length === 0 ? (
        <div className="px-3 py-8 text-xs text-muted-foreground">No trades yet.</div>
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
                      "uppercase",
                      row.side === "buy" ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {row.side}
                  </TableCell>
                  <TableCell>{formatNumber(row.size, 4)}</TableCell>
                  <TableCell>{formatNumber(row.price, row.price >= 1000 ? 2 : 4)}</TableCell>
                  <TableCell>{formatNumber(row.fee, 2)}</TableCell>
                  <TableCell className={row.pnl >= 0 ? "text-emerald-500" : "text-rose-500"}>
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
