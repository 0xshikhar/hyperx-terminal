/**
 * Position Heatmap Component
 * 
 * Visual representation of position concentration and risk.
 * See docs/phase3/index.md for implementation details.
 */

import { useMemo } from "react";

interface Position {
  market: string;
  size: number;
  side: "long" | "short";
  entryPrice: number;
  markPrice: number;
  pnl: number;
}

interface PositionHeatmapProps {
  positions: Position[];
  maxDisplay?: number;
}

interface HeatmapCell {
  market: string;
  side: "long" | "short";
  notional: number;
  pnl: number;
  pnlPercent: number;
  size: number;
  intensity: number; // 0-1 for color intensity
}

export function PositionHeatmap({ positions, maxDisplay = 20 }: PositionHeatmapProps) {
  const cells = useMemo<HeatmapCell[]>(() => {
    const totalNotional = positions.reduce(
      (sum, p) => sum + Math.abs(p.size * p.markPrice),
      0
    );

    return positions
      .map(p => {
        const notional = Math.abs(p.size * p.markPrice);
        const initialMargin = notional * 0.02; // 50x leverage = 2% margin
        const pnlPercent = (p.pnl / initialMargin) * 100;

        return {
          market: p.market,
          side: p.side,
          notional,
          pnl: p.pnl,
          pnlPercent,
          size: p.size,
          intensity: Math.min(1, notional / (totalNotional / positions.length)),
        };
      })
      .sort((a, b) => b.notional - a.notional)
      .slice(0, maxDisplay);
  }, [positions, maxDisplay]);

  const stats = useMemo(() => {
    const longs = cells.filter(c => c.side === "long");
    const shorts = cells.filter(c => c.side === "short");

    return {
      totalLong: longs.reduce((s, c) => s + c.notional, 0),
      totalShort: shorts.reduce((s, c) => s + c.notional, 0),
      totalPnL: cells.reduce((s, c) => s + c.pnl, 0),
      bestPerformers: [...cells].sort((a, b) => b.pnl - a.pnl).slice(0, 3),
      worstPerformers: [...cells].sort((a, b) => a.pnl - b.pnl).slice(0, 3),
    };
  }, [cells]);

  const getColor = (cell: HeatmapCell): string => {
    if (cell.pnlPercent > 50) return "bg-emerald-500"; // Very profitable
    if (cell.pnlPercent > 0) return `bg-emerald-${Math.floor(400 - cell.intensity * 100)}`;
    if (cell.pnlPercent < -50) return "bg-red-500"; // Heavy loss
    if (cell.pnlPercent < 0) return `bg-red-${Math.floor(400 - cell.intensity * 100)}`;
    return "bg-slate-500";
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Position Heatmap</h3>
        <span className="text-xs text-muted-foreground">
          {positions.length} positions
        </span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-muted rounded-lg p-2">
          <span className="text-muted-foreground block">Long Exposure</span>
          <span className="text-emerald-400 font-mono">
            ${stats.totalLong.toLocaleString()}
          </span>
        </div>
        <div className="bg-muted rounded-lg p-2">
          <span className="text-muted-foreground block">Short Exposure</span>
          <span className="text-red-400 font-mono">
            ${stats.totalShort.toLocaleString()}
          </span>
        </div>
        <div className={`rounded-lg p-2 ${stats.totalPnL >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
          <span className="text-muted-foreground block">Total PnL</span>
          <span className={`font-mono ${stats.totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {stats.totalPnL >= 0 ? "+" : ""}${stats.totalPnL.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Treemap Grid */}
      <div className="grid grid-cols-4 gap-1 auto-rows-fr">
        {cells.map((cell) => (
          <div
            key={cell.market}
            className={`
              relative rounded-md p-2 min-h-[60px] flex flex-col justify-between
              ${getColor(cell)} transition-all hover:scale-105 cursor-pointer
              ${cell.intensity > 0.7 ? "text-white" : "text-slate-900"}
            `}
            style={{
              gridColumn: `span ${Math.max(1, Math.ceil(cell.intensity * 2))}`,
              gridRow: `span ${Math.max(1, Math.ceil(cell.intensity * 2))}`,
              opacity: 0.3 + cell.intensity * 0.7,
            }}
            title={`${cell.market}: ${cell.side.toUpperCase()} ${cell.size} @ ${cell.pnlPercent.toFixed(1)}% PnL`}
          >
            <div className="text-xs font-medium truncate">{cell.market}</div>
            <div className="text-[10px] opacity-90">
              {cell.side === "long" ? "L" : "S"} ${(cell.notional / 1000).toFixed(1)}k
            </div>
            <div className={`
              text-[10px] font-bold
              ${cell.pnlPercent >= 0 ? "text-emerald-200" : "text-red-200"}
            `}>
              {cell.pnlPercent >= 0 ? "+" : ""}{cell.pnlPercent.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-emerald-500 rounded" />
          <span>Profitable</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span>Loss</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-slate-500 rounded" />
          <span>Neutral</span>
        </div>
        <span className="ml-auto">Size = Position Weight</span>
      </div>

      {/* Top/Bottom Performers */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground block mb-1">Top 3</span>
          {stats.bestPerformers.map(p => (
            <div key={p.market} className="flex justify-between">
              <span>{p.market}</span>
              <span className="text-emerald-400">+{p.pnlPercent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <div>
          <span className="text-muted-foreground block mb-1">Bottom 3</span>
          {stats.worstPerformers.map(p => (
            <div key={p.market} className="flex justify-between">
              <span>{p.market}</span>
              <span className="text-red-400">{p.pnlPercent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type { Position, HeatmapCell };
