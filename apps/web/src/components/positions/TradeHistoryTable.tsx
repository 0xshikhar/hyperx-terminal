import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type TradeHistoryRow = {
  id: string;
  market: string;
  side: "buy" | "sell";
  size: number;
  price: number;
  fee: number;
  pnl: number;
  executedAt: string;
};

const PAGE_SIZE = 6;

const historySeed: TradeHistoryRow[] = [
  {
    id: "trade-1",
    market: "BTC-USD",
    side: "buy",
    size: 0.15,
    price: 94520,
    fee: 4.12,
    pnl: 82.4,
    executedAt: "2026-03-08T00:12:00Z",
  },
  {
    id: "trade-2",
    market: "ETH-USD",
    side: "sell",
    size: 1.2,
    price: 4840,
    fee: 2.01,
    pnl: -41.9,
    executedAt: "2026-03-08T00:03:00Z",
  },
  {
    id: "trade-3",
    market: "STRK-USD",
    side: "buy",
    size: 800,
    price: 2.26,
    fee: 0.38,
    pnl: 18.2,
    executedAt: "2026-03-07T23:55:00Z",
  },
  {
    id: "trade-4",
    market: "BTC-USD",
    side: "sell",
    size: 0.08,
    price: 95320,
    fee: 2.4,
    pnl: 36.8,
    executedAt: "2026-03-07T23:42:00Z",
  },
  {
    id: "trade-5",
    market: "ETH-USD",
    side: "buy",
    size: 2.6,
    price: 4772,
    fee: 3.11,
    pnl: 55.2,
    executedAt: "2026-03-07T23:30:00Z",
  },
  {
    id: "trade-6",
    market: "BTC-USD",
    side: "buy",
    size: 0.1,
    price: 93980,
    fee: 1.6,
    pnl: -12.6,
    executedAt: "2026-03-07T23:22:00Z",
  },
  {
    id: "trade-7",
    market: "STRK-USD",
    side: "sell",
    size: 600,
    price: 2.18,
    fee: 0.28,
    pnl: -9.6,
    executedAt: "2026-03-07T23:10:00Z",
  },
];

const formatNumber = (value: number, fractionDigits = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

const formatTime = (value: string) => new Date(value).toLocaleTimeString();

export function TradeHistoryTable() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["trade-history", page],
    queryFn: async () => {
      const start = (page - 1) * PAGE_SIZE;
      const items = historySeed.slice(start, start + PAGE_SIZE);
      return { items, total: historySeed.length };
    },
    staleTime: 60_000,
    keepPreviousData: true,
  });

  const items = data?.items ?? [];
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
              {items.map((row) => (
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
