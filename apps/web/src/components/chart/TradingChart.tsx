import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useMarketStore } from "@/store/marketStore";
import { ChartPositionOverlay } from "@/components/chart/ChartPositionOverlay";
import {
  useDrawingTools,
  type DrawingLine,
} from "@/components/chart/DrawingTools";
import {
  calculateEMA,
  calculateRSI,
  calculateVWAP,
} from "@/components/chart/TechnicalIndicators";
import { useCandleStream } from "@/hooks/useCandleStream";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";
import { cn } from "@/lib/utils";
import type { CandleInterval } from "@/services/wsClient";

type TradingChartProps = {
  interval: CandleInterval;
};

export function TradingChart({ interval }: TradingChartProps) {
  const activeMarket = useMarketStore((state) => state.activeMarket);
  const { candles, isReference } = useCandleStream(activeMarket, interval);
  const connectionState = useRuntimeHealthStore((state) => state.connectionState);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastTimeRef = useRef<UTCTimestamp | null>(null);
  const lastCountRef = useRef<number>(0);
  const lastSeriesKeyRef = useRef<string | null>(null);
  const [showNoData, setShowNoData] = useState(false);
  const {
    lines,
    startDrawing,
    updateDrawing,
    endDrawing,
  } = useDrawingTools();

  const {
    highs,
    lows,
    latestEma,
    latestVwap,
    latestRsi,
  } = useMemo(() => {
    if (candles.length === 0) {
      return {
        highs: [] as number[],
        lows: [] as number[],
        latestEma: null,
        latestVwap: null,
        latestRsi: null,
      };
    }

    const count = candles.length;
    const closes = new Array<number>(count);
    const highsArr = new Array<number>(count);
    const lowsArr = new Array<number>(count);
    const volumes = new Array<number>(count);

    for (let i = 0; i < count; i++) {
      const c = candles[i];
      closes[i] = c.close;
      highsArr[i] = c.high;
      lowsArr[i] = c.low;
      volumes[i] = Math.max(1, Math.abs(c.close - c.open) * 100);
    }

    const emaArr = calculateEMA(closes, 20);
    const vwapArr = calculateVWAP(highsArr, lowsArr, closes, volumes);
    const rsiArr = calculateRSI(closes, 14);

    return {
      highs: highsArr,
      lows: lowsArr,
      latestEma: emaArr[emaArr.length - 1] ?? null,
      latestVwap: vwapArr[vwapArr.length - 1] ?? null,
      latestRsi: rsiArr[rsiArr.length - 1] ?? null,
    };
  }, [candles]);

  const normalizeTime = (value: Time | null): number | null => {
    if (value === null) return null;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
    }
    return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 1000);
  };

  const mapClientPoint = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
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
    },
    [candles, highs, lows]
  );

  const [drawLines, setDrawLines] = useState<Array<{ id: string; x1: number; y1: number; x2: number; y2: number; color: string }>>([]);
  const [overlayTrigger, setOverlayTrigger] = useState(0);

  useEffect(() => {
    if (candles.length === 0) {
      setDrawLines([]); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const chart = chartRef.current;
    const series = seriesRef.current;
    const containerHeight = containerRef.current?.clientHeight || 1;
    const containerWidth = containerRef.current?.clientWidth || 1;
    const minPrice = Math.min(...lows);
    const maxPrice = Math.max(...highs);
    const firstTime = candles[0]?.time ?? 0;
    const lastTime = candles[candles.length - 1]?.time ?? firstTime;
    const toY = (price: number) => {
      const y = series?.priceToCoordinate(price);
      if (typeof y === "number") {
        return (y / containerHeight) * 100;
      }
      return ((maxPrice - price) / (maxPrice - minPrice || 1)) * 100;
    };
    const toX = (time: number) => {
      const x = chart?.timeScale().timeToCoordinate(time as UTCTimestamp);
      if (typeof x === "number") {
        return (x / containerWidth) * 100;
      }
      return ((time - firstTime) / (lastTime - firstTime || 1)) * 100;
    };

    setDrawLines(
      lines.map((line: DrawingLine) => ({
        id: line.id,
        x1: toX(line.startTime),
        y1: toY(line.startPrice),
        x2: toX(line.endTime ?? line.startTime),
        y2: toY(line.type === "horizontal" ? line.startPrice : line.endPrice ?? line.startPrice),
        color: line.color,
      }))
    );
  }, [candles, highs, lines, lows, overlayTrigger]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#7e8c91",
      },
      grid: {
        horzLines: { color: "rgba(53, 77, 82, 0.34)" },
        vertLines: { color: "rgba(53, 77, 82, 0.24)" },
      },
      rightPriceScale: {
        borderVisible: false,
        textColor: "#8da0a4",
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(84, 214, 202, 0.28)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#0f191b",
        },
        horzLine: {
          color: "rgba(84, 214, 202, 0.18)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#0f191b",
        },
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#53d8c8",
      downColor: "#f16d75",
      borderVisible: false,
      wickUpColor: "#53d8c8",
      wickDownColor: "#f16d75",
      priceLineColor: "#f16d75",
      lastValueVisible: true,
    });

    const notifyOverlay = () => setOverlayTrigger((value) => value + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(notifyOverlay);

    chartRef.current = chart;
    seriesRef.current = series;

    const resize = () => {
      if (!containerRef.current) return;
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      notifyOverlay();
    };

    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(notifyOverlay);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      lastTimeRef.current = null;
      lastSeriesKeyRef.current = null;
    };
  }, []);

  useEffect(() => {
    lastTimeRef.current = null;
    lastSeriesKeyRef.current = null;
    lastCountRef.current = 0;
    setShowNoData(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [activeMarket, interval]);

  useEffect(() => {
    if (candles.length > 0) {
      setShowNoData(false); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const timer = setTimeout(() => setShowNoData(true), 10_000);
    return () => clearTimeout(timer);
  }, [candles.length, activeMarket, interval]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || candles.length === 0) return;

    const currentKey = `${activeMarket}-${interval}`;
    const prevCount = lastCountRef.current;
    const lastTime = lastTimeRef.current;
    const isNewSeries = lastSeriesKeyRef.current !== currentKey;
    const latestCandle = candles[candles.length - 1];

    // Check if we can stream via O(1) series.update() instead of O(N) series.setData()
    const canUpdate =
      !isNewSeries &&
      lastTime !== null &&
      latestCandle &&
      candles.length >= prevCount &&
      candles.length <= prevCount + 1 &&
      (latestCandle.time as UTCTimestamp) >= lastTime;

    if (canUpdate) {
      series.update({
        time: latestCandle.time as UTCTimestamp,
        open: latestCandle.open,
        high: latestCandle.high,
        low: latestCandle.low,
        close: latestCandle.close,
      });
      lastTimeRef.current = latestCandle.time as UTCTimestamp;
      lastCountRef.current = candles.length;
      return;
    }

    // Otherwise, perform initial or full bulk rebuild via series.setData()
    const nextData = candles.map(
      (candle) =>
        ({
          time: candle.time as UTCTimestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        }) as CandlestickData
    );

    const shouldFitContent = isNewSeries || lastTime === null || (candles.length > 5 && prevCount <= 2);

    series.setData(nextData);
    lastSeriesKeyRef.current = currentKey;
    lastTimeRef.current = latestCandle.time as UTCTimestamp;
    lastCountRef.current = candles.length;

    if (shouldFitContent) {
      chartRef.current?.timeScale().fitContent();
    }
  }, [candles, activeMarket, interval]);

  const lastClose = candles[candles.length - 1]?.close;
  const previousClose = candles[candles.length - 2]?.close;
  const priceDelta =
    typeof lastClose === "number" && typeof previousClose === "number"
      ? lastClose - previousClose
      : 0;
  const isUpTick = priceDelta >= 0;

  return (
    <div
      className="relative h-full min-h-[300px] overflow-hidden rounded-[18px] border border-[#213136] bg-[#091416]"
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
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-2 border-b border-[#152327]/80 bg-[linear-gradient(180deg,rgba(8,18,20,0.94),rgba(8,18,20,0.5))] px-4 py-2 text-[11px]">
        <span className="font-medium text-[#dde5e7]">
          {activeMarket} · {interval.toUpperCase()}
        </span>
        <span
          className={cn(
            "font-mono",
            isUpTick ? "text-[#53d8c8]" : "text-[#f16d75]"
          )}
        >
          {lastClose?.toFixed(2) ?? "--"}
        </span>
        <span className="rounded-full border border-[#193338] bg-[#102125] px-2 py-0.5 text-[#8ea2a6]">
          EMA 20 {latestEma?.toFixed(2) ?? "--"}
        </span>
        <span className="rounded-full border border-[#193338] bg-[#102125] px-2 py-0.5 text-[#8ea2a6]">
          VWAP {latestVwap?.toFixed(2) ?? "--"}
        </span>
        <span className="rounded-full border border-[#193338] bg-[#102125] px-2 py-0.5 text-[#8ea2a6]">
          RSI 14 {latestRsi?.toFixed(1) ?? "--"}
        </span>
        {!connectionState || connectionState !== "connected" ? (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5",
              isReference
                ? "border-sky-500/30 bg-sky-500/8 text-sky-300"
                : "border-amber-500/30 bg-amber-500/8 text-amber-300"
            )}
          >
            {isReference ? "Reference feed" : "Feed recovering"}
          </span>
        ) : null}
      </div>

      <div ref={containerRef} className="h-full w-full" />

      {candles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#091416]/75 text-xs text-[#7e8c91]">
          {showNoData ? "No candle data available for this market." : "Waiting for candle data..."}
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
  );
}
