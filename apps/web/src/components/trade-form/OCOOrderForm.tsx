/**
 * OCO Order Form Component (One-Cancels-Other)
 * 
 * Two orders where filling one cancels the other.
 * See docs/phase3/index.md for implementation details.
 */

import { useState, useCallback } from "react";
import { GitCompare, AlertCircle } from "lucide-react";

interface OCOOrderFormProps {
  currentPrice: number;
  onSubmit: (oco: OCOOrder) => void;
}

export interface OCOOrder {
  primary: {
    side: "buy" | "sell";
    price: number;
    size: number;
    type: "limit" | "stop";
  };
  secondary: {
    side: "buy" | "sell";
    price: number;
    size: number;
    type: "limit" | "stop";
  };
}

type OCOStrategy = "breakout" | "range" | "custom";

export function OCOOrderForm({ currentPrice, onSubmit }: OCOOrderFormProps) {
  const [strategy, setStrategy] = useState<OCOStrategy>("breakout");
  const [size, setSize] = useState(0.1);
  const [range, setRange] = useState(2); // Percentage

  const calculateOCO = useCallback((): OCOOrder => {
    const rangeMultiplier = range / 100;

    switch (strategy) {
      case "breakout":
        // Buy above resistance, sell below support
        return {
          primary: {
            side: "buy",
            price: currentPrice * (1 + rangeMultiplier),
            size,
            type: "stop",
          },
          secondary: {
            side: "sell",
            price: currentPrice * (1 - rangeMultiplier),
            size,
            type: "stop",
          },
        };

      case "range":
        // Sell at resistance, buy at support
        return {
          primary: {
            side: "sell",
            price: currentPrice * (1 + rangeMultiplier),
            size,
            type: "limit",
          },
          secondary: {
            side: "buy",
            price: currentPrice * (1 - rangeMultiplier),
            size,
            type: "limit",
          },
        };

      case "custom":
      default:
        return {
          primary: {
            side: "buy",
            price: currentPrice * (1 + rangeMultiplier),
            size,
            type: "limit",
          },
          secondary: {
            side: "sell",
            price: currentPrice * (1 - rangeMultiplier),
            size,
            type: "limit",
          },
        };
    }
  }, [strategy, size, range, currentPrice]);

  const handleSubmit = () => {
    const oco = calculateOCO();
    onSubmit(oco);
  };

  const oco = calculateOCO();

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <GitCompare className="w-4 h-4" />
          OCO Order
        </h3>
        <span className="text-xs text-muted-foreground">One-Cancels-Other</span>
      </div>

      {/* Strategy Selection */}
      <div className="flex gap-2">
        {[
          { id: "breakout", label: "Breakout", desc: "Buy high / Sell low" },
          { id: "range", label: "Range", desc: "Sell high / Buy low" },
          { id: "custom", label: "Custom", desc: "Manual setup" },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setStrategy(s.id as OCOStrategy)}
            className={`
              flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors text-left
              ${strategy === s.id 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted text-muted-foreground"
              }
            `}
          >
            <div>{s.label}</div>
            <div className="text-[10px] opacity-70">{s.desc}</div>
          </button>
        ))}
      </div>

      {/* Size */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Size (each order)
        </label>
        <input
          type="number"
          value={size.toFixed(4)}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-full bg-muted rounded-lg px-3 py-2 text-sm"
          min={0.01}
          step={0.01}
        />
      </div>

      {/* Range */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Range ±{range}% from ${currentPrice.toFixed(2)}
        </label>
        <input
          type="range"
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
          min={0.5}
          max={10}
          step={0.5}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0.5%</span>
          <span className="font-medium text-primary">{range}%</span>
          <span>10%</span>
        </div>
      </div>

      {/* Order Preview */}
      <div className="bg-muted rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Order Preview
        </div>
        
        {/* Primary */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={`
              w-2 h-2 rounded-full
              ${oco.primary.side === "buy" ? "bg-emerald-500" : "bg-red-500"}
            `} />
            <span className="capitalize">{oco.primary.side}</span>
            <span className="text-muted-foreground">{oco.primary.type}</span>
          </div>
          <div className="font-mono">
            ${oco.primary.price.toFixed(2)} × {oco.primary.size}
          </div>
        </div>

        <div className="flex justify-center">
          <GitCompare className="w-4 h-4 text-muted-foreground rotate-90" />
        </div>

        {/* Secondary */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={`
              w-2 h-2 rounded-full
              ${oco.secondary.side === "buy" ? "bg-emerald-500" : "bg-red-500"}
            `} />
            <span className="capitalize">{oco.secondary.side}</span>
            <span className="text-muted-foreground">{oco.secondary.type}</span>
          </div>
          <div className="font-mono">
            ${oco.secondary.price.toFixed(2)} × {oco.secondary.size}
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg p-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          When one order fills, the other is automatically cancelled. 
          Only one position will be opened.
        </p>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="w-full py-3 rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Place OCO Order
      </button>
    </div>
  );
}
