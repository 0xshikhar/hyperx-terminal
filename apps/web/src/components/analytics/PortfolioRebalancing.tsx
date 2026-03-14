/**
 * Portfolio Rebalancing Component
 * 
 * Target allocation and drift analysis.
 * See docs/phase4/index.md for implementation details.
 */

import { useState, useMemo } from "react";
import { Scale, RefreshCw, ArrowRight } from "lucide-react";

interface Position {
  market: string;
  size: number;
  markPrice: number;
  side: "long" | "short";
}

interface TargetAllocation {
  market: string;
  targetPercent: number; // 0-100
}

interface PortfolioRebalancingProps {
  positions: Position[];
  targets: TargetAllocation[];
  onRebalance: (orders: RebalanceOrder[]) => void;
}

interface RebalanceOrder {
  market: string;
  action: "buy" | "sell";
  size: number;
  currentValue: number;
  targetValue: number;
}

export function PortfolioRebalancing({ 
  positions, 
  targets, 
  onRebalance 
}: PortfolioRebalancingProps) {
  const [driftThreshold, setDriftThreshold] = useState(5); // 5% drift triggers rebalance

  const analysis = useMemo(() => {
    const totalValue = positions.reduce(
      (sum, p) => sum + Math.abs(p.size * p.markPrice),
      0
    );

    const currentAllocations = positions.map(p => ({
      market: p.market,
      currentValue: Math.abs(p.size * p.markPrice),
      currentPercent: (Math.abs(p.size * p.markPrice) / totalValue) * 100,
      markPrice: p.markPrice,
      side: p.side,
    }));

    // Merge with targets
    const allMarkets = new Set([
      ...positions.map(p => p.market),
      ...targets.map(t => t.market),
    ]);

    const driftAnalysis: {
      market: string;
      currentPercent: number;
      targetPercent: number;
      drift: number; // + means overweight, - means underweight
      action: "hold" | "buy" | "sell";
      actionSize: number;
    }[] = [];

    allMarkets.forEach(market => {
      const current = currentAllocations.find(c => c.market === market);
      const target = targets.find(t => t.market === market);

      const currentPercent = current?.currentPercent || 0;
      const targetPercent = target?.targetPercent || 0;
      const drift = currentPercent - targetPercent;

      let action: "hold" | "buy" | "sell" = "hold";
      let actionSize = 0;

      if (Math.abs(drift) > driftThreshold) {
        if (drift > 0) {
          action = "sell";
          actionSize = (drift / 100) * totalValue / (current?.markPrice || 1);
        } else {
          action = "buy";
          actionSize = (Math.abs(drift) / 100) * totalValue / (current?.markPrice || 1);
        }
      }

      driftAnalysis.push({
        market,
        currentPercent,
        targetPercent,
        drift,
        action,
        actionSize,
      });
    });

    // Sort by absolute drift (highest first)
    driftAnalysis.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

    return {
      totalValue,
      allocations: driftAnalysis,
      needsRebalance: driftAnalysis.some(d => Math.abs(d.drift) > driftThreshold),
      totalDrift: driftAnalysis.reduce((sum, d) => sum + Math.abs(d.drift), 0) / 2,
    };
  }, [positions, targets, driftThreshold]);

  const executeRebalance = () => {
    const orders = analysis.allocations
      .filter(a => a.action !== "hold")
      .map(a => ({
        market: a.market,
        action: a.action as "buy" | "sell",
        size: a.actionSize,
        currentValue: (a.currentPercent / 100) * analysis.totalValue,
        targetValue: (a.targetPercent / 100) * analysis.totalValue,
      }));

    onRebalance(orders);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Scale className="w-4 h-4" />
          Portfolio Rebalancing
        </h3>
        {analysis.needsRebalance && (
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">
            Rebalance Needed
          </span>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="bg-muted rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Total Value</p>
          <p className="font-mono">${analysis.totalValue.toLocaleString()}</p>
        </div>
        <div className="bg-muted rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Drift</p>
          <p className={`font-mono ${analysis.totalDrift > 10 ? "text-amber-400" : "text-emerald-400"}`}>
            {analysis.totalDrift.toFixed(1)}%
          </p>
        </div>
        <div className="bg-muted rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Positions</p>
          <p className="font-mono">{positions.length}</p>
        </div>
      </div>

      {/* Drift Threshold */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">
          Rebalance Threshold: {driftThreshold}%
        </label>
        <input
          type="range"
          min={1}
          max={20}
          value={driftThreshold}
          onChange={(e) => setDriftThreshold(Number(e.target.value))}
          className="w-full"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Positions drifting more than {driftThreshold}% from target will trigger rebalance
        </p>
      </div>

      {/* Allocation Table */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground flex justify-between">
          <span>Market</span>
          <span>Current → Target</span>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {analysis.allocations.map((alloc) => (
            <div
              key={alloc.market}
              className={`flex items-center justify-between p-2 rounded-md text-sm ${
                Math.abs(alloc.drift) > driftThreshold
                  ? "bg-amber-500/10 border border-amber-500/30"
                  : "bg-muted"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{alloc.market}</span>
                {Math.abs(alloc.drift) > driftThreshold && (
                  <span className="text-[10px] text-amber-400">
                    {alloc.action === "buy" ? "Underweight" : "Overweight"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono">{alloc.currentPercent.toFixed(1)}%</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-muted-foreground">
                  {alloc.targetPercent.toFixed(1)}%
                </span>
                {alloc.action !== "hold" && (
                  <span className={`
                    text-[10px] px-1.5 py-0.5 rounded
                    ${alloc.action === "buy" 
                      ? "bg-emerald-500/20 text-emerald-400" 
                      : "bg-red-500/20 text-red-400"
                    }
                  `}>
                    {alloc.action.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rebalance Action */}
      {analysis.needsRebalance && (
        <button
          onClick={executeRebalance}
          className="w-full py-3 rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Execute Rebalance
        </button>
      )}

      {/* Explanation */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Drift:</strong> Measures how far current allocation deviates from target. 
          Total drift sums all absolute deviations (divided by 2 since every % over must be matched by % under).
        </p>
        <p>
          <strong>Rebalancing:</strong> Sells overweight positions and buys underweight 
          positions to restore target allocation.
        </p>
      </div>
    </div>
  );
}

export type { TargetAllocation, RebalanceOrder, PortfolioRebalancingProps };
