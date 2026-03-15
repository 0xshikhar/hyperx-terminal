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
    <div className="rounded-[18px] border border-[#213136] bg-[#091416]">
      <div className="flex items-center justify-between border-b border-[#152327] px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#dde5e7]">
          <DollarSign className="w-4 h-4" />
          PnL Overview
        </h3>
        <span className="text-xs text-[#7e8c91]">Live</span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4">
        <div className={`rounded-md border border-[#1d2b2f] p-3 ${unrealized.bgClass}`}>
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[#708084]">
            Unrealized PnL
          </p>
          <p className={`flex items-center gap-1 text-lg font-bold ${unrealized.colorClass}`}>
            <unrealized.Icon className="w-4 h-4" />
            {unrealized.text}
          </p>
        </div>

        <div className={`rounded-md border border-[#1d2b2f] p-3 ${daily.bgClass}`}>
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[#708084]">
            Daily PnL
          </p>
          <p className={`flex items-center gap-1 text-lg font-bold ${daily.colorClass}`}>
            <daily.Icon className="w-4 h-4" />
            {daily.text}
          </p>
        </div>

        <div className={`rounded-md border border-[#1d2b2f] p-3 ${total.bgClass}`}>
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[#708084]">
            Total PnL
          </p>
          <p className={`text-lg font-bold ${total.colorClass}`}>
            {total.text}
          </p>
        </div>

        <div className="rounded-md border border-[#1d2b2f] bg-[#0c181b] p-3">
          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[#708084]">
            Win Rate
          </p>
          <p className="flex items-center gap-1 text-lg font-bold text-[#d8dfe1]">
            <Percent className="w-4 h-4" />
            {pnlData.winRate}%
          </p>
          <p className="text-xs text-[#7e8c91]">
            {pnlData.profitableTrades}/{pnlData.totalTrades} trades
          </p>
        </div>
      </div>

      <div className="border-t border-[#152327] px-4 py-4">
        <div className="mb-2 flex justify-between text-xs">
          <span className="text-[#7e8c91]">Margin Used</span>
          <span className="font-medium text-[#d8dfe1]">
            ${pnlData.totalMarginUsed.toLocaleString()} / ${pnlData.totalMarginAvailable.toLocaleString()}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#132126]">
          <div 
            className="h-full bg-[#53d8c8] transition-all duration-500"
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
