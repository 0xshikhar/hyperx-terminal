import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useOrdersStore } from "@/store/ordersStore";
import { Button } from "@/components/ui/button";
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
  const orders = useOrdersStore((state) => state.openOrders);
  const fetchOrders = useOrdersStore((state) => state.fetchOrders);
  const isLoading = useOrdersStore((state) => state.isLoading);
  const error = useOrdersStore((state) => state.error);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const counts = orders.reduce(
    (acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <LifecycleCard label="Pending" value={counts.pending ?? 0} helper="Optimistic submits awaiting acknowledgement" />
        <LifecycleCard label="Working" value={(counts.open ?? 0) + (counts.partially_filled ?? 0)} helper="Live orders still impacting execution state" />
        <LifecycleCard label="Terminal" value={(counts.filled ?? 0) + (counts.cancelled ?? 0)} helper="Recently completed or cancelled orders retained for context" />
        <LifecycleCard label="Rejected" value={counts.rejected ?? 0} helper="Submission failures and invalid transitions" />
      </div>

      <div className="rounded-md border border-border bg-background">
      {isLoading ? (
        <div className="px-3 py-8 text-xs text-muted-foreground">Loading open orders…</div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 px-3 py-6 text-xs">
          <div className="text-muted-foreground">
            Failed to refresh open orders from the API. Showing the last local snapshot instead.
          </div>
          <Button size="sm" variant="outline" onClick={() => void fetchOrders()}>
            Retry
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="px-3 py-8 text-xs text-muted-foreground">
          No active or recent orders. Submitted orders will stay visible here long enough to explain pending, partial, rejection, and cancellation paths.
        </div>
      ) : (
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-semibold">{order.market}</TableCell>
                <TableCell
                  className={cn(
                    "uppercase",
                    order.side === "buy" ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {order.side}
                </TableCell>
                <TableCell className="uppercase">{order.type}</TableCell>
                <TableCell>{formatNumber(order.price, order.price >= 1000 ? 2 : 4)}</TableCell>
                <TableCell>{formatNumber(order.size, 4)}</TableCell>
                <TableCell className={cn("uppercase", statusClass(order.status))}>
                  {order.status.replace("_", " ")}
                  {order.rejectReason && (
                    <div className="mt-1 max-w-[180px] normal-case text-rose-400">
                      {order.rejectReason}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {formatNumber(order.filledSize, 4)} / {formatNumber(order.size, 4)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {order.source === "optimistic" ? "Local" : "Exchange"}
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
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "open" || status === "filled") return "text-emerald-400";
  if (status === "pending" || status === "partially_filled" || status === "cancel_pending") {
    return "text-amber-400";
  }
  return "text-rose-400";
}
