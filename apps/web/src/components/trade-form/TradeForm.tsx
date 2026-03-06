import { useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import { cn } from "@/lib/utils";
import { placeOrder } from "@/services/apiClient/orders.api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTradeForm } from "@/hooks/useTradeForm";

export type TradeOrder = {
  market: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop";
  size: string;
  price?: string;
  stopPrice?: string;
  takeProfit?: string;
  stopLoss?: string;
  leverage?: number;
};

type TradeFormProps = {
  onSubmit?: (order: TradeOrder) => Promise<void> | void;
};

export function TradeForm({ onSubmit }: TradeFormProps) {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const market = useMarketStore((s) => s.markets.find((item) => item.symbol === s.activeMarket));
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop">("market");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [leverage, setLeverage] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const {
    errors,
    isValid,
    notional,
    margin,
    liquidationEstimate,
  } = useTradeForm({
    market: activeMarket,
    side,
    type: orderType,
    size,
    price,
    stopPrice,
    takeProfit,
    stopLoss,
    leverage,
    lastPrice: market?.lastPrice,
  });

  const submit = async () => {
    if (isSubmitting) return;
    const order: TradeOrder = {
      market: activeMarket,
      side,
      type: orderType,
      size,
      price: orderType === "limit" ? price : undefined,
      stopPrice: orderType === "stop" ? stopPrice : undefined,
      takeProfit: takeProfit || undefined,
      stopLoss: stopLoss || undefined,
      leverage,
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
        {(["market", "limit", "stop"] as const).map((value) => (
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
            {errors.price && (
              <p className="mt-1 text-xs text-rose-500">{errors.price}</p>
            )}
          </div>
        )}
        {orderType === "stop" && (
          <div>
            <label className="text-xs text-muted-foreground">Stop Price</label>
            <input
              value={stopPrice}
              onChange={(event) => setStopPrice(event.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.stopPrice && (
              <p className="mt-1 text-xs text-rose-500">{errors.stopPrice}</p>
            )}
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
          {errors.size && (
            <p className="mt-1 text-xs text-rose-500">{errors.size}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Take Profit</label>
            <input
              value={takeProfit}
              onChange={(event) => setTakeProfit(event.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.takeProfit && (
              <p className="mt-1 text-xs text-rose-500">
                {errors.takeProfit}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Stop Loss</label>
            <input
              value={stopLoss}
              onChange={(event) => setStopLoss(event.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.stopLoss && (
              <p className="mt-1 text-xs text-rose-500">{errors.stopLoss}</p>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Leverage</label>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={50}
              value={leverage}
              onChange={(event) => setLeverage(Number(event.target.value))}
              className="w-full"
            />
            <input
              type="number"
              min={1}
              max={50}
              value={leverage}
              onChange={(event) => setLeverage(Number(event.target.value))}
              className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
          </div>
          {errors.leverage && (
            <p className="mt-1 text-xs text-rose-500">{errors.leverage}</p>
          )}
        </div>
        <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Notional</span>
            <span className="font-mono text-foreground">
              {notional ? `$${notional.toFixed(2)}` : "--"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Margin</span>
            <span className="font-mono text-foreground">
              {margin ? `$${margin.toFixed(2)}` : "--"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Est. Liq</span>
            <span className="font-mono text-foreground">
              {liquidationEstimate ? liquidationEstimate.toFixed(2) : "--"}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => setConfirmOpen(true)}
        disabled={isSubmitting || !isValid}
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
            ? "Review Buy"
            : "Review Sell"}
      </button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Market</span>
              <span className="font-semibold">{activeMarket}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Side</span>
              <span className={side === "buy" ? "text-emerald-500" : "text-rose-500"}>
                {side.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-semibold">{orderType.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Size</span>
              <span className="font-mono">{size}</span>
            </div>
            {orderType !== "market" && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {orderType === "limit" ? "Limit Price" : "Stop Price"}
                </span>
                <span className="font-mono">{orderType === "limit" ? price : stopPrice}</span>
              </div>
            )}
            {takeProfit && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Take Profit</span>
                <span className="font-mono">{takeProfit}</span>
              </div>
            )}
            {stopLoss && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stop Loss</span>
                <span className="font-mono">{stopLoss}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Leverage</span>
              <span className="font-semibold">{leverage}x</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Margin</span>
              <span className="font-mono">
                {margin ? `$${margin.toFixed(2)}` : "--"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setConfirmOpen(false);
                await submit();
              }}
              disabled={isSubmitting}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
