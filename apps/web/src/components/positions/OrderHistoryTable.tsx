import { useState, useMemo } from "react";
import { useIsPaperTrading } from "@/hooks/useIsPaperTrading";
import { usePaperTradingStore, type PaperOrderHistoryRecord } from "@/store/paperTradingStore";
import { useOrdersStore, type Order } from "@/store/ordersStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

const formatNumber = (value: number, fractionDigits = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

const formatPrice = (value: number) => formatNumber(value, value >= 1000 ? 2 : 4);

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

export function OrderHistoryTable() {
  const [page, setPage] = useState(1);
  const isPaperTrading = useIsPaperTrading();
  const paperOrderHistory = usePaperTradingStore((s) => s.orderHistory);
  const realOrders = useOrdersStore((s) => s.openOrders);

  const items = useMemo(() => {
    if (isPaperTrading) {
      return paperOrderHistory;
    }
    // In live mode, show terminal orders from store
    const terminalLiveOrders: PaperOrderHistoryRecord[] = realOrders
      .filter((o) => ["filled", "cancelled", "rejected"].includes(o.status))
      .map((o: Order) => ({
        id: o.id,
        market: o.market,
        side: o.side,
        type: o.type,
        price: o.price,
        avgFillPrice: o.status === "filled" ? o.price : undefined,
        size: o.size,
        filledSize: o.filledSize,
        status: o.status as "filled" | "cancelled" | "rejected",
        timestamp: o.updatedAt || o.createdAt,
      }));
    return terminalLiveOrders;
  }, [isPaperTrading, paperOrderHistory, realOrders]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginatedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-[#1a2830] bg-[#0c181b] px-4 py-8 text-center text-xs text-[#64748b]">
        {isPaperTrading
          ? "No historical paper orders. Place a market, limit, or stop order above to see completed fills and cancellations."
          : "No completed or cancelled orders recorded in this session."}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#1a2830] bg-[#0c181b]">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="border-b border-[#1a2830] hover:bg-transparent">
            <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Time</TableHead>
            <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Market</TableHead>
            <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Type</TableHead>
            <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Side</TableHead>
            <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Price</TableHead>
            <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Avg Fill</TableHead>
            <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Size</TableHead>
            <TableHead className="text-[10px] uppercase font-mono text-[#64748b]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedItems.map((order) => (
            <TableRow key={order.id} className="border-b border-[#142228] hover:bg-[#112025]/50 font-mono">
              <TableCell className="text-[#64748b]">{formatTime(order.timestamp)}</TableCell>
              <TableCell className="font-semibold text-white">{order.market}</TableCell>
              <TableCell className="uppercase text-[#8ea4a9]">{order.type}</TableCell>
              <TableCell
                className={cn(
                  "uppercase font-medium",
                  order.side === "buy" ? "text-[#00d084]" : "text-[#ff4757]"
                )}
              >
                {order.side}
              </TableCell>
              <TableCell className="text-[#c8d4d7]">{formatPrice(order.price)}</TableCell>
              <TableCell className="text-[#c8d4d7]">
                {order.avgFillPrice ? formatPrice(order.avgFillPrice) : "--"}
              </TableCell>
              <TableCell className="text-white">
                {formatNumber(order.filledSize, 4)} / {formatNumber(order.size, 4)}
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                    order.status === "filled"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : order.status === "cancelled"
                      ? "bg-[#1a2830] text-[#8ea4a9]"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  )}
                >
                  {order.status}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#1a2830] px-3 py-2 text-xs text-[#64748b]">
          <span>
            Page {page} of {totalPages} ({items.length} total orders)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-7 text-xs border-[#1a2830] bg-[#091416] text-[#c8d4d7] hover:bg-[#112025]"
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-7 text-xs border-[#1a2830] bg-[#091416] text-[#c8d4d7] hover:bg-[#112025]"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
