import { useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import { cn } from "@/lib/utils";
import { placeOrder } from "@/services/apiClient/orders.api";
import { toast } from "sonner";

export type TradeOrder = {
  market: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  size: string;
  price?: string;
};

type TradeFormProps = {
  onSubmit?: (order: TradeOrder) => Promise<void> | void;
};

export function TradeForm({ onSubmit }: TradeFormProps) {
  const { activeMarket } = useMarketStore();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (isSubmitting) return;
    const order: TradeOrder = {
      market: activeMarket,
      side,
      type: orderType,
      size,
      price: orderType === "limit" ? price : undefined,
    };
    setIsSubmitting(true);
    try {
      await onSubmit?.(order);
      const placed = await placeOrder(order);
      toast.success(`Order submitted (${placed.id})`);
    } catch {
      toast.error("Order submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Trade</h3>
        <span className="text-xs text-muted-foreground">{activeMarket}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {(["buy", "sell"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setSide(value)}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-semibold",
              side === value
                ? value === "buy"
                  ? "border-emerald-500 text-emerald-500"
                  : "border-rose-500 text-rose-500"
                : "border-border text-muted-foreground"
            )}
          >
            {value === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        {(["market", "limit"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setOrderType(value)}
            className={cn(
              "flex-1 rounded-md border px-3 py-2 text-xs uppercase",
              orderType === value
                ? "border-primary text-primary"
                : "border-border text-muted-foreground"
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {orderType === "limit" && (
          <div>
            <label className="text-xs text-muted-foreground">Limit Price</label>
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Size</label>
          <input
            value={size}
            onChange={(event) => setSize(event.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        onClick={submit}
        disabled={isSubmitting || !size || (orderType === "limit" && !price)}
        className={cn(
          "mt-5 w-full rounded-md px-3 py-2 text-sm font-semibold",
          side === "buy"
            ? "bg-emerald-500 text-black"
            : "bg-rose-500 text-white"
        )}
      >
        {isSubmitting
          ? "Submitting..."
          : side === "buy"
            ? "Place Buy"
            : "Place Sell"}
      </button>
    </div>
  );
}
