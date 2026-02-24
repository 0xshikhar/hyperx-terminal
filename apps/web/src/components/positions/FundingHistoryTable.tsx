import { useState } from "react";
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

const PAGE_SIZE = 20;

const formatNumber = (value: number, fractionDigits = 4) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

const formatTime = (value: string) => new Date(value).toLocaleTimeString();

export function FundingHistoryTable() {
  const [page, setPage] = useState(1);
  const network = useNetworkStore((s) => s.network);
  const { data, isLoading } = useQuery<{ items: FundingHistoryDto[]; total: number }>({
    queryKey: ["funding-history", page, network],
    queryFn: () => listFundingHistory(page),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false,
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
              {items.map((row: FundingHistoryDto) => (
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
