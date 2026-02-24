import { useEffect, useMemo, useState } from "react";
import { getMarketCandles } from "@/services/apiClient/markets.api";
import {
  candleIntervals,
  makeCandlesChannel,
  wsClient,
  type Candle,
  type CandleInterval,
  type CandlesMessage,
  type TickerMessage,
} from "@/services/wsClient";
import { normalizeMarketSymbol } from "@hyperx/types/common";
import { useNetworkStore } from "@/store/networkStore";
import { useQuery } from "@tanstack/react-query";

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
  const normalizedMarket = useMemo(() => normalizeMarketSymbol(market), [market]);
  const network = useNetworkStore((s) => s.network);
  const { data: candleData } = useQuery({
    queryKey: ["market-candles", normalizedMarket, interval],
    queryFn: () => getMarketCandles(normalizedMarket, interval),
    enabled: Boolean(normalizedMarket),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const historicalCandles = candleData?.candles ?? [];

  useEffect(() => {
    setCandles([]);
  }, [normalizedMarket, interval]);

  useEffect(() => {
    if (historicalCandles.length > 0) {
      setCandles(historicalCandles);
    }
  }, [historicalCandles]);

  useEffect(() => {
    const channel = makeCandlesChannel(normalizedMarket, interval);
    wsClient.subscribe(channel, undefined, network);
    wsClient.subscribe("ticker", normalizedMarket, network);

    const unsubscribeCandles = wsClient.on("candles", (message: CandlesMessage) => {
      if (normalizeMarketSymbol(message.market) !== normalizedMarket) return;
      if (message.interval !== interval) return;
      setCandles(message.candles);
    });

    const unsubscribeTicker = wsClient.on("ticker", (message: TickerMessage) => {
      if (normalizeMarketSymbol(message.market) !== normalizedMarket) return;
      if (!candleIntervals.includes(interval)) return;
      setCandles((current) => updateFromTicker(current, message, interval));
    });

    return () => {
      wsClient.unsubscribe(channel, undefined, network);
      wsClient.unsubscribe("ticker", normalizedMarket, network);
      unsubscribeCandles();
      unsubscribeTicker();
    };
  }, [normalizedMarket, interval, network]);

  const series = candles.length > 0 ? candles : [];
  const latest = useMemo(() => series[series.length - 1] ?? null, [series]);

  return { candles: series, latest, isReference: false };
}
