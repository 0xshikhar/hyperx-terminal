/**
 * Correlation Matrix Component
 * 
 * Position correlation analysis for hedging decisions.
 * See docs/phase4/index.md for implementation details.
 */

import { useMemo } from "react";
import { GitBranch, AlertCircle } from "lucide-react";

interface Position {
  market: string;
  pnlHistory: number[]; // Last 30 days of daily PnL
}

interface CorrelationMatrixProps {
  positions: Position[];
}

interface CorrelationCell {
  pair: [string, string];
  correlation: number; // -1 to 1
  strength: "strong" | "moderate" | "weak" | "none";
}

export function CorrelationMatrix({ positions }: CorrelationMatrixProps) {
  const correlations = useMemo<CorrelationCell[]>(() => {
    if (positions.length < 2) return [];

    const results: CorrelationCell[] = [];

    // Calculate correlation for each pair
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const pos1 = positions[i];
        const pos2 = positions[j];

        // Ensure same length
        const minLength = Math.min(pos1.pnlHistory.length, pos2.pnlHistory.length);
        const returns1 = pos1.pnlHistory.slice(0, minLength);
        const returns2 = pos2.pnlHistory.slice(0, minLength);

        if (returns1.length === 0 || returns2.length === 0) continue;

        // Calculate correlation coefficient
        const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
        const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;

        let numerator = 0;
        let denom1 = 0;
        let denom2 = 0;

        for (let k = 0; k < returns1.length; k++) {
          const diff1 = returns1[k] - mean1;
          const diff2 = returns2[k] - mean2;
          numerator += diff1 * diff2;
          denom1 += diff1 * diff1;
          denom2 += diff2 * diff2;
        }

        const correlation = denom1 > 0 && denom2 > 0 
          ? numerator / Math.sqrt(denom1 * denom2)
          : 0;

        let strength: CorrelationCell["strength"];
        const absCorr = Math.abs(correlation);
        if (absCorr > 0.7) strength = "strong";
        else if (absCorr > 0.4) strength = "moderate";
        else if (absCorr > 0.2) strength = "weak";
        else strength = "none";

        results.push({
          pair: [pos1.market, pos2.market],
          correlation,
          strength,
        });
      }
    }

    // Sort by absolute correlation (highest first)
    return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }, [positions]);

  const getCorrelationColor = (corr: number): string => {
    if (corr > 0.7) return "bg-red-500 text-white"; // Strong positive (risk!)
    if (corr > 0.4) return "bg-orange-400 text-white";
    if (corr > 0.2) return "bg-yellow-400 text-black";
    if (corr > -0.2) return "bg-slate-300 text-black";
    if (corr > -0.4) return "bg-cyan-400 text-black";
    if (corr > -0.7) return "bg-blue-400 text-white";
    return "bg-emerald-500 text-white"; // Strong negative (hedge!)
  };

  const hedgingOpportunities = correlations.filter(c => c.correlation < -0.5);
  const highRiskPairs = correlations.filter(c => c.correlation > 0.7);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <GitBranch className="w-4 h-4" />
          Correlation Matrix
        </h3>
        <span className="text-xs text-muted-foreground">
          {positions.length} positions
        </span>
      </div>

      {/* Hedging Alert */}
      {hedgingOpportunities.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-start gap-2">
          <GitBranch className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-400">
              Hedging Opportunity
            </p>
            <p className="text-xs text-muted-foreground">
              {hedgingOpportunities.length} negatively correlated pairs found. 
              These positions hedge each other.
            </p>
          </div>
        </div>
      )}

      {/* High Correlation Warning */}
      {highRiskPairs.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">
              High Correlation Risk
            </p>
            <p className="text-xs text-muted-foreground">
              {highRiskPairs.length} pairs have &gt;70% correlation. 
              These positions move together - concentration risk!
            </p>
          </div>
        </div>
      )}

      {/* Correlation Table */}
      {correlations.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Position Correlations (sorted by strength)
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {correlations.map((cell, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-md bg-muted"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-12 text-center text-xs font-bold rounded py-1 ${getCorrelationColor(cell.correlation)}`}>
                    {(cell.correlation * 100).toFixed(0)}%
                  </span>
                  <div className="text-xs">
                    <span className="font-medium">{cell.pair[0]}</span>
                    <span className="text-muted-foreground mx-1">↔</span>
                    <span className="font-medium">{cell.pair[1]}</span>
                  </div>
                </div>
                <span className={`text-[10px] capitalize ${
                  cell.strength === "strong" ? "text-red-400" :
                  cell.strength === "moderate" ? "text-orange-400" :
                  cell.strength === "weak" ? "text-yellow-400" :
                  "text-muted-foreground"
                }`}>
                  {cell.strength}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Need at least 2 positions with history for correlation analysis
        </p>
      )}

      {/* Legend */}
      <div className="grid grid-cols-4 gap-2 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span>Strong + (Risk)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-400 rounded" />
          <span>Moderate +</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-slate-300 rounded" />
          <span>No Corr</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-emerald-500 rounded" />
          <span>Strong - (Hedge)</span>
        </div>
      </div>

      {/* Interpretation */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Positive correlation:</strong> Positions move together. 
          High positive correlation increases portfolio risk.
        </p>
        <p>
          <strong>Negative correlation:</strong> Positions hedge each other. 
          One goes up while the other goes down, reducing overall volatility.
        </p>
      </div>
    </div>
  );
}

export type { CorrelationCell, Position };
