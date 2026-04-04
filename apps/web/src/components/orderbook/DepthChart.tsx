import { useState, useRef, useMemo, useEffect } from "react";
import type { OrderBookRow } from "@/hooks/useOrderBook";
import { dispatchTerminalAction } from "@/lib/terminalActions";
import { terminalAudio } from "@/lib/terminalAudio";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ZoomIn, Activity } from "lucide-react";

interface DepthChartProps {
  bidRows: OrderBookRow[];
  askRows: OrderBookRow[];
  activeMarket: string;
}

type DepthRange = 1 | 2 | 5 | 100;

interface HoverData {
  side: "bid" | "ask";
  price: number;
  size: number;
  total: number;
  notional: number;
  distancePercent: number;
  svgX: number;
  svgY: number;
}

export function DepthChart({ bidRows, askRows, activeMarket }: DepthChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 320 });
  const [depthRange, setDepthRange] = useState<DepthRange>(5);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);

  // ResizeObserver for responsive SVG dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const baseSymbol = activeMarket.split("-")[0] || "ASSET";

  // Compute Mid-Market Price
  const { midPrice, spread, spreadPercent } = useMemo(() => {
    const b = bidRows[0]?.price || 0;
    const a = askRows[0]?.price || 0;
    const mid = b > 0 && a > 0 ? (b + a) / 2 : b || a || 1;
    const s = a > 0 && b > 0 ? Math.max(0, a - b) : 0;
    const sPct = mid > 0 ? (s / mid) * 100 : 0;
    return { midPrice: mid, spread: s, spreadPercent: sPct };
  }, [bidRows, askRows]);

  // Filter levels based on depth range (±1%, ±2%, ±5%, or Full 100%)
  const { filteredBids, filteredAsks, minPrice, maxPrice, maxVolume } = useMemo(() => {
    let bids = bidRows;
    let asks = askRows;

    if (depthRange < 100 && midPrice > 0) {
      const minP = midPrice * (1 - depthRange / 100);
      const maxP = midPrice * (1 + depthRange / 100);
      bids = bidRows.filter((r) => r.price >= minP);
      asks = askRows.filter((r) => r.price <= maxP);
    }

    // Sort bids ascending for left-to-right drawing (lowest bid -> best bid)
    const sortedBids = bids.slice().reverse();
    const sortedAsks = asks.slice(); // lowest ask -> highest ask

    const pMin = sortedBids[0]?.price || midPrice * 0.98;
    const pMax = sortedAsks[sortedAsks.length - 1]?.price || midPrice * 1.02;

    const bidMaxTotal = sortedBids[0]?.total || 1;
    const askMaxTotal = sortedAsks[sortedAsks.length - 1]?.total || 1;
    const maxVol = Math.max(bidMaxTotal, askMaxTotal) * 1.08;

    return {
      filteredBids: sortedBids,
      filteredAsks: sortedAsks,
      minPrice: pMin,
      maxPrice: pMax,
      maxVolume: maxVol,
    };
  }, [bidRows, askRows, depthRange, midPrice]);

  const { width, height } = dimensions;
  const paddingBottom = 30;
  const paddingTop = 15;
  const plotHeight = Math.max(10, height - paddingBottom - paddingTop);

  // Coordinate projection functions
  const scaleX = (price: number) => {
    if (maxPrice === minPrice) return width / 2;
    return Math.max(0, Math.min(width, ((price - minPrice) / (maxPrice - minPrice)) * width));
  };

  const scaleY = (vol: number) => {
    const ratio = Math.min(1, Math.max(0, vol / maxVolume));
    return height - paddingBottom - ratio * plotHeight;
  };

  // Build SVG Paths for Bids (left slope) and Asks (right slope)
  const { bidPath, askPath, bidLine, askLine } = useMemo(() => {
    if (filteredBids.length === 0 && filteredAsks.length === 0) {
      return { bidPath: "", askPath: "", bidLine: "", askLine: "" };
    }

    const midX = scaleX(midPrice);
    const baselineY = height - paddingBottom;

    // ── Bids Path (Start from left baseline -> rise -> mid baseline) ──
    let bLine = "";
    let bFill = "";
    if (filteredBids.length > 0) {
      const firstX = scaleX(filteredBids[0].price);
      const firstY = scaleY(filteredBids[0].total);
      bLine = `M ${firstX} ${firstY}`;
      bFill = `M ${firstX} ${baselineY} L ${firstX} ${firstY}`;

      for (let i = 1; i < filteredBids.length; i++) {
        const x = scaleX(filteredBids[i].price);
        const y = scaleY(filteredBids[i].total);
        bLine += ` L ${x} ${y}`;
        bFill += ` L ${x} ${y}`;
      }

      // Close to midPrice baseline
      bLine += ` L ${midX} ${scaleY(0)}`;
      bFill += ` L ${midX} ${scaleY(0)} L ${midX} ${baselineY} Z`;
    }

    // ── Asks Path (Start from mid baseline -> rise -> right baseline) ──
    let aLine = "";
    let aFill = "";
    if (filteredAsks.length > 0) {
      const firstX = scaleX(filteredAsks[0].price);
      const firstY = scaleY(filteredAsks[0].total);
      aLine = `M ${midX} ${scaleY(0)} L ${firstX} ${firstY}`;
      aFill = `M ${midX} ${baselineY} L ${midX} ${scaleY(0)} L ${firstX} ${firstY}`;

      for (let i = 1; i < filteredAsks.length; i++) {
        const x = scaleX(filteredAsks[i].price);
        const y = scaleY(filteredAsks[i].total);
        aLine += ` L ${x} ${y}`;
        aFill += ` L ${x} ${y}`;
      }

      const lastX = scaleX(filteredAsks[filteredAsks.length - 1].price);
      aFill += ` L ${lastX} ${baselineY} Z`;
    }

    return { bidPath: bFill, askPath: aFill, bidLine: bLine, askLine: aLine };
  }, [filteredBids, filteredAsks, minPrice, maxPrice, maxVolume, width, height]);

  // Handle Mouse Hover / Crosshair Tracking
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const targetPrice = minPrice + (mouseX / width) * (maxPrice - minPrice);

    if (targetPrice <= midPrice) {
      // Find nearest bid
      let nearest: OrderBookRow | null = null;
      let minDiff = Infinity;
      for (const b of filteredBids) {
        const diff = Math.abs(b.price - targetPrice);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = b;
        }
      }
      if (nearest) {
        setHoverData({
          side: "bid",
          price: nearest.price,
          size: nearest.size,
          total: nearest.total,
          notional: nearest.price * nearest.total,
          distancePercent: midPrice > 0 ? ((nearest.price - midPrice) / midPrice) * 100 : 0,
          svgX: scaleX(nearest.price),
          svgY: scaleY(nearest.total),
        });
      }
    } else {
      // Find nearest ask
      let nearest: OrderBookRow | null = null;
      let minDiff = Infinity;
      for (const a of filteredAsks) {
        const diff = Math.abs(a.price - targetPrice);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = a;
        }
      }
      if (nearest) {
        setHoverData({
          side: "ask",
          price: nearest.price,
          size: nearest.size,
          total: nearest.total,
          notional: nearest.price * nearest.total,
          distancePercent: midPrice > 0 ? ((nearest.price - midPrice) / midPrice) * 100 : 0,
          svgX: scaleX(nearest.price),
          svgY: scaleY(nearest.total),
        });
      }
    }
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  // 1-Click order ticket prefill on click
  const handleClick = () => {
    if (!hoverData) return;
    terminalAudio.playClick();
    const orderSide = hoverData.side === "bid" ? "buy" : "sell";
    dispatchTerminalAction({
      type: "prefill-order",
      price: hoverData.price,
      size: Number(hoverData.total.toFixed(4)),
      side: orderSide,
    });
    toast.success(
      `⚡ Pre-filled Limit ${orderSide.toUpperCase()}: ${hoverData.total.toFixed(4)} ${baseSymbol} @ $${hoverData.price.toFixed(2)}`
    );
  };

  return (
    <div
      ref={containerRef}
      data-testid="depth-chart-container"
      className="relative flex h-full w-full flex-col select-none overflow-hidden bg-[#081214]"
    >
      {/* ── Top Depth Controls Bar ── */}
      <div className="flex items-center justify-between border-b border-[#142328] bg-[#091518] px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 font-mono text-[11px] font-semibold text-[#8ea2a6]">
            <Activity className="h-3.5 w-3.5 text-[#22d3ee]" />
            Mid: <span className="text-white">${midPrice.toFixed(2)}</span>
          </span>
          <span className="text-[10px] text-[#556b73]">
            Spread: ${spread.toFixed(2)} ({spreadPercent.toFixed(3)}%)
          </span>
        </div>

        {/* Zoom / Range Selector */}
        <div className="flex items-center gap-1">
          <ZoomIn className="h-3 w-3 text-[#556b73]" />
          {([1, 2, 5, 100] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                terminalAudio.playClick();
                setDepthRange(r);
              }}
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors cursor-pointer",
                depthRange === r
                  ? "bg-[#22d3ee]/20 text-[#22d3ee] font-bold border border-[#22d3ee]/40"
                  : "text-[#64748b] hover:text-white"
              )}
            >
              {r === 100 ? "Full" : `±${r}%`}
            </button>
          ))}
        </div>
      </div>

      {/* ── SVG Depth Chart Canvas ── */}
      <div className="relative flex-1 min-h-0 w-full cursor-crosshair">
        <svg
          data-testid="depth-chart-svg"
          width={width}
          height={height - 35}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          className="h-full w-full"
        >
          <defs>
            {/* Emerald Gradient for Bids */}
            <linearGradient id="bidGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d084" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#00d084" stopOpacity="0.05" />
            </linearGradient>

            {/* Crimson Gradient for Asks */}
            <linearGradient id="askGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff4757" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ff4757" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={0}
            y1={scaleY(maxVolume * 0.5)}
            x2={width}
            y2={scaleY(maxVolume * 0.5)}
            stroke="#152327"
            strokeDasharray="3 3"
          />
          <line
            x1={0}
            y1={scaleY(maxVolume * 0.75)}
            x2={width}
            y2={scaleY(maxVolume * 0.75)}
            stroke="#152327"
            strokeDasharray="3 3"
          />

          {/* Mid-Market Price Centerline */}
          <line
            x1={scaleX(midPrice)}
            y1={paddingTop}
            x2={scaleX(midPrice)}
            y2={height - paddingBottom}
            stroke="#22d3ee"
            strokeOpacity="0.4"
            strokeDasharray="4 4"
          />

          {/* Bids Fill & Line */}
          {bidPath && <path d={bidPath} fill="url(#bidGradient)" />}
          {bidLine && <path d={bidLine} fill="none" stroke="#00d084" strokeWidth="2" />}

          {/* Asks Fill & Line */}
          {askPath && <path d={askPath} fill="url(#askGradient)" />}
          {askLine && <path d={askLine} fill="none" stroke="#ff4757" strokeWidth="2" />}

          {/* Price Axis Labels (Bottom) */}
          <text
            x={10}
            y={height - paddingBottom - 10}
            fill="#00d084"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="start"
          >
            ${minPrice.toFixed(2)}
          </text>

          <text
            x={scaleX(midPrice)}
            y={height - paddingBottom - 10}
            fill="#22d3ee"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="middle"
          >
            ${midPrice.toFixed(2)}
          </text>

          <text
            x={width - 10}
            y={height - paddingBottom - 10}
            fill="#ff4757"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="end"
          >
            ${maxPrice.toFixed(2)}
          </text>

          {/* Crosshair & Snap Point */}
          {hoverData && (
            <>
              {/* Vertical Crosshair */}
              <line
                x1={hoverData.svgX}
                y1={paddingTop}
                x2={hoverData.svgX}
                y2={height - paddingBottom}
                stroke="#c8d4d7"
                strokeDasharray="2 2"
                strokeWidth="1"
              />

              {/* Horizontal Crosshair */}
              <line
                x1={0}
                y1={hoverData.svgY}
                x2={width}
                y2={hoverData.svgY}
                stroke="#c8d4d7"
                strokeDasharray="2 2"
                strokeWidth="1"
              />

              {/* Snap Point Indicator */}
              <circle
                cx={hoverData.svgX}
                cy={hoverData.svgY}
                r="4"
                fill={hoverData.side === "bid" ? "#00d084" : "#ff4757"}
                stroke="#081214"
                strokeWidth="2"
              />
              <circle
                cx={hoverData.svgX}
                cy={hoverData.svgY}
                r="8"
                fill="none"
                stroke={hoverData.side === "bid" ? "#00d084" : "#ff4757"}
                strokeOpacity="0.5"
                strokeWidth="1.5"
                className="animate-ping"
              />
            </>
          )}
        </svg>

        {/* ── High-Contrast Cyberpunk Hover Tooltip ── */}
        {hoverData && (
          <div
            data-testid="depth-chart-tooltip"
            style={{
              position: "absolute",
              left: Math.min(Math.max(10, hoverData.svgX - 85), width - 180),
              top: Math.max(10, hoverData.svgY - 110),
              pointerEvents: "none",
            }}
            className="z-30 rounded-lg border border-[#1b3f49] bg-[#071418]/95 p-2 shadow-2xl backdrop-blur-md text-[11px] font-mono leading-tight"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#142930] pb-1 mb-1">
              <span
                className={cn(
                  "font-bold uppercase tracking-wider text-[10px]",
                  hoverData.side === "bid" ? "text-[#00d084]" : "text-[#ff4757]"
                )}
              >
                {hoverData.side === "bid" ? "🟢 Buy Depth" : "🔴 Sell Depth"}
              </span>
              <span className="text-[#8ea2a6]">
                {hoverData.distancePercent >= 0 ? "+" : ""}
                {hoverData.distancePercent.toFixed(2)}%
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="flex justify-between gap-3">
                <span className="text-[#64748b]">Price:</span>
                <span className="font-semibold text-white">${hoverData.price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#64748b]">Cumul. Size:</span>
                <span className="text-[#c8d4d7]">
                  {hoverData.total.toFixed(4)} {baseSymbol}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#64748b]">Notional Wall:</span>
                <span className="text-[#22d3ee] font-medium">
                  ${hoverData.notional.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            <div className="mt-1 pt-1 border-t border-[#122327] text-[9px] text-[#556b73] text-center">
              Click to prefill limit ticket
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
