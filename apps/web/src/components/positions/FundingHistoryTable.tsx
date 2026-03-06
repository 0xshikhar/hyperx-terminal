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

type FundingRow = {
  id: string;
  market: string;
  rate: number;
  payment: number;
  time: string;
};

const PAGE_SIZE = 6;

const fundingSeed: FundingRow[] = [
  { id: "fund-1", market: "BTC-USD", rate: 0.0125, payment: 8.21, time: "2026-03-08T00:00:00Z" },
  { id: "fund-2", market: "ETH-USD", rate: -0.009, payment: -3.12, time: "2026-03-07T23:00:00Z" },
  { id: "fund-3", market: "STRK-USD", rate: 0.021, payment: 1.86, time: "2026-03-07T22:00:00Z" },
  { id: "fund-4", market: "BTC-USD", rate: 0.011, payment: 7.42, time: "2026-03-07T21:00:00Z" },
  { id: "fund-5", market: "ETH-USD", rate: -0.008, payment: -2.64, time: "2026-03-07T20:00:00Z" },
  { id: "fund-6", market: "STRK-USD", rate: 0.018, payment: 1.24, time: "2026-03-07T19:00:00Z" },
  { id: "fund-7", market: "BTC-USD", rate: 0.010, payment: 6.88, time: "2026-03-07T18:00:00Z" },
];

const formatNumber = (value: number, fractionDigits = 4) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

const formatTime = (value: string) => new Date(value).toLocaleTimeString();

export function FundingHistoryTable() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["funding-history", page],
    queryFn: async () => {
      const start = (page - 1) * PAGE_SIZE;
      const items = fundingSeed.slice(start, start + PAGE_SIZE);
      return { items, total: fundingSeed.length };
    },
    staleTime: 60_000,
    keepPreviousData: true,
  });

  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="rounded-md border border-border bg-background">
      {isLoading ? (
        <div className="px-3 py-8 text-xs text-muted-foreground">Loading funding…</div>
      ) : items.length === 0 ? (
        <div className="px-3 py-8 text-xs text-muted-foreground">No funding history yet.</div>
      ) : (
        <>
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Market</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-semibold">{row.market}</TableCell>
                  <TableCell className={row.rate >= 0 ? "text-emerald-500" : "text-rose-500"}>
                    {row.rate >= 0 ? "+" : ""}
                    {formatNumber(row.rate, 4)}%
                  </TableCell>
                  <TableCell className={cn(row.payment >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {row.payment >= 0 ? "+" : ""}
                    {formatNumber(row.payment, 2)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatTime(row.time)}</TableCell>
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
