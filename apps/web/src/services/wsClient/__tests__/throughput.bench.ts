import { bench, describe } from "vitest";
import { parseServerMessage } from "../fastMessageParser";
import { binarySearchPrice, type OrderbookLevel, type OrderbookDelta } from "@/store/orderbookStore";

/**
 * Throughput micro-benchmarks for the WS → store hot path.
 * Run: pnpm -C apps/web vitest bench
 *
 * These measure pure pipeline stages in isolation. Multiply the reported
 * hz by your batch window to get sustainable msg/s headroom.
 */

function makeTickerJson(market = "BTC-USD-PERP") {
  return JSON.stringify({
    type: "ticker",
    market,
    lastPrice: 76000.25,
    changePercent24h: 1.24,
    volume24h: 12_345_678,
    openInterest: 987_654,
    fundingRate: 0.0001,
    timestamp: Date.now(),
  });
}

function makeOrderbookJson(levels = 25) {
  const bids = Array.from({ length: levels }, (_, i) => ({
    price: 75950 + i,
    size: Math.random() * 5,
  }));
  const asks = Array.from({ length: levels }, (_, i) => ({
    price: 76050 + i,
    size: Math.random() * 5,
  }));
  return JSON.stringify({ type: "orderbook", market: "BTC-USD-PERP", bids, asks, timestamp: Date.now() });
}

function makeTradesJson(count = 10) {
  const trades = Array.from({ length: count }, (_, i) => ({
    id: `t-${i}`,
    side: i % 2 ? "buy" : "sell",
    price: 76000 + i,
    size: Math.random(),
    timestamp: Date.now(),
  }));
  return JSON.stringify({ type: "trades", market: "BTC-USD-PERP", trades, timestamp: Date.now() });
}

// Build a realistic 200-level book
function makeBook(): OrderbookLevel[] {
  return Array.from({ length: 200 }, (_, i) => ({ price: 75000 + i * 10, size: 1 }));
}

function makeDelta(levels = 20): OrderbookDelta {
  const bids = Array.from({ length: levels }, () => ({
    price: 75000 + Math.floor(Math.random() * 200) * 10,
    size: Math.random() < 0.15 ? 0 : Math.random() * 5, // 15% deletes
  }));
  const asks = Array.from({ length: levels }, () => ({
    price: 76000 + Math.floor(Math.random() * 200) * 10,
    size: Math.random() < 0.15 ? 0 : Math.random() * 5,
  }));
  return { market: "BTC-USD-PERP", bids, asks, timestamp: Date.now() };
}

describe("parse throughput", () => {
  const ticker = makeTickerJson();
  const book = makeOrderbookJson();
  const trades = makeTradesJson();

  bench("parseServerMessage: ticker", () => {
    parseServerMessage(ticker);
  });

  bench("parseServerMessage: orderbook (25 levels/side)", () => {
    parseServerMessage(book);
  });

  bench("parseServerMessage: trades (10 fills)", () => {
    parseServerMessage(trades);
  });
});

describe("orderbook apply throughput", () => {
  bench("binarySearchPrice in 200-level book", () => {
    const book = makeBook();
    binarySearchPrice(book, 75234, "desc");
  });

  bench("apply 20-level delta batch to 200-level book", () => {
    // Mirrors applyCoalescedSideDeltas hot loop: binarySearch + splice per update
    const next = makeBook();
    const delta = makeDelta(10);
    for (const update of delta.bids) {
      const { found, index } = binarySearchPrice(next, update.price, "desc");
      if (update.size <= 0) {
        if (found) next.splice(index, 1);
      } else if (found) {
        next[index] = { price: update.price, size: update.size };
      } else {
        next.splice(index, 0, { price: update.price, size: update.size });
      }
    }
  });
});
