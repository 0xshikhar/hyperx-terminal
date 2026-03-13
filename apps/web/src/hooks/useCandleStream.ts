import { useEffect, useMemo, useState } from "react";
import {
  candleIntervals,
  makeCandlesChannel,
  wsClient,
  type Candle,
  type CandleInterval,
  type CandlesMessage,
  type TickerMessage,
} from "@/services/wsClient";

const intervalSeconds: Record<CandleInterval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

const updateFromTicker = (
  candles: Candle[],
  message: TickerMessage,
  interval: CandleInterval
) => {
  if (candles.length === 0) return candles;
  const seconds = intervalSeconds[interval];
  const latest = candles[candles.length - 1];
  const bucket = Math.floor(message.timestamp / 1000 / seconds) * seconds;
  if (bucket === latest.time) {
    const high = Math.max(latest.high, message.lastPrice);
    const low = Math.min(latest.low, message.lastPrice);
    const close = message.lastPrice;
    return [...candles.slice(0, -1), { ...latest, high, low, close }];
  }

  const open = latest.close;
  const close = message.lastPrice;
  const high = Math.max(open, close);
  const low = Math.min(open, close);
  const next = [...candles, { time: bucket, open, high, low, close }];
  return next.slice(-200);
};

export function useCandleStream(market: string, interval: CandleInterval) {
  const [candles, setCandles] = useState<Candle[]>([]);

  useEffect(() => {
    const channel = makeCandlesChannel(market, interval);
    wsClient.subscribe(channel);
    wsClient.subscribe("ticker", market);

    const unsubscribeCandles = wsClient.on("candles", (message: CandlesMessage) => {
      if (message.market !== market) return;
      if (message.interval !== interval) return;
      setCandles(message.candles);
    });

    const unsubscribeTicker = wsClient.on("ticker", (message: TickerMessage) => {
      if (message.market !== market) return;
      if (!candleIntervals.includes(interval)) return;
      setCandles((current) => updateFromTicker(current, message, interval));
    });

    return () => {
      wsClient.unsubscribe(channel);
      wsClient.unsubscribe("ticker", market);
      unsubscribeCandles();
      unsubscribeTicker();
    };
  }, [market, interval]);

  const latest = useMemo(() => candles[candles.length - 1] ?? null, [candles]);

  return { candles, latest };
}
