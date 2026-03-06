import { cn } from "@/lib/utils";
import { useOrdersStore } from "@/store/ordersStore";
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
  return (
    <div className="rounded-md border border-border bg-background">
      {orders.length === 0 ? (
        <div className="px-3 py-8 text-xs text-muted-foreground">No open orders.</div>
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
                <TableCell className="uppercase text-muted-foreground">{order.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
