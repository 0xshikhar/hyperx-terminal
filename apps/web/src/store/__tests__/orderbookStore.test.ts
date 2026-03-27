import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useOrderbookStore, binarySearchPrice, FLUSH_WINDOW_MS, type OrderbookDelta } from "../orderbookStore";

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

  describe("binarySearchPrice", () => {
    it("finds exact and insertion positions for descending bids", () => {
      const bids = [
        { price: 76000, size: 1 },
        { price: 75900, size: 2 },
        { price: 75800, size: 3 },
      ];

      // Exact matches
      expect(binarySearchPrice(bids, 76000, "desc")).toEqual({ found: true, index: 0 });
      expect(binarySearchPrice(bids, 75900, "desc")).toEqual({ found: true, index: 1 });
      expect(binarySearchPrice(bids, 75800, "desc")).toEqual({ found: true, index: 2 });

      // Insertion positions
      expect(binarySearchPrice(bids, 76100, "desc")).toEqual({ found: false, index: 0 }); // Before head
      expect(binarySearchPrice(bids, 75950, "desc")).toEqual({ found: false, index: 1 }); // Between 0 and 1
      expect(binarySearchPrice(bids, 75850, "desc")).toEqual({ found: false, index: 2 }); // Between 1 and 2
      expect(binarySearchPrice(bids, 75700, "desc")).toEqual({ found: false, index: 3 }); // After tail
    });

    it("finds exact and insertion positions for ascending asks", () => {
      const asks = [
        { price: 76100, size: 1 },
        { price: 76200, size: 2 },
        { price: 76300, size: 3 },
      ];

      // Exact matches
      expect(binarySearchPrice(asks, 76100, "asc")).toEqual({ found: true, index: 0 });
      expect(binarySearchPrice(asks, 76200, "asc")).toEqual({ found: true, index: 1 });
      expect(binarySearchPrice(asks, 76300, "asc")).toEqual({ found: true, index: 2 });

      // Insertion positions
      expect(binarySearchPrice(asks, 76050, "asc")).toEqual({ found: false, index: 0 }); // Before head
      expect(binarySearchPrice(asks, 76150, "asc")).toEqual({ found: false, index: 1 }); // Between 0 and 1
      expect(binarySearchPrice(asks, 76250, "asc")).toEqual({ found: false, index: 2 }); // Between 1 and 2
      expect(binarySearchPrice(asks, 76400, "asc")).toEqual({ found: false, index: 3 }); // After tail
    });
  });

  it("maintains strict sorted order under interleaved price insertions and updates", () => {
    useOrderbookStore.getState().applyBatch([
      {
        market: "BTC-USD",
        bids: [
          { price: 76000, size: 1.0 },
          { price: 75900, size: 2.0 },
          { price: 75700, size: 3.0 },
        ],
        asks: [
          { price: 76100, size: 1.0 },
          { price: 76300, size: 2.0 },
          { price: 76500, size: 3.0 },
        ],
        timestamp: Date.now(),
      },
    ]);

    // Insert intermediate levels and update existing levels
    useOrderbookStore.getState().applyBatch([
      {
        market: "BTC-USD",
        bids: [
          { price: 76050, size: 0.5 }, // New head
          { price: 75800, size: 1.5 }, // Middle insert
          { price: 75900, size: 5.0 }, // In-place update
          { price: 75600, size: 0.8 }, // New tail
        ],
        asks: [
          { price: 76050, size: 0.5 }, // New head
          { price: 76200, size: 1.5 }, // Middle insert
          { price: 76300, size: 9.9 }, // In-place update
          { price: 76600, size: 2.2 }, // New tail
        ],
        timestamp: Date.now() + 10,
      },
    ]);

    const state = useOrderbookStore.getState();

    // Bids must be strictly descending
    expect(state.bids.map((b) => b.price)).toEqual([76050, 76000, 75900, 75800, 75700, 75600]);
    expect(state.bids.find((b) => b.price === 75900)?.size).toBe(5.0);

    // Asks must be strictly ascending
    expect(state.asks.map((a) => a.price)).toEqual([76050, 76100, 76200, 76300, 76500, 76600]);
    expect(state.asks.find((a) => a.price === 76300)?.size).toBe(9.9);
  });
});
