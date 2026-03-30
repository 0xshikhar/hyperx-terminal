import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useOrdersStore } from "@/store/ordersStore";
import { useIsPaperTrading } from "@/hooks/useIsPaperTrading";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet/useWallet";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const formatNumber = (value: number, fractionDigits = 2) =>
  value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });

export function OpenOrdersTable() {
  const isPaperTrading = useIsPaperTrading();
  const realOrders = useOrdersStore((state) => state.openOrders);
  const fetchOrders = useOrdersStore((state) => state.fetchOrders);
  const markOrderCancelled = useOrdersStore((state) => state.markOrderCancelled);
  const isLoading = useOrdersStore((state) => state.isLoading);
  const error = useOrdersStore((state) => state.error);
  const isWalletConnected = useWallet((state) => state.isConnected);

  const paperOrders = usePaperTradingStore((s) => s.openOrders);
  const cancelPaperOrder = usePaperTradingStore((s) => s.cancelOrder);

  const orders = useMemo(() => {
    return isPaperTrading ? paperOrders : realOrders;
  }, [isPaperTrading, paperOrders, realOrders]);

  useEffect(() => {
    if (!isWalletConnected || isPaperTrading) return;
    void fetchOrders();
  }, [fetchOrders, isWalletConnected, isPaperTrading]);

  const counts = orders.reduce(
    (acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 md:grid-cols-4">
        <LifecycleCard
          label="Pending"
          value={counts.pending ?? 0}
          helper={isPaperTrading ? "Simulated orders queued" : "Awaiting acknowledgement"}
        />
        <LifecycleCard
          label="Working"
          value={(counts.open ?? 0) + (counts.partially_filled ?? 0)}
          helper={isPaperTrading ? "Active paper limit/stop orders" : "Live orders in book"}
        />
        <LifecycleCard
          label="Terminal"
          value={(counts.filled ?? 0) + (counts.cancelled ?? 0)}
          helper="Recently completed or cancelled"
        />
        <LifecycleCard
          label="Rejected"
          value={counts.rejected ?? 0}
          helper="Submission failures"
        />
      </div>

      <div className="rounded-md border border-[#1a2830] bg-[#0c181b]">
        {!isPaperTrading && isLoading ? (
          <div className="px-3 py-8 text-xs text-[#64748b] text-center">Loading open orders…</div>
        ) : !isPaperTrading && error ? (
          <div className="flex items-center justify-between gap-3 px-4 py-6 text-xs">
            <div className="text-[#64748b]">
              Failed to refresh open orders from the API. Showing last snapshot.
            </div>
            <Button size="sm" variant="outline" onClick={() => void fetchOrders()} className="border-[#1a2830] bg-[#091416]">
              Retry
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-[#64748b]">
            {isPaperTrading
              ? "No working paper orders. Place a Limit or Stop order to test execution and auto-fills."
              : "No active open orders."}
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="border-b border-[#1a2830] hover:bg-transparent font-mono">
                <TableHead className="text-[10px] uppercase text-[#64748b]">Market</TableHead>
                <TableHead className="text-[10px] uppercase text-[#64748b]">Side</TableHead>
                <TableHead className="text-[10px] uppercase text-[#64748b]">Type</TableHead>
                <TableHead className="text-[10px] uppercase text-[#64748b]">Price</TableHead>
                <TableHead className="text-[10px] uppercase text-[#64748b]">Size</TableHead>
                <TableHead className="text-[10px] uppercase text-[#64748b]">Status</TableHead>
                <TableHead className="text-[10px] uppercase text-[#64748b]">Progress</TableHead>
                <TableHead className="text-[10px] uppercase text-[#64748b]">Source</TableHead>
                <TableHead className="text-right text-[10px] uppercase text-[#64748b]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="border-b border-[#142228] hover:bg-[#112025]/50 font-mono">
                  <TableCell className="font-semibold text-white">{order.market}</TableCell>
                  <TableCell
                    className={cn(
                      "uppercase font-medium",
                      order.side === "buy" ? "text-[#00d084]" : "text-[#ff4757]"
                    )}
                  >
                    {order.side}
                  </TableCell>
                  <TableCell className="uppercase text-[#8ea4a9]">{order.type}</TableCell>
                  <TableCell className="text-[#c8d4d7]">{formatNumber(order.price, order.price >= 1000 ? 2 : 4)}</TableCell>
                  <TableCell className="text-white">{formatNumber(order.size, 4)}</TableCell>
                  <TableCell className={cn("uppercase", statusClass(order.status))}>
                    {order.status.replace("_", " ")}
                    {order.rejectReason && (
                      <div className="mt-1 max-w-[180px] normal-case text-rose-400">
                        {order.rejectReason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-[#8ea4a9]">
                    {formatNumber(order.filledSize, 4)} / {formatNumber(order.size, 4)}
                  </TableCell>
                  <TableCell className="text-[#64748b]">
                    {isPaperTrading ? "Paper Sim" : order.source === "optimistic" ? "Local" : "Exchange"}
                  </TableCell>
                  <TableCell className="text-right">
                    {(order.status === "open" || order.status === "pending") && (
                      <button
                        onClick={() => {
                          if (isPaperTrading) {
                            cancelPaperOrder(order.id);
                            toast.info(`Cancelled paper order ${order.id}`);
                          } else {
                            markOrderCancelled(order.id);
                            toast.info(`Cancelled order ${order.id}`);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/20"
                      >
                        <X className="h-2.5 w-2.5" />
                        Cancel
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function LifecycleCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded border border-[#1a2830] bg-[#0c181b] p-2.5">
      <div className="text-[10px] uppercase font-mono tracking-wider text-[#64748b]">{label}</div>
      <div className="mt-0.5 font-mono text-base font-bold text-white">{value}</div>
      <div className="mt-0.5 text-[10px] text-[#64748b]">{helper}</div>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "open" || status === "filled") return "text-[#00d084]";
  if (status === "pending" || status === "partially_filled" || status === "cancel_pending") {
    return "text-amber-400";
  }
  return "text-[#ff4757]";
}
