/**
 * Virtualized OrderBook Component
 * 
 * High-performance orderbook using react-window virtualization.
 * Renders 1000+ levels at 60fps by only showing visible rows.
 * See docs/phase1/index.md for implementation details and benchmarks.
 */

import { useMemo, useRef, useEffect, useState } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { useMarketStore } from "@/store/marketStore";
import { useOrderbookStore, type OrderbookLevel } from "@/store/orderbookStore";
import { useOrdersStore } from "@/store/ordersStore";
import { OrderBookSpread } from "./OrderBookSpread";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

const ROW_HEIGHT = 28;
const OVERSCAN_COUNT = 5;
const MAX_LEVELS = 500;

interface OrderBookRowData {
  price: number;
  size: number;
  depthPercent: number;
  side: "bid" | "ask";
  isMine: boolean;
  index: number;
  total: number;
}

function getTickSize(price: number): number {
  if (price >= 10000) return 5;
  if (price >= 1000) return 1;
  if (price >= 100) return 0.5;
  if (price >= 10) return 0.1;
  if (price >= 1) return 0.01;
  if (price >= 0.1) return 0.001;
  return 0.0001;
}

function getPrecision(price: number): number {
  if (price >= 10000) return 0;
  if (price >= 1000) return 1;
  if (price >= 100) return 2;
  if (price >= 10) return 3;
  if (price >= 1) return 4;
  if (price >= 0.1) return 5;
  return 6;
}

function roundToTick(price: number, tickSize: number): number {
  return Math.round(price / tickSize) * tickSize;
}

const aggregateLevels = (
  levels: OrderbookLevel[],
  aggregation: number,
  side: "bid" | "ask"
): OrderbookLevel[] => {
  if (aggregation <= 1) {
    const sorted = [...levels].sort((a, b) =>
      side === "bid" ? b.price - a.price : a.price - b.price
    );
    return sorted.slice(0, MAX_LEVELS);
  }

  const map = new Map<number, number>();
  for (const level of levels) {
    const tickSize = getTickSize(level.price);
    const bucket = roundToTick(level.price, tickSize * aggregation);
    map.set(bucket, (map.get(bucket) ?? 0) + level.size);
  }

  const rows: OrderbookLevel[] = Array.from(map.entries()).map(([price, size]) => ({
    price: Number(price.toFixed(getPrecision(price))),
    size,
  }));
  rows.sort((a, b) => (side === "bid" ? b.price - a.price : a.price - b.price));
  return rows.slice(0, MAX_LEVELS);
};

const OrderBookRow = ({
  price,
  size,
  depthPercent,
  side,
  isMine,
}: OrderBookRowData) => {
  const isBid = side === "bid";

  return (
    <div
      className={`
        relative flex items-center justify-between px-2 h-[${ROW_HEIGHT}px]
        font-mono text-xs cursor-pointer
        hover:bg-white/5 transition-colors
        ${isMine ? "bg-yellow-500/20" : ""}
      `}
      style={{ height: ROW_HEIGHT }}
    >
      {/* Depth bar background */}
      <div
        className={`absolute top-0 ${isBid ? "right-0" : "left-0"} h-full opacity-20`}
        style={{
          width: `${depthPercent}%`,
          backgroundColor: isBid ? "#22c55e" : "#ef4444",
        }}
      />

      {/* Content */}
      <span
        className={`relative z-10 ${
          isBid ? "text-green-400" : "text-red-400"
        } ${isMine ? "font-bold" : ""}`}
      >
        {price.toFixed(getPrecision(price))}
      </span>
      <span className="relative z-10 text-slate-300">
        {size.toLocaleString(undefined, { maximumFractionDigits: 4 })}
      </span>
    </div>
  );
};

const RowRenderer = ({
  index,
  style,
  data,
}: ListChildComponentProps<OrderBookRowData[]>) => {
  const row = data[index];
  if (!row) return null;

  return (
    <div style={style}>
      <OrderBookRow {...row} />
    </div>
  );
};

interface VirtualizedOrderBookSideProps {
  rows: OrderBookRowData[];
  side: "bid" | "ask";
  height: number;
}

