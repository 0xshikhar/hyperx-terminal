/**
 * Bracket Order Form Component
 * 
 * Entry order with automatic TP/SL orders.
 * See docs/phase3/index.md for implementation details.
 */

import { useState, useCallback } from "react";
import { Target, Shield, Calculator } from "lucide-react";

interface BracketOrderFormProps {
  currentPrice: number;
  onSubmit: (bracket: BracketOrder) => void;
}

export interface BracketOrder {
  entryPrice: number;
  entrySize: number;
  side: "buy" | "sell";
  takeProfit: {
    price: number;
    size: number;
  };
  stopLoss: {
    price: number;
    size: number;
  };
}

export function BracketOrderForm({ currentPrice, onSubmit }: BracketOrderFormProps) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [entrySize, setEntrySize] = useState(0.1);
  const [tpPercent, setTpPercent] = useState(5);
  const [slPercent, setSlPercent] = useState(2);
  const [entryPrice, setEntryPrice] = useState(currentPrice);

  const calculateBracket = useCallback((): BracketOrder => {
    const tpMultiplier = side === "buy" ? 1 + tpPercent / 100 : 1 - tpPercent / 100;
    const slMultiplier = side === "buy" ? 1 - slPercent / 100 : 1 + slPercent / 100;

    return {
      entryPrice,
      entrySize,
      side,
      takeProfit: {
        price: entryPrice * tpMultiplier,
        size: entrySize,
      },
      stopLoss: {
        price: entryPrice * slMultiplier,
        size: entrySize,
      },
    };
  }, [entryPrice, entrySize, side, tpPercent, slPercent]);

  const handleSubmit = () => {
    const bracket = calculateBracket();
    onSubmit(bracket);
  };

  const bracket = calculateBracket();
  const riskReward = tpPercent / slPercent;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Target className="w-4 h-4" />
          Bracket Order
        </h3>
        <span className="text-xs text-muted-foreground">
          R:R = 1:{riskReward.toFixed(1)}
        </span>
      </div>

      {/* Side Selection */}
      <div className="flex gap-2">
        {["buy", "sell"].map((s) => (
          <button
            key={s}
            onClick={() => setSide(s as "buy" | "sell")}
            className={`
              flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors
              ${side === s 
                ? s === "buy" 
                  ? "bg-emerald-500 text-white" 
                  : "bg-red-500 text-white"
                : "bg-muted text-muted-foreground"
              }
            `}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Entry Price */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Entry Price
        </label>
        <input
          type="number"
          value={entryPrice.toFixed(2)}
          onChange={(e) => setEntryPrice(Number(e.target.value))}
          className="w-full bg-muted rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={() => setEntryPrice(currentPrice)}
          className="text-xs text-primary mt-1 hover:underline"
        >
          Reset to market
        </button>
      </div>

      {/* Size */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Size
        </label>
        <input
          type="number"
          value={entrySize.toFixed(4)}
          onChange={(e) => setEntrySize(Number(e.target.value))}
          className="w-full bg-muted rounded-lg px-3 py-2 text-sm"
          min={0.01}
          step={0.01}
        />
      </div>

      {/* TP/SL Percentages */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Target className="w-3 h-3" />
            TP %
          </label>
          <input
            type="number"
            value={tpPercent}
            onChange={(e) => setTpPercent(Number(e.target.value))}
            className="w-full bg-muted rounded-lg px-3 py-2 text-sm"
            min={0.1}
            step={0.5}
          />
          <span className="text-xs text-emerald-400">
            @{bracket.takeProfit.price.toFixed(2)}
          </span>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            SL %
          </label>
          <input
            type="number"
            value={slPercent}
            onChange={(e) => setSlPercent(Number(e.target.value))}
            className="w-full bg-muted rounded-lg px-3 py-2 text-sm"
            min={0.1}
            step={0.5}
          />
          <span className="text-xs text-red-400">
            @{bracket.stopLoss.price.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-muted rounded-lg p-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Entry</span>
          <span>${entryPrice.toFixed(2)} × {entrySize}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Take Profit</span>
          <span className="text-emerald-400">
            ${bracket.takeProfit.price.toFixed(2)} (+${(entrySize * (bracket.takeProfit.price - entryPrice)).toFixed(2)})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Stop Loss</span>
          <span className="text-red-400">
            ${bracket.stopLoss.price.toFixed(2)} (-${(entrySize * Math.abs(bracket.stopLoss.price - entryPrice)).toFixed(2)})
          </span>
        </div>
        <div className="border-t border-border pt-1 mt-1 flex justify-between">
          <span className="text-muted-foreground">Max PnL</span>
          <span className="text-emerald-400">
            +${(entrySize * Math.abs(bracket.takeProfit.price - entryPrice)).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Max Loss</span>
          <span className="text-red-400">
            -${(entrySize * Math.abs(bracket.stopLoss.price - entryPrice)).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className={`
          w-full py-3 rounded-lg font-semibold transition-colors
          ${side === "buy" 
            ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
            : "bg-red-500 hover:bg-red-600 text-white"
          }
        `}
      >
        Place Bracket {side === "buy" ? "Long" : "Short"}
      </button>
    </div>
  );
}

export type { BracketOrder };
