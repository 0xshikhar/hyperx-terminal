import { useEffect, useRef, useState } from "react";
import { useMarketStore } from "@/store/marketStore";
import { cn } from "@/lib/utils";
import { placeOrder } from "@/services/apiClient/orders.api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTradeForm } from "@/hooks/useTradeForm";
import { addTerminalActionListener } from "@/lib/terminalActions";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useOrdersStore } from "@/store/ordersStore";

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
  const createOptimisticOrder = useOrdersStore((state) => state.createOptimisticOrder);
  const acknowledgeOrder = useOrdersStore((state) => state.acknowledgeOrder);
  const rejectOrder = useOrdersStore((state) => state.rejectOrder);
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop">("market");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [leverage, setLeverage] = useState(10);
  const [executionPreset, setExecutionPreset] = useState<"cross" | "scaled" | "classic">("cross");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [bracketEnabled, setBracketEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const sizeInputRef = useRef<HTMLInputElement | null>(null);
  const priceInputRef = useRef<HTMLInputElement | null>(null);
  const stopPriceInputRef = useRef<HTMLInputElement | null>(null);

  const resetForm = () => {
    setSize("");
    setPrice("");
    setStopPrice("");
    setTakeProfit("");
    setStopLoss("");
    setLeverage(10);
    setOrderType("market");
  };

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
    if (isSubmitting || !isValid) return;
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
    const optimisticOrderId = createOptimisticOrder(order, market?.lastPrice);
    try {
      if (onSubmit) {
        await onSubmit(order);
        acknowledgeOrder(optimisticOrderId, optimisticOrderId);
        toast.success("Order submitted");
      } else {
        const placed = await placeOrder(order);
        acknowledgeOrder(optimisticOrderId, placed.id);
        toast.success(`Order submitted (${placed.id})`);
      }
      resetForm();
    } catch {
      rejectOrder(optimisticOrderId, "Submission failed");
      toast.error("Order submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    setConfirmOpen(false);
  }, [activeMarket]);

  useEffect(() => {
    return addTerminalActionListener((action) => {
      if (action.type === "focus-trade-form" || action.type === "focus-size-input") {
        sizeInputRef.current?.focus();
        return;
      }

      if (action.type === "set-order-side") {
        setSide(action.side);
        sizeInputRef.current?.focus();
        return;
      }

      if (action.type === "set-order-type") {
        setOrderType(action.orderType);
        const targetRef = action.orderType === "limit" ? priceInputRef : action.orderType === "stop" ? stopPriceInputRef : sizeInputRef;
        targetRef.current?.focus();
        return;
      }

      if (action.type === "prepare-order") {
        setSide(action.side);
        setOrderType(action.orderType);
        const targetRef =
          action.focusField === "price"
            ? priceInputRef
            : action.focusField === "stop"
              ? stopPriceInputRef
              : sizeInputRef;
        window.setTimeout(() => targetRef.current?.focus(), 0);
      }
    });
  }, []);

  useEffect(() => {
    const shortcuts = [
      {
        key: "b",
        description: "Prepare buy order",
        action: () => {
          setSide("buy");
          sizeInputRef.current?.focus();
        },
      },
      {
        key: "s",
        description: "Prepare sell order",
        action: () => {
          setSide("sell");
          sizeInputRef.current?.focus();
        },
      },
      {
        key: "m",
        description: "Switch to market order",
        action: () => {
          setOrderType("market");
          sizeInputRef.current?.focus();
        },
      },
      {
        key: "l",
        description: "Switch to limit order",
        action: () => {
          setOrderType("limit");
          window.setTimeout(() => priceInputRef.current?.focus(), 0);
        },
      },
    ] as const;

    shortcuts.forEach((shortcut) =>
      registerShortcut({
        key: shortcut.key,
        description: shortcut.description,
        action: shortcut.action,
        scope: "terminal",
      })
    );

    return () => {
      shortcuts.forEach((shortcut) => unregisterShortcut(shortcut.key));
    };
  }, [registerShortcut, unregisterShortcut]);

  return (
    <div id="terminal-trade-form" className="flex h-full flex-col bg-[#0d0d0f]">
      <div className="grid grid-cols-3 gap-2 border-b border-[#1a2a2f] px-3 py-3">
        {(
          [
            { value: "cross", label: "Cross" },
            { value: "scaled", label: `${leverage}x` },
            { value: "classic", label: "Classic" },
          ] as const
        ).map((preset) => (
          <button
            key={preset.value}
            onClick={() => setExecutionPreset(preset.value)}
            className={cn(
              "rounded-md px-3 py-2 text-xs font-medium transition-colors",
              executionPreset === preset.value
                ? "bg-[#273136] text-white"
                : "bg-[#141d20] text-[#7f8c90] hover:bg-[#182327] hover:text-[#d4dbdd]"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 border-b border-[#1a2a2f]">
        {(["market", "limit", "stop"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setOrderType(value)}
            className={cn(
              "px-3 py-3 text-xs font-medium uppercase transition-colors",
              orderType === value
                ? "border-b border-[#53d8c8] bg-[#111a1d] text-white"
                : "text-[#6b6b74] hover:bg-[#151519] hover:text-[#a0a0a8]"
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 border-b border-[#1a2a2f]">
        <button
          onClick={() => setSide("buy")}
          className={cn(
            "px-3 py-2.5 text-sm font-medium transition-colors",
            side === "buy" ? "bg-[#53d8c8] text-[#041013]" : "text-[#d4dbdd] hover:bg-[#121b1e]"
          )}
        >
          Buy / Long
        </button>
        <button
          onClick={() => setSide("sell")}
          className={cn(
            "px-3 py-2.5 text-sm font-medium transition-colors",
            side === "sell" ? "bg-[#f16d75] text-white" : "text-[#d4dbdd] hover:bg-[#121b1e]"
          )}
        >
          Sell / Short
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="space-y-2 border-b border-[#1a2a2f] pb-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#6b6b74]">Available to Trade</span>
            <span className="font-mono text-white">0.00 USDC</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#6b6b74]">Current Position</span>
            <span className="font-mono text-white">0.00 {activeMarket.split("-")[0]}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[#6b6b74]">Size</label>
            <span className="text-xs text-[#6b6b74]">{activeMarket.split("-")[0]}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={sizeInputRef}
              type="number"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="0.00"
              className="flex-1 rounded bg-[#1a1a1e] px-3 py-2 text-sm text-white placeholder-[#4a4a52] outline-none ring-1 ring-[#2a2a2e] focus:ring-[#00d084]"
            />
            <button className="rounded bg-[#1a1a1e] px-3 py-2 text-xs text-[#6b6b74] hover:bg-[#252529]">
              Max
            </button>
          </div>
          {errors.size && (
            <p className="text-xs text-[#ff6b6b]">{errors.size}</p>
          )}
        </div>

        {orderType === "limit" && (
          <div className="space-y-1.5">
            <label className="text-xs text-[#6b6b74]">Limit Price</label>
            <input
              ref={priceInputRef}
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded bg-[#1a1a1e] px-3 py-2 text-sm text-white placeholder-[#4a4a52] outline-none ring-1 ring-[#2a2a2e] focus:ring-[#00d084]"
            />
            {errors.price && (
              <p className="text-xs text-[#ff6b6b]">{errors.price}</p>
            )}
          </div>
        )}

        {orderType === "stop" && (
          <div className="space-y-1.5">
            <label className="text-xs text-[#6b6b74]">Stop Price</label>
            <input
              ref={stopPriceInputRef}
              type="number"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded bg-[#1a1a1e] px-3 py-2 text-sm text-white placeholder-[#4a4a52] outline-none ring-1 ring-[#2a2a2e] focus:ring-[#00d084]"
            />
            {errors.stopPrice && (
              <p className="text-xs text-[#ff6b6b]">{errors.stopPrice}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <ToggleField
            label="Reduce Only"
            checked={reduceOnly}
            onToggle={() => setReduceOnly((value) => !value)}
          />
          <ToggleField
            label="TP / SL"
            checked={bracketEnabled}
            onToggle={() => setBracketEnabled((value) => !value)}
          />
        </div>

        <div className="space-y-1.5 rounded bg-[#1a1a1e] p-2.5">
          <InfoRow label="Est. Entry Price" value={market?.lastPrice ? `$${market.lastPrice.toFixed(2)}` : "--"} />
          <InfoRow 
            label="Liq. Price" 
            value={liquidationEstimate ? `$${liquidationEstimate.toFixed(2)}` : "--"} 
          />
          <InfoRow 
            label="Margin Used" 
            value={margin ? `$${margin.toFixed(2)}` : "--"}
          />
          <InfoRow 
            label="Notional" 
            value={notional ? `$${notional.toFixed(2)}` : "--"}
          />
          <InfoRow 
            label="Slippage" 
            value="0.00%"
            suffix="Est: 0% / Max: 0.05%"
          />
          <InfoRow 
            label="Fee" 
            value="0.035%"
            suffix="$0.00"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[#6b6b74]">Leverage</label>
            <span className="font-mono text-xs text-white">{leverage}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full accent-[#00d084]"
          />
          <div className="flex items-center justify-between text-[10px] text-[#6b6b74]">
            <span>1x</span>
            <span>25x</span>
            <span>50x</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={() => {
              setSide("buy");
              setConfirmOpen(true);
            }}
            disabled={isSubmitting || !isValid}
            className="rounded bg-[#00d084] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#00e090] disabled:opacity-50"
          >
            Buy / Long
          </button>
          <button
            onClick={() => {
              setSide("sell");
              setConfirmOpen(true);
            }}
            disabled={isSubmitting || !isValid}
            className="rounded bg-[#ff4757] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff5e6c] disabled:opacity-50"
          >
            Sell / Short
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-[#2a2a2e] bg-[#0d0d0f]">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#6b6b74]">Market</span>
              <span className="font-semibold text-white">{activeMarket}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6b6b74]">Side</span>
              <span className={side === "buy" ? "text-[#00d084]" : "text-[#ff4757]"}>
                {side === "buy" ? "Buy / Long" : "Sell / Short"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6b6b74]">Type</span>
              <span className="font-semibold text-white uppercase">{orderType}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6b6b74]">Size</span>
              <span className="font-mono text-white">{size} {activeMarket}</span>
            </div>
            {orderType !== "market" && (
              <div className="flex items-center justify-between">
                <span className="text-[#6b6b74]">
                  {orderType === "limit" ? "Limit Price" : "Stop Price"}
                </span>
                <span className="font-mono text-white">
                  ${orderType === "limit" ? price : stopPrice}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[#6b6b74]">Leverage</span>
              <span className="font-semibold text-white">{leverage}x</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6b6b74]">Margin</span>
              <span className="font-mono text-white">
                {margin ? `$${margin.toFixed(2)}` : "--"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => setConfirmOpen(false)}
              className="border-[#2a2a2e] bg-transparent text-white hover:bg-[#1a1a1e]"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setConfirmOpen(false);
                await submit();
              }}
              disabled={isSubmitting || !isValid}
              className={cn(
                "font-semibold",
                side === "buy" 
                  ? "bg-[#00d084] text-black hover:bg-[#00e090]" 
                  : "bg-[#ff4757] text-white hover:bg-[#ff5e6c]"
              )}
            >
              {isSubmitting ? "Submitting..." : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ 
  label, 
  value, 
  suffix 
}: { 
  label: string; 
  value: string; 
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#6b6b74]">{label}</span>
      <div className="flex items-center gap-1">
        <span className="font-mono text-white">{value}</span>
        {suffix && <span className="text-[#4a4a52]">{suffix}</span>}
      </div>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors",
        checked
          ? "border-[#53d8c8] bg-[#102125] text-white"
          : "border-[#253237] bg-[#11181b] text-[#7f8c90] hover:border-[#304046] hover:text-[#d4dbdd]"
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "h-3.5 w-3.5 rounded-sm border",
          checked ? "border-[#53d8c8] bg-[#53d8c8]" : "border-[#435459]"
        )}
      />
    </button>
  );
}
