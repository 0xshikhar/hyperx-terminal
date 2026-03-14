/**
 * Batch Operations Component
 * 
 * Mass actions on multiple positions simultaneously.
 * See docs/phase3/index.md for implementation details.
 */

import { useState, useCallback } from "react";
import { CheckSquare, Square, X, Calculator } from "lucide-react";

interface Position {
  id: string;
  market: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
}

interface BatchOperationsProps {
  positions: Position[];
  onCloseSelected: (ids: string[]) => void;
  onSetStopLoss: (ids: string[], price: number) => void;
  onTakeProfit: (ids: string[], price: number) => void;
}

export function BatchOperations({ 
  positions, 
  onCloseSelected, 
  onSetStopLoss,
  onTakeProfit,
}: BatchOperationsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<"close" | "sl" | "tp" | null>(null);
  const [price, setPrice] = useState("");
  const [percent, setPercent] = useState(50);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    setSelectedIds(new Set(positions.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setAction(null);
  };

  const selectedPositions = positions.filter(p => selectedIds.has(p.id));
  const totalNotional = selectedPositions.reduce(
    (sum, p) => sum + Math.abs(p.size * p.markPrice), 
    0
  );
  const totalPnL = selectedPositions.reduce((sum, p) => sum + p.pnl, 0);

  const executeAction = () => {
    const ids = Array.from(selectedIds);
    
    switch (action) {
      case "close":
        onCloseSelected(ids);
        break;
      case "sl":
        onSetStopLoss(ids, Number(price));
        break;
      case "tp":
        onTakeProfit(ids, Number(price));
        break;
    }
    
    clearSelection();
  };

  const calculatePercentPrice = useCallback((pct: number, isSL: boolean) => {
    // Calculate aggregate entry and current prices
    const totalSize = selectedPositions.reduce((s, p) => s + p.size, 0);
    const avgEntry = selectedPositions.reduce(
      (s, p) => s + p.entryPrice * p.size, 
      0
    ) / totalSize;
    
    // For longs: SL is below entry, TP is above
    // For shorts: SL is above entry, TP is below
    const isLong = selectedPositions[0]?.side === "long";
    
    if (isSL) {
      return isLong 
        ? avgEntry * (1 - pct / 100)
        : avgEntry * (1 + pct / 100);
    } else {
      return isLong
        ? avgEntry * (1 + pct / 100)
        : avgEntry * (1 - pct / 100);
    }
  }, [selectedPositions]);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CheckSquare className="w-4 h-4" />
          Batch Operations
          {selectedIds.size > 0 && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              {selectedIds.size}
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="text-xs text-primary hover:underline"
          >
            Select All
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={clearSelection}
              className="text-xs text-destructive hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Position List */}
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {positions.map(pos => (
          <div
            key={pos.id}
            onClick={() => toggleSelection(pos.id)}
            className={`
              flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors
              ${selectedIds.has(pos.id) ? "bg-primary/10" : "hover:bg-muted"}
            `}
          >
            {selectedIds.has(pos.id) ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4 text-muted-foreground" />
            )}
            <div className="flex-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{pos.market}</span>
                <span className={pos.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {pos.side} {pos.size} @ ${pos.entryPrice.toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selection Summary */}
      {selectedIds.size > 0 && (
        <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Positions</span>
            <span>{selectedIds.size}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Notional</span>
            <span>${totalNotional.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Combined PnL</span>
            <span className={totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}>
              {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      {selectedIds.size > 0 && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {[
              { id: "close", label: "Close All", color: "destructive" },
              { id: "sl", label: "Set SL", color: "default" },
              { id: "tp", label: "Set TP", color: "default" },
            ].map(a => (
              <button
                key={a.id}
                onClick={() => setAction(a.id as typeof action)}
                className={`
                  flex-1 py-2 rounded-lg text-xs font-medium transition-colors
                  ${action === a.id 
                    ? a.color === "destructive" 
                      ? "bg-red-500 text-white"
                      : "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }
                `}
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* Action Configuration */}
          {(action === "sl" || action === "tp") && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-muted-foreground" />
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={percent}
                  onChange={(e) => {
                    setPercent(Number(e.target.value));
                    setPrice(calculatePercentPrice(Number(e.target.value), action === "sl").toFixed(2));
                  }}
                  className="flex-1"
                />
                <span className="text-xs w-12 text-right">{percent}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-12">
                  {action === "sl" ? "SL" : "TP"} Price
                </span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="flex-1 bg-muted rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
          )}

          {/* Execute */}
          <button
            onClick={executeAction}
            className={`
              w-full py-3 rounded-lg font-semibold transition-colors
              ${action === "close"
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
              }
            `}
          >
            {action === "close" && `Close ${selectedIds.size} Positions`}
            {action === "sl" && `Set Stop Loss @ $${price || "-"}`}
            {action === "tp" && `Set Take Profit @ $${price || "-"}`}
          </button>
        </div>
      )}
    </div>
  );
}

export type { Position };
