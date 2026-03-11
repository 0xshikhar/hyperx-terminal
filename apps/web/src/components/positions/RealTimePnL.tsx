/**
 * Real-time PnL Dashboard Component
 * 
 * Live unrealized PnL tracking with color coding and visual indicators.
 * See docs/phase2/index.md for implementation details.
 */

import { useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, Percent } from "lucide-react";

interface Position {
  id: string;
  market: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  margin: number;
}

interface RealTimePnLProps {
  positions: Position[];
}

interface PnLData {
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  totalMarginUsed: number;
  totalMarginAvailable: number;
  dailyPnL: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
}

export function RealTimePnL({ positions }: RealTimePnLProps) {
  const pnlData = useMemo<PnLData>(() => {
    const initial: PnLData = {
      totalUnrealizedPnL: 0,
      totalRealizedPnL: 1250.50,
      totalMarginUsed: 0,
      totalMarginAvailable: 50000,
      dailyPnL: 0,
      winRate: 68,
      totalTrades: 42,
      profitableTrades: 28,
    };
    
    return positions.reduce(
      (acc, pos) => {
        const priceDiff = pos.side === "long" 
          ? pos.markPrice - pos.entryPrice 
          : pos.entryPrice - pos.markPrice;
        
        const unrealizedPnL = priceDiff * pos.size;
        
        return {
          ...acc,
          totalUnrealizedPnL: acc.totalUnrealizedPnL + unrealizedPnL,
          totalMarginUsed: acc.totalMarginUsed + pos.margin,
          dailyPnL: acc.dailyPnL + unrealizedPnL * 0.1,
        };
      },
      initial
    );
  }, [positions]);

  const formatPnL = (value: number) => {
    const isPositive = value >= 0;
    return {
      text: `${isPositive ? "+" : ""}$${Math.abs(value).toFixed(2)}`,
      colorClass: isPositive ? "text-emerald-400" : "text-red-400",
      bgClass: isPositive ? "bg-emerald-500/10" : "bg-red-500/10",
      Icon: isPositive ? TrendingUp : TrendingDown,
    };
  };

  const unrealized = formatPnL(pnlData.totalUnrealizedPnL);
  const daily = formatPnL(pnlData.dailyPnL);
  const total = formatPnL(pnlData.totalUnrealizedPnL + pnlData.totalRealizedPnL);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          PnL Overview
        </h3>
        <span className="text-xs text-muted-foreground">Live</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Unrealized PnL */}
        <div className={`p-3 rounded-lg ${unrealized.bgClass}`}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Unrealized PnL
          </p>
          <p className={`text-lg font-bold ${unrealized.colorClass} flex items-center gap-1`}>
            <unrealized.Icon className="w-4 h-4" />
            {unrealized.text}
          </p>
        </div>

        {/* Daily PnL */}
        <div className={`p-3 rounded-lg ${daily.bgClass}`}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Daily PnL
          </p>
          <p className={`text-lg font-bold ${daily.colorClass} flex items-center gap-1`}>
            <daily.Icon className="w-4 h-4" />
            {daily.text}
          </p>
        </div>

        {/* Total PnL */}
        <div className={`p-3 rounded-lg ${total.bgClass}`}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Total PnL
          </p>
          <p className={`text-lg font-bold ${total.colorClass}`}>
            {total.text}
          </p>
        </div>

        {/* Win Rate */}
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Win Rate
          </p>
          <p className="text-lg font-bold flex items-center gap-1">
            <Percent className="w-4 h-4" />
            {pnlData.winRate}%
          </p>
          <p className="text-xs text-muted-foreground">
            {pnlData.profitableTrades}/{pnlData.totalTrades} trades
          </p>
        </div>
      </div>

      {/* Margin Usage */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-muted-foreground">Margin Used</span>
          <span className="font-medium">
            ${pnlData.totalMarginUsed.toLocaleString()} / ${pnlData.totalMarginAvailable.toLocaleString()}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500"
            style={{ 
              width: `${Math.min(100, (pnlData.totalMarginUsed / pnlData.totalMarginAvailable) * 100)}%` 
            }}
          />
        </div>
      </div>
    </div>
  );
}

export type { Position };