const VirtualizedOrderBookSide = ({
  rows,
  side,
  height,
}: VirtualizedOrderBookSideProps) => {
  const listRef = useRef<FixedSizeList>(null);

  // Auto-scroll to center on mount
  useEffect(() => {
    if (listRef.current && rows.length > 0) {
      const middleIndex = Math.floor(rows.length / 2);
      listRef.current.scrollToItem(middleIndex, "center");
    }
  }, [rows.length]);

  return (
    <FixedSizeList
      ref={listRef}
      height={height}
      width="100%"
      itemCount={rows.length}
      itemSize={ROW_HEIGHT}
      itemData={rows}
      itemKey={(index, data) => `${data[index]?.price ?? index}-${side}`}
      overscanCount={OVERSCAN_COUNT}
      className="scrollbar-none"
      style={{
        // Hide scrollbar for cleaner look
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {RowRenderer}
    </FixedSizeList>
  );
};

const ImbalanceIndicator = ({
  bids,
  asks,
}: {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}) => {
  const totalBidVolume = bids.reduce((sum, b) => sum + b.size, 0);
  const totalAskVolume = asks.reduce((sum, a) => sum + a.size, 0);
  const totalVolume = totalBidVolume + totalAskVolume;

  if (totalVolume === 0) return null;

  const bidRatio = totalBidVolume / totalVolume;
  const imbalance = bidRatio - 0.5; // -0.5 to +0.5

  let icon = <Minus className="w-3 h-3" />;
  let colorClass = "text-slate-400";
  let label = "Neutral";

  if (imbalance > 0.1) {
    icon = <ArrowUp className="w-3 h-3" />;
    colorClass = "text-green-400";
    label = "Buy Pressure";
  } else if (imbalance < -0.1) {
    icon = <ArrowDown className="w-3 h-3" />;
    colorClass = "text-red-400";
    label = "Sell Pressure";
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${colorClass}`}>
      {icon}
      <span>{label}</span>
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${imbalance > 0 ? "bg-green-500" : "bg-red-500"}`}
          style={{
            width: `${Math.abs(imbalance * 2) * 100}%`,
            marginLeft: imbalance < 0 ? "auto" : 0,
            marginRight: imbalance > 0 ? "auto" : 0,
          }}
        />
      </div>
      <span className="text-slate-400">{Math.round(Math.abs(imbalance * 200))}%</span>
    </div>
  );
};

/**
 * Main VirtualizedOrderBook Component
 */
export function VirtualizedOrderBook() {
  const activeMarket = useMarketStore((s) => s.activeMarket);
  const aggregation = useOrderbookStore((s) => s.aggregation);
  const setAggregation = useOrderbookStore((s) => s.setAggregation);
  const rawBids = useOrderbookStore((s) => s.bids);
  const rawAsks = useOrderbookStore((s) => s.asks);
  const openOrders = useOrdersStore((s) => s.openOrders);

  const [listHeight, setListHeight] = useState(256);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate available height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const headerHeight = 80; // Approximate header + controls height
        const spreadHeight = 40; // Spread display height
        const availableHeight = rect.height - headerHeight - spreadHeight;
        // Split between bids and asks
        setListHeight(Math.floor(availableHeight / 2));
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Aggregate and prepare data
  const aggregatedBids = useMemo(
    () => aggregateLevels(rawBids, aggregation, "bid"),
    [rawBids, aggregation]
  );
  const aggregatedAsks = useMemo(
    () => aggregateLevels(rawAsks, aggregation, "ask"),
    [rawAsks, aggregation]
  );

  // Mark user's orders
  const minePriceSet = useMemo(() => {
    const prices = openOrders
      .filter((order) => order.market === activeMarket)
      .map((order) => order.price);
    const set = new Set<number>();
    for (const price of prices) {
      const tickSize = getTickSize(price);
      const bucket = aggregation <= 1 ? price : roundToTick(price, tickSize * aggregation);
      set.add(Number(bucket.toFixed(getPrecision(price))));
    }
    return set;
  }, [openOrders, activeMarket, aggregation]);

  // Prepare row data with depth calculation
  const bidRows = useMemo<OrderBookRowData[]>(() => {
    const maxDepth = aggregatedBids.reduce((acc, level) => Math.max(acc, level.size), 0) || 1;
    return aggregatedBids.map((level, index) => ({
      price: level.price,
      size: level.size,
      depthPercent: Math.min(100, (level.size / maxDepth) * 100),
      side: "bid" as const,
      isMine: minePriceSet.has(level.price),
      index,
      total: aggregatedBids.length,
    }));
  }, [aggregatedBids, minePriceSet]);

  const askRows = useMemo<OrderBookRowData[]>(() => {
    const maxDepth = aggregatedAsks.reduce((acc, level) => Math.max(acc, level.size), 0) || 1;
    return aggregatedAsks.map((level, index) => ({
      price: level.price,
      size: level.size,
      depthPercent: Math.min(100, (level.size / maxDepth) * 100),
      side: "ask" as const,
      isMine: minePriceSet.has(level.price),
      index,
      total: aggregatedAsks.length,
    }));
  }, [aggregatedAsks, minePriceSet]);

  return (
    <div
      ref={containerRef}
      className="h-full rounded-lg border border-border bg-card p-3 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">Order Book</h3>
          <p className="text-xs text-muted-foreground">{activeMarket}</p>
        </div>
        <div className="flex items-center gap-3">
          <ImbalanceIndicator bids={aggregatedBids} asks={aggregatedAsks} />
          <select
            value={aggregation}
            onChange={(e) => setAggregation(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            {[1, 2, 5, 10, 25, 50].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 border-b border-border">
        <span>Price</span>
        <span>Size</span>
      </div>

      {/* Asks (sell orders) - reversed to show highest first at bottom */}
      <div className="flex-1 overflow-hidden">
        <VirtualizedOrderBookSide
          rows={askRows}
          side="ask"
          height={listHeight}
        />
      </div>

      {/* Spread */}
      <div className="border-y border-border py-2 my-1">
        <OrderBookSpread bids={aggregatedBids} asks={aggregatedAsks} />
      </div>

      {/* Bids (buy orders) */}
      <div className="flex-1 overflow-hidden">
        <VirtualizedOrderBookSide
          rows={bidRows}
          side="bid"
          height={listHeight}
        />
      </div>

      {/* Stats footer */}
      <div className="flex justify-between text-[10px] text-muted-foreground pt-2 border-t border-border">
        <span>Levels: {aggregatedBids.length + aggregatedAsks.length}</span>
        <span>Aggregation: {aggregation}</span>
      </div>
    </div>
  );
}
