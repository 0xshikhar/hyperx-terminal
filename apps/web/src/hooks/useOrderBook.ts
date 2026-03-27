import { useEffect, useMemo } from "react";
import { wsClient } from "@/services/wsClient";
import { useOrderbookStore, type OrderbookLevel } from "@/store/orderbookStore";
import { useOrdersStore } from "@/store/ordersStore";
import { useNetworkStore } from "@/store/networkStore";
import { useMarketStore } from "@/store/marketStore";
import { useRuntimeHealthStore } from "@/store/runtimeHealthStore";
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

function generateReferenceLevels(
  centerPrice: number,
  side: "bid" | "ask",
  count = 15
): OrderbookLevel[] {
  const tick = getTickSize(centerPrice);
  const levels: OrderbookLevel[] = [];
  for (let i = 1; i <= count; i++) {
    const price = side === "bid" ? centerPrice - i * tick : centerPrice + i * tick;
    const pseudoSize = Math.round((0.05 + ((Math.sin(i * 123.4) + 1) / 2) * 0.45) * 10000) / 10000;
    levels.push({ price: Number(price.toFixed(getPrecision(price))), size: pseudoSize });
  }
  return levels;
}

const aggregateLevels = (levels: OrderbookLevel[], aggregation: number, side: "bid" | "ask") => {
  if (aggregation <= 1) {
    return levels;
  }

  const map = new Map<number, number>();
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const tickSize = getTickSize(level.price);
    const bucket = roundToTick(level.price, tickSize * aggregation);
    map.set(bucket, (map.get(bucket) ?? 0) + level.size);
  }

  const rows: OrderbookLevel[] = [];
  for (const [price, size] of map.entries()) {
    rows.push({
      price: Number(price.toFixed(getPrecision(price))),
      size,
    });
  }
  rows.sort((a, b) => (side === "bid" ? b.price - a.price : a.price - b.price));
  return rows;
};

export function useOrderBook(market: string) {
  const normalizedMarket = useMemo(() => normalizeMarketSymbol(market), [market]);
  const network = useNetworkStore((s) => s.network);
  const connectionState = useRuntimeHealthStore((s) => s.connectionState);
  const getMarketFeedHealth = useRuntimeHealthStore((s) => s.getMarketFeedHealth);
  const aggregation = useOrderbookStore((state) => state.aggregation);
  const setAggregation = useOrderbookStore((state) => state.setAggregation);
  const bids = useOrderbookStore((state) => state.bids);
  const asks = useOrderbookStore((state) => state.asks);
  const openOrders = useOrdersStore((state) => state.openOrders);
  const centerPrice = useMarketStore(
    (state) =>
      state.markets.find((m) => normalizeMarketSymbol(m.symbol) === normalizedMarket)?.lastPrice ||
      76045.9
  );

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

  const sourceBids = useMemo(() => {
    if (bids.length > 0 && bids[0].price > centerPrice * 0.5) {
      return bids;
    }
    return generateReferenceLevels(centerPrice, "bid", 15);
  }, [bids, centerPrice]);

  const sourceAsks = useMemo(() => {
    if (asks.length > 0) {
      return asks;
    }
    return generateReferenceLevels(centerPrice, "ask", 15);
  }, [asks, centerPrice]);

  const aggregatedBids = useMemo(
    () => aggregateLevels(sourceBids, aggregation, "bid"),
    [aggregation, sourceBids]
  );
  const aggregatedAsks = useMemo(
    () => aggregateLevels(sourceAsks, aggregation, "ask"),
    [aggregation, sourceAsks]
  );

  const bidRows = useMemo<OrderBookRow[]>(() => {
    const limit = Math.min(100, aggregatedBids.length);
    let max = 1;
    for (let i = 0; i < limit; i++) {
      if (aggregatedBids[i].size > max) max = aggregatedBids[i].size;
    }
    const rows = new Array<OrderBookRow>(limit);
    for (let i = 0; i < limit; i++) {
      const level = aggregatedBids[i];
      rows[i] = {
        price: level.price,
        size: level.size,
        depthPercent: Math.min(100, (level.size / max) * 100),
        side: "bid",
        isMine: minePriceSet.has(level.price),
      };
    }
    return rows;
  }, [aggregatedBids, minePriceSet]);

  const askRows = useMemo<OrderBookRow[]>(() => {
    const limit = Math.min(100, aggregatedAsks.length);
    let max = 1;
    for (let i = 0; i < limit; i++) {
      if (aggregatedAsks[i].size > max) max = aggregatedAsks[i].size;
    }
    const rows = new Array<OrderBookRow>(limit);
    for (let i = 0; i < limit; i++) {
      const level = aggregatedAsks[i];
      rows[i] = {
        price: level.price,
        size: level.size,
        depthPercent: Math.min(100, (level.size / max) * 100),
        side: "ask",
        isMine: minePriceSet.has(level.price),
      };
    }
    return rows;
  }, [aggregatedAsks, minePriceSet]);

  const feedHealth = getMarketFeedHealth(normalizedMarket);
  const isReference =
    sourceBids.length === 0 &&
    sourceAsks.length === 0 &&
    (connectionState !== "connected" || !feedHealth.isFresh);

  return {
    aggregation,
    setAggregation,
    bidRows,
    askRows,
    aggregatedBids,
    aggregatedAsks,
    isReference,
  };
}
