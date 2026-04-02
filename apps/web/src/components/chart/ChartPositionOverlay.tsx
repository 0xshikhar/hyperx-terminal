import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, IPriceLine, ISeriesApi } from "lightweight-charts";
import { cn } from "@/lib/utils";
import { usePositions } from "@/hooks/usePositions";
import { useIsPaperTrading } from "@/hooks/useIsPaperTrading";
import { usePaperTradingStore } from "@/store/paperTradingStore";
import { useOrdersStore, type Order } from "@/store/ordersStore";
import type { Position } from "@/store/positionsStore";
import { X, AlertTriangle, Percent } from "lucide-react";
import { toast } from "sonner";
import { terminalAudio } from "@/lib/terminalAudio";
import { PartialCloseModal } from "@/components/positions/PartialCloseModal";

type ChartPositionOverlayProps = {
  market: string;
  series: ISeriesApi<"Candlestick"> | null;
  chart: IChartApi | null;
  overlayTrigger?: number;
};

interface PositionCoordinate {
  position: Position;
  entryY: number | null;
  liqY: number | null;
  liqPrice: number;
}

interface OrderCoordinate {
  order: Order;
  orderY: number | null;
  price: number;
}

export function ChartPositionOverlay({
  market,
  series,
  chart,
  overlayTrigger = 0,
}: ChartPositionOverlayProps) {
  const isPaperTrading = useIsPaperTrading();
  const { positions: realPositions } = usePositions();
  const paperPositions = usePaperTradingStore((s) => s.positions);
  const closePaperPosition = usePaperTradingStore((s) => s.closePosition);

  const realOrders = useOrdersStore((s) => s.openOrders);
  const markOrderCancelled = useOrdersStore((s) => s.markOrderCancelled);
  const paperOrders = usePaperTradingStore((s) => s.openOrders);
  const cancelPaperOrder = usePaperTradingStore((s) => s.cancelOrder);

  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const [coordsVersion, setCoordsVersion] = useState(0);
  const [partialModalOpen, setPartialModalOpen] = useState(false);
  const [partialPosition, setPartialPosition] = useState<Position | null>(null);

  const handlePartialClose = (pos: Position) => {
    terminalAudio.playClick();
    setPartialPosition(pos);
    setPartialModalOpen(true);
  };

  // Active positions for current market
  const activePositions = useMemo(() => {
    const all = isPaperTrading ? paperPositions : realPositions;
    return all.filter((p) => p.market === market);
  }, [isPaperTrading, paperPositions, realPositions, market]);

  // Active open limit/stop orders for current market
  const activeOrders = useMemo(() => {
    const all = isPaperTrading ? paperOrders : realOrders;
    return all.filter(
      (o) =>
        o.market === market &&
        (o.status === "open" || o.status === "pending" || !o.status) &&
        Number(o.price) > 0
    );
  }, [isPaperTrading, paperOrders, realOrders, market]);

  // Synchronize Lightweight-Charts native price lines
  useEffect(() => {
    if (!series) return;

    const currentLineKeys = new Set<string>();
    const linesMap = priceLinesRef.current;

    // 1. Position Entry and Liquidation Price Lines
    for (const position of activePositions) {
      const entryKey = `pos-entry-${position.id}`;
      currentLineKeys.add(entryKey);

      const isLong = position.side === "long";
      const entryColor = isLong ? "#00d084" : "#ff4757";

      if (!linesMap.has(entryKey)) {
        try {
          const line = series.createPriceLine({
            price: position.entryPrice,
            color: entryColor,
            lineWidth: 2,
            lineStyle: 0, // Solid
            axisLabelVisible: true,
            title: `${position.side.toUpperCase()} ${position.size} @ $${position.entryPrice.toLocaleString()}`,
          });
          linesMap.set(entryKey, line);
        } catch {}
      } else {
        linesMap.get(entryKey)?.applyOptions({
          price: position.entryPrice,
          color: entryColor,
          title: `${position.side.toUpperCase()} ${position.size} @ $${position.entryPrice.toLocaleString()}`,
        });
      }

      // Liquidation Price Line
      const liqPrice =
        position.side === "long"
          ? Math.max(0, position.entryPrice * (1 - 0.9 / (position.leverage || 10)))
          : position.entryPrice * (1 + 0.9 / (position.leverage || 10));

      const liqKey = `pos-liq-${position.id}`;
      currentLineKeys.add(liqKey);

      if (!linesMap.has(liqKey)) {
        try {
          const line = series.createPriceLine({
            price: liqPrice,
            color: "#f59e0b",
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: `LIQ $${liqPrice.toFixed(2)}`,
          });
          linesMap.set(liqKey, line);
        } catch {}
      } else {
        linesMap.get(liqKey)?.applyOptions({
          price: liqPrice,
          title: `LIQ $${liqPrice.toFixed(2)}`,
        });
      }
    }

    // 2. Open Orders Price Lines
    for (const order of activeOrders) {
      const orderPrice = Number(order.price);
      if (orderPrice <= 0) continue;

      const orderKey = `order-${order.id}`;
      currentLineKeys.add(orderKey);

      const isBuy = order.side === "buy";
      const orderColor = isBuy ? "#38bdf8" : "#fb7185";

      if (!linesMap.has(orderKey)) {
        try {
          const line = series.createPriceLine({
            price: orderPrice,
            color: orderColor,
            lineWidth: 1,
            lineStyle: 1, // Dotted
            axisLabelVisible: true,
            title: `${order.side.toUpperCase()} ${order.type?.toUpperCase() || "LIMIT"} ${order.size}`,
          });
          linesMap.set(orderKey, line);
        } catch {}
      } else {
        linesMap.get(orderKey)?.applyOptions({
          price: orderPrice,
          color: orderColor,
          title: `${order.side.toUpperCase()} ${order.type?.toUpperCase() || "LIMIT"} ${order.size}`,
        });
      }
    }

    // 3. Remove stale lines
    for (const [key, line] of Array.from(linesMap.entries())) {
      if (!currentLineKeys.has(key)) {
        try {
          series.removePriceLine(line);
        } catch {}
        linesMap.delete(key);
      }
    }

    return () => {
      // Clean up lines when unmounting or switching market
      for (const [, line] of linesMap.entries()) {
        try {
          series.removePriceLine(line);
        } catch {}
      }
      linesMap.clear();
    };
  }, [series, activePositions, activeOrders, market]);

  // Trigger coordinate re-calculation when chart pans, zooms, or ticks
  useEffect(() => {
    setCoordsVersion((v) => v + 1);
  }, [overlayTrigger, activePositions, activeOrders, series]);

  // Compute live Y pixel coordinates for interactive chips
  const positionCoords: PositionCoordinate[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    coordsVersion;
    if (!series) return [];

    return activePositions.map((pos) => {
      const entryY = series.priceToCoordinate(pos.entryPrice);
      const liqPrice =
        pos.side === "long"
          ? Math.max(0, pos.entryPrice * (1 - 0.9 / (pos.leverage || 10)))
          : pos.entryPrice * (1 + 0.9 / (pos.leverage || 10));
      const liqY = series.priceToCoordinate(liqPrice);

      return {
        position: pos,
        entryY: typeof entryY === "number" ? entryY : null,
        liqY: typeof liqY === "number" ? liqY : null,
        liqPrice,
      };
    });
  }, [series, activePositions, coordsVersion]);

  const orderCoords: OrderCoordinate[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    coordsVersion;
    if (!series) return [];

    return activeOrders.map((ord) => {
      const price = Number(ord.price);
      const orderY = series.priceToCoordinate(price);
      return {
        order: ord,
        orderY: typeof orderY === "number" ? orderY : null,
        price,
      };
    });
  }, [series, activeOrders, coordsVersion]);

  // Handlers for 1-click execution right from the chart
  const handleClosePosition = (pos: Position) => {
    terminalAudio.playClick();
    if (isPaperTrading) {
      const { realizedPnl } = closePaperPosition(pos.id);
      terminalAudio.playOrderFill();
      toast.success(
        `Closed ${pos.side.toUpperCase()} ${pos.market} (${realizedPnl >= 0 ? "+" : ""}$${realizedPnl.toFixed(2)})`
      );
    } else {
      toast.info(`Requesting market close for ${pos.market}...`);
    }
  };

  const handleCancelOrder = (ord: Order) => {
    terminalAudio.playClick();
    if (isPaperTrading) {
      cancelPaperOrder(ord.id);
      terminalAudio.playOrderCancel();
      toast.info(`Cancelled ${ord.side.toUpperCase()} limit order`);
    } else {
      markOrderCancelled(ord.id);
      terminalAudio.playOrderCancel();
      toast.info(`Cancel requested for order ${ord.id.slice(0, 8)}`);
    }
  };

  if (activePositions.length === 0 && activeOrders.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none">
      {/* ── Position Entry Chips ── */}
      {positionCoords.map(({ position, entryY }) => {
        if (entryY === null || entryY < 32 || entryY > (chart ? 10000 : 0)) return null;
        const isLong = position.side === "long";

        return (
          <div
            key={`chip-pos-${position.id}`}
            style={{ top: `${entryY - 14}px` }}
            className="pointer-events-auto absolute right-16 z-30 flex items-center gap-2 rounded border border-[#1e3b43] bg-[#071619]/95 px-2.5 py-1 text-[11px] font-mono shadow-xl backdrop-blur-md transition-all hover:border-[#22d3ee]/60"
          >
            <span
              className={cn(
                "font-bold uppercase tracking-wider",
                isLong ? "text-[#00d084]" : "text-[#ff4757]"
              )}
            >
              {position.side} {position.size.toFixed(4)}
            </span>
            <span className="text-[#8ea2a6]">
              @ ${position.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span
              className={cn(
                "font-bold ml-1 tabular-nums",
                position.pnl >= 0 ? "text-[#00d084]" : "text-[#ff4757]"
              )}
            >
              {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)} ({position.pnlPercent >= 0 ? "+" : ""}{position.pnlPercent.toFixed(2)}%)
            </span>
            <button
              onClick={() => handlePartialClose(position)}
              className="ml-1.5 flex h-4 items-center gap-0.5 rounded bg-[#22d3ee]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#22d3ee] hover:bg-[#22d3ee]/35 transition-colors cursor-pointer"
              title="Partial close / scale out (25%, 50%, 75%, 100%)"
            >
              <Percent className="h-2.5 w-2.5" />
              %
            </button>
            <button
              onClick={() => handleClosePosition(position)}
              className="ml-1 flex h-4 items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 hover:bg-rose-500/30 hover:text-white transition-colors cursor-pointer"
              title="Close position at market"
            >
              <X className="h-2.5 w-2.5" />
              Close
            </button>
          </div>
        );
      })}

      {/* ── Position Liquidation Chips ── */}
      {positionCoords.map(({ position, liqY, liqPrice }) => {
        if (liqY === null || liqY < 32 || liqY > (chart ? 10000 : 0)) return null;

        return (
          <div
            key={`chip-liq-${position.id}`}
            style={{ top: `${liqY - 12}px` }}
            className="pointer-events-auto absolute right-16 z-20 flex items-center gap-1.5 rounded border border-amber-500/40 bg-[#1c1406]/95 px-2 py-0.5 text-[10px] font-mono text-amber-300 shadow-lg backdrop-blur-sm"
            title="Estimated liquidation price"
          >
            <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
            <span className="font-bold">LIQ:</span>
            <span className="tabular-nums">
              ${liqPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        );
      })}

      {/* ── Open Order Chips ── */}
      {orderCoords.map(({ order, orderY, price }) => {
        if (orderY === null || orderY < 32 || orderY > (chart ? 10000 : 0)) return null;
        const isBuy = order.side === "buy";

        return (
          <div
            key={`chip-ord-${order.id}`}
            style={{ top: `${orderY - 13}px` }}
            className="pointer-events-auto absolute right-16 z-20 flex items-center gap-2 rounded border border-[#1b3540] bg-[#08181f]/95 px-2 py-0.5 text-[10px] font-mono shadow-lg backdrop-blur-sm transition-all hover:border-[#38bdf8]/50"
          >
            <span
              className={cn(
                "font-bold uppercase tracking-wider",
                isBuy ? "text-[#38bdf8]" : "text-[#fb7185]"
              )}
            >
              {order.side} {order.type || "LIMIT"}
            </span>
            <span className="text-white tabular-nums font-semibold">{Number(order.size).toFixed(4)}</span>
            <span className="text-[#8ea2a6] tabular-nums">
              @ ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <button
              onClick={() => handleCancelOrder(order)}
              className="ml-1 flex h-4 items-center gap-0.5 rounded bg-[#13252d] px-1 text-[9px] text-[#8ea2a6] hover:bg-rose-500/20 hover:text-rose-300 transition-colors cursor-pointer"
              title="Cancel limit order"
            >
              <X className="h-2.5 w-2.5" />
              Cancel
            </button>
          </div>
        );
      })}

      {/* Partial Close Modal */}
      <PartialCloseModal
        position={partialPosition}
        open={partialModalOpen}
        onOpenChange={setPartialModalOpen}
      />
    </div>
  );
}
