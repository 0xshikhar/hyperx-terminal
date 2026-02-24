import { useEffect, useMemo } from "react";
import { wsClient } from "@/services/wsClient";
import { useOrderbookStore, type OrderbookLevel } from "@/store/orderbookStore";
import { useOrdersStore } from "@/store/ordersStore";
import { useNetworkStore } from "@/store/networkStore";
import { normalizeMarketSymbol } from "@hyperx/types/common";

type OrderBookRow = {
  price: number;
  size: number;
  depthPercent: number;
  side: "bid" | "ask";
  isMine: boolean;
};

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

const aggregateLevels = (levels: OrderbookLevel[], aggregation: number, side: "bid" | "ask") => {
  if (aggregation <= 1) {
    const sorted = [...levels].sort((a, b) => (side === "bid" ? b.price - a.price : a.price - b.price));
    return sorted;
  }

  const map = new Map<number, number>();
  for (const level of levels) {
    const tickSize = getTickSize(level.price);
    const bucket = roundToTick(level.price, tickSize * aggregation);
    map.set(bucket, (map.get(bucket) ?? 0) + level.size);
  }
  
  const rows: { price: number; size: number }[] = Array.from(map.entries()).map(([price, size]) => ({
    price: Number(price.toFixed(getPrecision(price))),
    size,
  }));
  rows.sort((a, b) => (side === "bid" ? b.price - a.price : a.price - b.price));
  return rows;
};

export function useOrderBook(market: string) {
  const normalizedMarket = useMemo(() => normalizeMarketSymbol(market), [market]);
  const network = useNetworkStore((s) => s.network);
  const aggregation = useOrderbookStore((state) => state.aggregation);
  const setAggregation = useOrderbookStore((state) => state.setAggregation);
  const bids = useOrderbookStore((state) => state.bids);
  const asks = useOrderbookStore((state) => state.asks);
  const openOrders = useOrdersStore((state) => state.openOrders);

  useEffect(() => {
    useOrderbookStore.getState().setMarket(normalizedMarket);
    wsClient.subscribe("orderbook", normalizedMarket, network);
    return () => {
      wsClient.unsubscribe("orderbook", normalizedMarket, network);
    };
  }, [normalizedMarket, network]);

  const minePriceSet = useMemo(() => {
    const prices = openOrders
      .filter(
        (order) =>
          normalizeMarketSymbol(order.market) === normalizedMarket &&
          !["rejected", "cancelled", "filled"].includes(order.status)
      )
      .map((order) => order.price);
    const set = new Set<number>();
    for (const price of prices) {
      const tickSize = getTickSize(price);
      const bucket = aggregation <= 1 ? price : roundToTick(price, tickSize * aggregation);
      set.add(Number(bucket.toFixed(getPrecision(price))));
    }
    return set;
  }, [openOrders, normalizedMarket, aggregation]);

  const sourceBids = bids;
  const sourceAsks = asks;

  const aggregatedBids = useMemo(
    () => aggregateLevels(sourceBids, aggregation, "bid"),
    [aggregation, sourceBids]
  );
  const aggregatedAsks = useMemo(
    () => aggregateLevels(sourceAsks, aggregation, "ask"),
    [aggregation, sourceAsks]
  );

  const bidRows = useMemo<OrderBookRow[]>(() => {
    const max = aggregatedBids.reduce((acc, level) => Math.max(acc, level.size), 0) || 1;
    return aggregatedBids.slice(0, 100).map((level) => ({
      price: level.price,
      size: level.size,
      depthPercent: Math.min(100, (level.size / max) * 100),
      side: "bid" as const,
      isMine: minePriceSet.has(level.price),
    }));
  }, [aggregatedBids, minePriceSet]);

  const askRows = useMemo<OrderBookRow[]>(() => {
    const max = aggregatedAsks.reduce((acc, level) => Math.max(acc, level.size), 0) || 1;
    return aggregatedAsks.slice(0, 100).map((level) => ({
      price: level.price,
      size: level.size,
      depthPercent: Math.min(100, (level.size / max) * 100),
      side: "ask" as const,
      isMine: minePriceSet.has(level.price),
    }));
  }, [aggregatedAsks, minePriceSet]);

  return {
    aggregation,
    setAggregation,
    bidRows,
    askRows,
    aggregatedBids,
    aggregatedAsks,
    isReference: false,
  };
}
