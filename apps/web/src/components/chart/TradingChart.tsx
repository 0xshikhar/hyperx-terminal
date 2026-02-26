import { useEffect, useRef } from "react";
import {
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useMarketStore } from "@/store/marketStore";
import { wsClient } from "@/services/wsClient";

export function TradingChart() {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastTimeRef = useRef<UTCTimestamp | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#cbd5e1",
      },
      grid: {
        horzLines: { color: "rgba(148, 163, 184, 0.08)" },
        vertLines: { color: "rgba(148, 163, 184, 0.08)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: 1 },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#26A69A",
      downColor: "#EF5350",
      borderVisible: false,
      wickUpColor: "#26A69A",
      wickDownColor: "#EF5350",
    });

    const now = Math.floor(Date.now() / 1000) as UTCTimestamp;
    const seed: CandlestickData[] = Array.from({ length: 60 }).map((_, i) => {
      const time = (now - ((60 - i) * 60) as UTCTimestamp) as UTCTimestamp;
      const base = activeMarket === "ETH-USD" ? 4800 : activeMarket === "STRK-USD" ? 2.2 : 95000;
      const open = base + (Math.random() - 0.5) * (activeMarket === "STRK-USD" ? 0.02 : 80);
      const close = open + (Math.random() - 0.5) * (activeMarket === "STRK-USD" ? 0.01 : 40);
      const high = Math.max(open, close) + Math.random() * (activeMarket === "STRK-USD" ? 0.01 : 30);
      const low = Math.min(open, close) - Math.random() * (activeMarket === "STRK-USD" ? 0.01 : 30);
      return { time, open, high, low, close };
    });

    series.setData(seed);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;
    lastTimeRef.current = (seed[seed.length - 1]?.time as UTCTimestamp | undefined) ?? null;

    const resize = () => {
      if (!containerRef.current) return;
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    };

    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      lastTimeRef.current = null;
    };
  }, [activeMarket]);

  useEffect(() => {
    wsClient.subscribe("ticker", activeMarket);
    const unsubscribe = wsClient.on("ticker", (message) => {
      if (message.market !== activeMarket) return;
      const series = seriesRef.current;
      if (!series) return;

      const nextTime = Math.floor(message.timestamp / 1000) as UTCTimestamp;
      const currentTime = lastTimeRef.current;
      const time =
        currentTime && nextTime <= currentTime
          ? ((currentTime + 60) as UTCTimestamp)
          : nextTime;
      lastTimeRef.current = time;

      const close = message.lastPrice;
      const open = close;
      const high = close;
      const low = close;
      series.update({ time, open, high, low, close });
    });

    return () => {
      wsClient.unsubscribe("ticker", activeMarket);
      unsubscribe();
    };
  }, [activeMarket]);

  return (
    <div className="h-full rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Chart</h3>
        <span className="text-xs text-muted-foreground">{activeMarket}</span>
      </div>
      <div className="mt-4 h-64 rounded-md border border-border" ref={containerRef} />
    </div>
  );
}
