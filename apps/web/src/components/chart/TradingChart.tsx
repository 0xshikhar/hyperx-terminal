import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useMarketStore } from "@/store/marketStore";
import { ChartToolbar } from "@/components/chart/ChartToolbar";
import { ChartPositionOverlay } from "@/components/chart/ChartPositionOverlay";
import {
  DrawingToolsToolbar,
  useDrawingTools,
  type DrawingLine,
} from "@/components/chart/DrawingTools";
import {
  TechnicalIndicatorsToolbar,
  calculateEMA,
  calculateRSI,
  calculateVWAP,
  type IndicatorType,
} from "@/components/chart/TechnicalIndicators";
import { VolumeProfile } from "@/components/chart/VolumeProfile";
import { useCandleStream } from "@/hooks/useCandleStream";
import { useRecentTrades } from "@/hooks/useRecentTrades";
import type { CandleInterval } from "@/services/wsClient";

export function TradingChart() {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const [interval, setInterval] = useState<CandleInterval>("1m");
  const { candles } = useCandleStream(activeMarket, interval);
  const { trades } = useRecentTrades(activeMarket);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastTimeRef = useRef<UTCTimestamp | null>(null);
  const [overlayVersion, setOverlayVersion] = useState(0);
  const {
    activeTool,
    setActiveTool,
    lines,
    startDrawing,
    updateDrawing,
    endDrawing,
    clearLines,
  } = useDrawingTools();
  const [indicators, setIndicators] = useState([
    { type: "ema" as IndicatorType, period: 20, visible: true, color: "#38bdf8" },
    { type: "vwap" as IndicatorType, visible: true, color: "#f59e0b" },
    { type: "rsi" as IndicatorType, period: 14, visible: false, color: "#a78bfa" },
  ]);

  const closes = useMemo(() => candles.map((candle) => candle.close), [candles]);
  const highs = useMemo(() => candles.map((candle) => candle.high), [candles]);
  const lows = useMemo(() => candles.map((candle) => candle.low), [candles]);
  const syntheticVolumes = useMemo(
    () => candles.map((candle) => Math.max(1, Math.abs(candle.close - candle.open) * 100)),
    [candles]
  );
  const ema = useMemo(() => calculateEMA(closes, 20), [closes]);
  const vwap = useMemo(
    () => calculateVWAP(highs, lows, closes, syntheticVolumes),
    [closes, highs, lows, syntheticVolumes]
  );
  const rsi = useMemo(() => calculateRSI(closes, 14), [closes]);

  const indicatorSummary = useMemo(
    () =>
      indicators
        .filter((indicator) => indicator.visible)
        .map((indicator) => {
          if (indicator.type === "ema") {
            return { label: `EMA ${indicator.period}`, value: ema[ema.length - 1] };
          }
          if (indicator.type === "vwap") {
            return { label: "VWAP", value: vwap[vwap.length - 1] };
          }
          return { label: `RSI ${indicator.period}`, value: rsi[rsi.length - 1] };
        }),
    [ema, indicators, rsi, vwap]
  );

  const toggleIndicator = (type: IndicatorType) => {
    setIndicators((prev) =>
      prev.map((indicator) =>
        indicator.type === type
          ? { ...indicator, visible: !indicator.visible }
          : indicator
      )
    );
  };

  const normalizeTime = (value: Time | null): number | null => {
    if (value === null) return null;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
    }
    return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 1000);
  };

  const mapClientPoint = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;

    if (!container || candles.length === 0 || !chart || !series) return null;
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const time = normalizeTime(chart.timeScale().coordinateToTime(x));
    const price = series.coordinateToPrice(y);

    if (typeof price === "number" && time !== null) {
      return { price, time };
    }

    const xRatio = Math.min(Math.max(x / rect.width, 0), 1);
    const yRatio = Math.min(Math.max(y / rect.height, 0), 1);
    const minPrice = Math.min(...lows);
    const maxPrice = Math.max(...highs);
    const fallbackPrice = maxPrice - yRatio * (maxPrice - minPrice || 1);
    const firstTime = candles[0]?.time ?? 0;
    const lastTime = candles[candles.length - 1]?.time ?? firstTime;
    const fallbackTime = Math.round(firstTime + xRatio * (lastTime - firstTime || 1));
    return { price: fallbackPrice, time: fallbackTime };
  }, [candles, highs, lows]);

  const drawLines = useMemo(() => {
    if (candles.length === 0) return [];
    const chart = chartRef.current;
    const series = seriesRef.current;
    const minPrice = Math.min(...lows);
    const maxPrice = Math.max(...highs);
    const firstTime = candles[0]?.time ?? 0;
    const lastTime = candles[candles.length - 1]?.time ?? firstTime;
    const toY = (price: number) => {
      const y = series?.priceToCoordinate(price);
      if (typeof y === "number") return y / (containerRef.current?.clientHeight || 1) * 100;
      return ((maxPrice - price) / (maxPrice - minPrice || 1)) * 100;
    };
    const toX = (time: number) => {
      const x = chart?.timeScale().timeToCoordinate(time as UTCTimestamp);
      if (typeof x === "number") return x / (containerRef.current?.clientWidth || 1) * 100;
      return ((time - firstTime) / (lastTime - firstTime || 1)) * 100;
    };

    return lines.map((line: DrawingLine) => ({
      id: line.id,
      x1: toX(line.startTime),
      y1: toY(line.startPrice),
      x2: toX(line.endTime ?? line.startTime),
      y2: toY(line.type === "horizontal" ? line.startPrice : line.endPrice ?? line.startPrice),
      color: line.color,
    }));
  }, [candles, highs, lines, lows, overlayVersion]);

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
    const notifyOverlay = () => setOverlayVersion((value) => value + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(notifyOverlay);

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
    notifyOverlay();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(notifyOverlay);
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Chart</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{activeMarket}</span>
            {indicatorSummary.map((item) => (
              <span key={item.label} className="rounded-full bg-muted px-2 py-1 font-mono">
                {item.label}: {item.value?.toFixed(2) ?? "--"}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DrawingToolsToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onClear={clearLines}
          />
          <TechnicalIndicatorsToolbar
            indicators={indicators}
            onToggle={toggleIndicator}
          />
          <ChartToolbar interval={interval} onIntervalChange={setInterval} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr,280px]">
        <div
          className="relative h-72 rounded-md border border-border"
          onMouseDown={(event) => {
            const point = mapClientPoint(event);
            if (point) startDrawing(point.price, point.time);
          }}
          onMouseMove={(event) => {
            const point = mapClientPoint(event);
            if (point) updateDrawing(point.price, point.time);
          }}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
        >
          <div ref={containerRef} className="h-full w-full" />
          {candles.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/20 text-xs text-muted-foreground">
              Waiting for live candle data...
            </div>
          )}
          <ChartPositionOverlay market={activeMarket} />
          <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
            {drawLines.map((line) => (
              <line
                key={line.id}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={line.color}
                strokeWidth="0.6"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>

        <VolumeProfile
          prices={trades.map((trade) => trade.price)}
          volumes={trades.map((trade) => trade.size)}
        />
      </div>
    </div>
  );
}
