/**
 * Mobile Trading Interface Component
 * 
 * Touch-optimized order entry with swipe actions and collapsible panels.
 * See docs/phase2/index.md for implementation details.
 */

import { useState, useCallback } from "react";
import { ArrowUp, ArrowDown, ChevronUp, ChevronDown, Minus, Plus } from "lucide-react";

interface MobileTradeFormProps {
  market: string;
  currentPrice: number;
  onSubmitOrder: (order: {
    side: "buy" | "sell";
    size: number;
    price: number;
    type: "market" | "limit";
  }) => void;
}

export function MobileTradeForm({ market, currentPrice, onSubmitOrder }: MobileTradeFormProps) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [size, setSize] = useState(0.1);
  const [price, setPrice] = useState(currentPrice);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleSubmit = useCallback(() => {
    onSubmitOrder({
      side,
      size,
      price: orderType === "market" ? currentPrice : price,
      type: orderType,
    });
  }, [side, size, price, orderType, currentPrice, onSubmitOrder]);

  const adjustSize = (delta: number) => {
    setSize(prev => Math.max(0.01, Number((prev + delta).toFixed(4))));
  };

  if (!isExpanded) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 safe-area-pb">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold">{market}</span>
            <span className="text-sm text-muted-foreground">${currentPrice.toFixed(2)}</span>
          </div>
          <button 
            onClick={() => setIsExpanded(true)}
            className="p-2 hover:bg-muted rounded-full"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 safe-area-pb">
      {/* Collapse button */}
      <div className="flex justify-center mb-3">
        <button 
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-muted rounded-full"
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Market Info */}
      <div className="flex justify-between items-center mb-4">
        <span className="font-semibold">{market}</span>
        <span className="text-lg font-mono">${currentPrice.toFixed(2)}</span>
      </div>

      {/* Order Type Toggle */}
      <div className="flex gap-2 mb-4">
        {["market", "limit"].map((type) => (
          <button
            key={type}
            onClick={() => setOrderType(type as "market" | "limit")}
            className={`
              flex-1 py-2 rounded-lg text-sm font-medium transition-colors
              ${orderType === type 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted text-muted-foreground"
              }
            `}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Price Input (for limit orders) */}
      {orderType === "limit" && (
        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-1 block">Price</label>
          <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
            <button 
              onClick={() => setPrice(p => Number((p - 1).toFixed(2)))}
              className="p-1 hover:bg-background rounded"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              value={price.toFixed(2)}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="flex-1 bg-transparent text-center font-mono text-lg"
            />
            <button 
              onClick={() => setPrice(p => Number((p + 1).toFixed(2)))}
              className="p-1 hover:bg-background rounded"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Size Input with Quick Select */}
      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-1 block">Size</label>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-3 mb-2">
          <button 
            onClick={() => adjustSize(-0.1)}
            className="p-2 hover:bg-background rounded-full active:scale-95 transition-transform"
          >
            <Minus className="w-5 h-5" />
          </button>
          <input
            type="number"
            value={size.toFixed(4)}
            onChange={(e) => setSize(Number(e.target.value))}
            className="flex-1 bg-transparent text-center font-mono text-xl"
          />
          <button 
            onClick={() => adjustSize(0.1)}
            className="p-2 hover:bg-background rounded-full active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        
        {/* Quick size buttons */}
        <div className="flex gap-2">
          {[0.1, 0.5, 1, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`
                flex-1 py-2 rounded-md text-xs font-medium transition-colors
                ${size === s 
                  ? "bg-primary/20 text-primary border border-primary/30" 
                  : "bg-muted text-muted-foreground"
                }
              `}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Buy/Sell Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => { setSide("buy"); handleSubmit(); }}
          className="
            flex-1 py-4 rounded-xl bg-emerald-500 text-white font-semibold
            active:scale-[0.98] transition-transform
            flex items-center justify-center gap-2
          "
        >
          <ArrowUp className="w-5 h-5" />
          Buy {side === "buy" && size > 0 ? `$${(size * currentPrice).toFixed(0)}` : ""}
        </button>
        <button
          onClick={() => { setSide("sell"); handleSubmit(); }}
          className="
            flex-1 py-4 rounded-xl bg-red-500 text-white font-semibold
            active:scale-[0.98] transition-transform
            flex items-center justify-center gap-2
          "
        >
          <ArrowDown className="w-5 h-5" />
          Sell {side === "sell" && size > 0 ? `$${(size * currentPrice).toFixed(0)}` : ""}
        </button>
      </div>

      {/* Estimates */}
      <div className="mt-4 pt-3 border-t border-border flex justify-between text-xs text-muted-foreground">
        <span>Est. Fee: ${(size * currentPrice * 0.0005).toFixed(2)}</span>
        <span>Max: 50x</span>
      </div>
    </div>
  );
}

