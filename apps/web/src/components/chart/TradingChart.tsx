import { useEffect, useRef, useState } from "react";
import {
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useMarketStore } from "@/store/marketStore";
import { ChartToolbar } from "@/components/chart/ChartToolbar";
import { ChartPositionOverlay } from "@/components/chart/ChartPositionOverlay";
import { useCandleStream } from "@/hooks/useCandleStream";
import type { CandleInterval } from "@/services/wsClient";

export function TradingChart() {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const [interval, setInterval] = useState<CandleInterval>("1m");
  const { candles } = useCandleStream(activeMarket, interval);
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

    chartRef.current = chart;
    seriesRef.current = series;

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
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || candles.length === 0) return;
    series.setData(
      candles.map(
        (candle) =>
          ({
            time: candle.time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }) as CandlestickData
      )
    );
    lastTimeRef.current = candles[candles.length - 1]?.time as UTCTimestamp;
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <div className="h-full rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Chart</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{activeMarket}</span>
          <ChartToolbar interval={interval} onIntervalChange={setInterval} />
        </div>
      </div>
      <div className="relative mt-4 h-64 rounded-md border border-border">
        <div ref={containerRef} className="h-full w-full" />
        <ChartPositionOverlay market={activeMarket} />
      </div>
    </div>
  );
}
