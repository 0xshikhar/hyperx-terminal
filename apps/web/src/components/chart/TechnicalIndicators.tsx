/**
 * Technical Indicators Component
 * 
 * EMA, VWAP, and RSI overlays for the trading chart.
 * See docs/phase2/index.md for implementation details.
 */

import { useMemo, useCallback } from "react";
import { TrendingUp, Activity, BarChart3 } from "lucide-react";

export type IndicatorType = "ema" | "vwap" | "rsi" | "volume";

interface IndicatorConfig {
  type: IndicatorType;
  period?: number;
  visible: boolean;
  color: string;
}

interface TechnicalIndicatorsProps {
  indicators: IndicatorConfig[];
  onToggle: (type: IndicatorType) => void;
  onPeriodChange?: (type: IndicatorType, period: number) => void;
}

const indicatorOptions: { type: IndicatorType; label: string; icon: React.ReactNode; defaultPeriod?: number }[] = [
  { type: "ema", label: "EMA", icon: <TrendingUp className="w-4 h-4" />, defaultPeriod: 20 },
  { type: "vwap", label: "VWAP", icon: <Activity className="w-4 h-4" /> },
  { type: "rsi", label: "RSI", icon: <BarChart3 className="w-4 h-4" />, defaultPeriod: 14 },
  { type: "volume", label: "Volume", icon: <BarChart3 className="w-4 h-4" /> },
];

export function TechnicalIndicatorsToolbar({ indicators, onToggle }: TechnicalIndicatorsProps) {
  const activeIndicators = new Set(indicators.filter(i => i.visible).map(i => i.type));

  return (
    <div className="flex items-center gap-1">
      {indicatorOptions.map((option) => {
        const isActive = activeIndicators.has(option.type);
        const config = indicators.find(i => i.type === option.type);
        
        return (
          <button
            key={option.type}
            onClick={() => onToggle(option.type)}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors
              ${isActive 
                ? "bg-primary/20 text-primary border border-primary/30" 
                : "hover:bg-muted text-muted-foreground border border-transparent"
              }
            `}
          >
            {option.icon}
            <span>{option.label}</span>
            {config?.period && (
              <span className="text-[10px] opacity-70">{config.period}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// EMA Calculation
export function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  
  let prevEma = data[0];
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      ema.push(data[0]);
    } else {
      const currentEma = data[i] * k + prevEma * (1 - k);
      ema.push(currentEma);
      prevEma = currentEma;
    }
  }
  
  return ema;
}

// VWAP Calculation
export function calculateVWAP(
  highs: number[], 
  lows: number[], 
  closes: number[], 
  volumes: number[]
): number[] {
  const vwap: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  
  for (let i = 0; i < closes.length; i++) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    const tpv = typicalPrice * volumes[i];
    
    cumulativeTPV += tpv;
    cumulativeVolume += volumes[i];
    
    vwap.push(cumulativeTPV / cumulativeVolume);
  }
  
  return vwap;
}

// RSI Calculation
export function calculateRSI(data: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  let gains = 0;
  let losses = 0;
  
  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      rsi.push(50); // Neutral during warmup
      continue;
    }
    
    if (i > period) {
      const change = data[i] - data[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    
    const rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }
  
  return rsi;
}

// Volume Profile Calculation
export function calculateVolumeProfile(
  prices: number[],
  volumes: number[],
  bins: number = 24
): { price: number; volume: number; percent: number }[] {
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const binSize = (maxPrice - minPrice) / bins;
  
  const profile = new Map<number, number>();
  
  for (let i = 0; i < prices.length; i++) {
    const binIndex = Math.floor((prices[i] - minPrice) / binSize);
    const binPrice = minPrice + binIndex * binSize;
    profile.set(binPrice, (profile.get(binPrice) || 0) + volumes[i]);
  }
  
  const maxVolume = Math.max(...profile.values());
  
  return Array.from(profile.entries())
    .map(([price, volume]) => ({
      price,
      volume,
      percent: (volume / maxVolume) * 100,
    }))
    .sort((a, b) => a.price - b.price);
}

export type { IndicatorConfig };
