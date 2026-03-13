/**
 * Risk Analytics Component
 * 
 * VaR (Value at Risk) and Sharpe Ratio calculations.
 * See docs/phase4/index.md for implementation details.
 */

import { useMemo } from "react";
import { AlertTriangle, TrendingUp, Activity } from "lucide-react";

interface Position {
  market: string;
  size: number;
  side: "long" | "short";
  entryPrice: number;
  markPrice: number;
  pnl: number;
  pnlHistory: number[]; // Daily PnL for last 30 days
}

interface RiskAnalyticsProps {
  positions: Position[];
  riskFreeRate?: number; // Annual, default 5%
}

interface RiskMetrics {
  var95: number; // 95% VaR (1-day)
  var99: number; // 99% VaR (1-day)
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number; // Annualized
  beta: number;
}

export function RiskAnalytics({ positions, riskFreeRate = 0.05 }: RiskAnalyticsProps) {
  const metrics = useMemo<RiskMetrics>(() => {
    const positionsWithHistory = positions.filter((position) => position.pnlHistory.length > 0);

    if (positionsWithHistory.length === 0) {
      return {
        var95: 0,
        var99: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        beta: 0,
      };
    }

    // Aggregate portfolio daily returns
    const portfolioReturns: number[] = [];
    const days = Math.max(...positionsWithHistory.map((p) => p.pnlHistory.length));
    
    for (let i = 0; i < days; i++) {
      let dailyReturn = 0;
      positionsWithHistory.forEach((pos) => {
        if (pos.pnlHistory[i] !== undefined) {
          dailyReturn += pos.pnlHistory[i];
        }
      });
      portfolioReturns.push(dailyReturn);
    }

    // Calculate returns (percentage)
    const totalNotional = positionsWithHistory.reduce(
      (sum, p) => sum + Math.abs(p.size * p.markPrice),
      0
    );
    if (totalNotional === 0) {
      return {
        var95: 0,
        var99: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        beta: 0,
      };
    }
    const returns = portfolioReturns.map(r => r / totalNotional);

    // Standard deviation (volatility)
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const dailyVol = Math.sqrt(variance);
    const annualVol = dailyVol * Math.sqrt(365);

    // VaR calculation (parametric method)
    // VaR = Portfolio Value × Z-score × Volatility
    const z95 = 1.645; // 95% confidence
    const z99 = 2.33;  // 99% confidence
    const var95 = totalNotional * z95 * dailyVol;
    const var99 = totalNotional * z99 * dailyVol;

    // Sharpe Ratio = (Return - Risk Free) / Volatility
    const annualReturn = mean * 365;
    const sharpeRatio = annualVol > 0 
      ? (annualReturn - riskFreeRate) / annualVol 
      : 0;

    // Max Drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;
    portfolioReturns.forEach(pnl => {
      cumulative += pnl;
      if (cumulative > peak) peak = cumulative;
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    // Beta (simplified - assume market is first position)
    const marketReturns = positionsWithHistory[0]?.pnlHistory.map((_, i) => {
      return positionsWithHistory.reduce((sum, p) => sum + (p.pnlHistory[i] || 0), 0) / totalNotional;
    }) || [];
    
    const marketMean = marketReturns.reduce((a, b) => a + b, 0) / marketReturns.length;
    const marketVariance = marketReturns.reduce((sum, r) => sum + Math.pow(r - marketMean, 2), 0) / marketReturns.length;
    
    const covariance = returns.reduce((sum, r, i) => {
      return sum + (r - mean) * (marketReturns[i] - marketMean);
    }, 0) / returns.length;
    
    const beta = marketVariance > 0 ? covariance / marketVariance : 0;

    return {
      var95,
      var99,
      sharpeRatio,
      maxDrawdown,
      volatility: annualVol,
      beta,
    };
  }, [positions, riskFreeRate]);

  const getRiskLevel = (sharpe: number): { label: string; color: string } => {
    if (sharpe > 2) return { label: "Excellent", color: "text-emerald-400" };
    if (sharpe > 1) return { label: "Good", color: "text-emerald-400" };
    if (sharpe > 0) return { label: "Fair", color: "text-yellow-400" };
    return { label: "Poor", color: "text-red-400" };
  };

  const sharpeAssessment = getRiskLevel(metrics.sharpeRatio);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Risk Analytics
        </h3>
        <span className={`text-xs font-medium ${sharpeAssessment.color}`}>
          {sharpeAssessment.label}
        </span>
      </div>

      {/* VaR Section */}
      <div className="bg-muted rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="font-medium">Value at Risk (VaR)</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card rounded p-2">
            <p className="text-[10px] text-muted-foreground">95% VaR (1-day)</p>
            <p className="text-sm font-mono text-red-400">
              -${Math.abs(metrics.var95).toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              95% chance loss won't exceed this
            </p>
          </div>
          <div className="bg-card rounded p-2">
            <p className="text-[10px] text-muted-foreground">99% VaR (1-day)</p>
            <p className="text-sm font-mono text-red-400">
              -${Math.abs(metrics.var99).toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              99% chance loss won't exceed this
            </p>
          </div>
        </div>
      </div>

      {/* Sharpe & Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted rounded-lg p-3">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
            <TrendingUp className="w-3 h-3" />
            Sharpe Ratio
          </div>
          <p className={`text-lg font-bold ${sharpeAssessment.color}`}>
            {metrics.sharpeRatio.toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Risk-adjusted return
          </p>
        </div>

        <div className="bg-muted rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground mb-1">
            Max Drawdown
          </div>
          <p className="text-lg font-bold text-red-400">
            -${metrics.maxDrawdown.toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Peak to trough loss
          </p>
        </div>

        <div className="bg-muted rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground mb-1">
            Volatility (Annual)
          </div>
          <p className="text-lg font-bold">
            {(metrics.volatility * 100).toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground">
            Standard deviation
          </p>
        </div>

        <div className="bg-muted rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground mb-1">
            Beta
          </div>
          <p className={`text-lg font-bold ${metrics.beta > 1 ? "text-amber-400" : "text-emerald-400"}`}>
            {metrics.beta.toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {metrics.beta > 1 ? "More volatile than market" : "Less volatile than market"}
          </p>
        </div>
      </div>

      {/* Risk Explanation */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          <strong>VaR Interpretation:</strong> With 95% confidence, your portfolio 
          will not lose more than ${Math.abs(metrics.var95).toFixed(2)} in a single day.
        </p>
        <p>
          <strong>Sharpe Ratio:</strong> A ratio above 1 is good, above 2 is excellent. 
          Higher is better risk-adjusted performance.
        </p>
      </div>
    </div>
  );
}

export type { RiskMetrics, Position };
