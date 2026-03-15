import type { Candle, CandleInterval } from "@/services/wsClient";
import type { Trade } from "@/store/tradeStore";

const intervalSeconds: Record<CandleInterval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function createReferenceCandles(
  basePrice: number,
  interval: CandleInterval,
  count = 120
): Candle[] {
  const now = Math.floor(Date.now() / 1000);
  const seconds = intervalSeconds[interval];
  const currentBucket = Math.floor(now / seconds) * seconds;

  return Array.from({ length: count }, (_, index) => {
    const time = currentBucket - (count - index - 1) * seconds;
    const drift = Math.sin(index / 6) * basePrice * 0.002;
    const open = basePrice + drift;
    const close = open + Math.cos(index / 4) * basePrice * 0.0012;
    const high = Math.max(open, close) + basePrice * 0.0008;
    const low = Math.min(open, close) - basePrice * 0.0008;
    return {
      time,
      open: round(open, basePrice >= 100 ? 2 : 4),
      high: round(high, basePrice >= 100 ? 2 : 4),
      low: round(low, basePrice >= 100 ? 2 : 4),
      close: round(close, basePrice >= 100 ? 2 : 4),
    };
  });
}

export function createReferenceTrades(market: string, basePrice: number, count = 32): Trade[] {
  return Array.from({ length: count }, (_, index) => {
    const timestamp = Date.now() - index * 15_000;
    const priceOffset = Math.sin(index / 3) * basePrice * 0.0009;
    return {
      id: `${market}-reference-trade-${index}`,
      market,
      side: index % 2 === 0 ? "buy" : "sell",
      price: round(basePrice + priceOffset, basePrice >= 100 ? 2 : 4),
      size: round(0.25 + (index % 6) * 0.18, 4),
      timestamp,
      time: new Date(timestamp).toLocaleTimeString(),
    };
  });
}

export function createReferenceOrderbook(basePrice: number, levels = 24) {
  const tick = basePrice >= 1000 ? 5 : basePrice >= 100 ? 0.5 : 0.01;

  return {
    bids: Array.from({ length: levels }, (_, index) => ({
      price: round(basePrice - tick * (index + 1), basePrice >= 100 ? 2 : 4),
      size: round(0.3 + index * 0.12, 4),
    })),
    asks: Array.from({ length: levels }, (_, index) => ({
      price: round(basePrice + tick * (index + 1), basePrice >= 100 ? 2 : 4),
      size: round(0.32 + index * 0.11, 4),
    })),
  };
}
