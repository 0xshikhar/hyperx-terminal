import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useOrderbookStore, FLUSH_WINDOW_MS, type OrderbookDelta } from "../orderbookStore";

describe("orderbookStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useOrderbookStore.getState().setMarket("BTC-USD");
  });

  afterEach(() => {
    useOrderbookStore.getState().clearTimer();
    vi.useRealTimers();
  });

  it("initializes with empty book and active market", () => {
    const state = useOrderbookStore.getState();
    expect(state.market).toBe("BTC-USD");
    expect(state.bids).toEqual([]);
    expect(state.asks).toEqual([]);
  });

  it("coalesces multiple queueBatch calls without firing subscribers on each delta", () => {
    const subscriber = vi.fn();
    const unsubscribe = useOrderbookStore.subscribe(subscriber);

    const delta1: OrderbookDelta = {
      market: "BTC-USD",
      bids: [{ price: 76000, size: 1.5 }],
      asks: [{ price: 76010, size: 2.0 }],
      timestamp: Date.now(),
    };

    const delta2: OrderbookDelta = {
      market: "BTC-USD",
      bids: [{ price: 75990, size: 3.0 }],
      asks: [{ price: 76020, size: 1.0 }],
      timestamp: Date.now() + 10,
    };

    // Push two deltas rapidly within the flush window
    useOrderbookStore.getState().queueBatch(delta1);
    useOrderbookStore.getState().queueBatch(delta2);

    // CRITICAL: queueBatch should NOT notify subscribers on each incoming raw delta!
    expect(subscriber).not.toHaveBeenCalled();

    // Fast-forward time past the 50ms flush window
    vi.advanceTimersByTime(FLUSH_WINDOW_MS);

    // Now the store should have applied the batch in a single notification
    expect(subscriber).toHaveBeenCalledTimes(1);

    const state = useOrderbookStore.getState();
    expect(state.bids).toEqual([
      { price: 76000, size: 1.5 },
      { price: 75990, size: 3.0 },
    ]);
    expect(state.asks).toEqual([
      { price: 76010, size: 2.0 },
      { price: 76020, size: 1.0 },
    ]);
    expect(state.lastBatchSize).toBe(2);

    unsubscribe();
  });

  it("correctly deletes price levels when size <= 0", () => {
    useOrderbookStore.getState().applyBatch([
      {
        market: "BTC-USD",
        bids: [
          { price: 76000, size: 1.5 },
          { price: 75900, size: 2.0 },
        ],
        asks: [
          { price: 76100, size: 1.0 },
          { price: 76200, size: 3.0 },
        ],
        timestamp: Date.now(),
      },
    ]);

    // Delete 76000 bid and update 76100 ask
    useOrderbookStore.getState().applyBatch([
      {
        market: "BTC-USD",
        bids: [{ price: 76000, size: 0 }],
        asks: [{ price: 76100, size: 4.5 }],
        timestamp: Date.now() + 10,
      },
    ]);

    const state = useOrderbookStore.getState();
    expect(state.bids).toEqual([{ price: 75900, size: 2.0 }]);
    expect(state.asks).toEqual([
      { price: 76100, size: 4.5 },
      { price: 76200, size: 3.0 },
    ]);
  });

  it("ignores deltas for non-active markets", () => {
    useOrderbookStore.getState().setMarket("BTC-USD");

    useOrderbookStore.getState().queueBatch({
      market: "ETH-USD",
      bids: [{ price: 2400, size: 10 }],
      asks: [{ price: 2405, size: 5 }],
      timestamp: Date.now(),
    });

    vi.advanceTimersByTime(FLUSH_WINDOW_MS);

    const state = useOrderbookStore.getState();
    expect(state.bids).toEqual([]);
    expect(state.asks).toEqual([]);
  });
});
