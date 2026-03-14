import { create } from "zustand";

export type OrderbookSide = "bids" | "asks";

export type OrderbookLevel = {
  price: number;
  size: number;
};

export type OrderbookDelta = {
  market: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
};

type OrderbookState = {
  market: string | null;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  pendingBatch: OrderbookDelta[];
  flushTimer: number | null;
  aggregation: number;

  setMarket: (market: string) => void;
  setAggregation: (aggregation: number) => void;
  queueBatch: (delta: OrderbookDelta) => void;
  applyBatch: (batch: OrderbookDelta[]) => void;
  clearTimer: () => void;
};

const MAX_LEVELS = 200;
const FLUSH_WINDOW_MS = 50;

function applySideDelta(
  side: OrderbookLevel[],
  updates: OrderbookLevel[],
  direction: "asc" | "desc"
) {
  const map = new Map<number, number>();
  for (const level of side) {
    map.set(level.price, level.size);
  }
  for (const update of updates) {
    if (update.size <= 0) {
      map.delete(update.price);
    } else {
      map.set(update.price, update.size);
    }
  }

  const result: OrderbookLevel[] = Array.from(map.entries()).map(
    ([price, size]) => ({ price, size })
  );
  result.sort((a, b) => (direction === "asc" ? a.price - b.price : b.price - a.price));
  return result.slice(0, MAX_LEVELS);
}

export const useOrderbookStore = create<OrderbookState>()((set, get) => ({
  market: null,
  bids: [],
  asks: [],
  pendingBatch: [],
  flushTimer: null,
  aggregation: 1,

  setMarket: (market) => {
    const timer = get().flushTimer;
    if (timer) {
      window.clearTimeout(timer);
    }
    set({ market, bids: [], asks: [], pendingBatch: [], flushTimer: null });
  },
  setAggregation: (aggregation) => set({ aggregation }),

  queueBatch: (delta) => {
    const current = get();
    if (current.market && current.market !== delta.market) return;

    set((state) => ({ pendingBatch: [...state.pendingBatch, delta] }));
    if (get().flushTimer) return;

    const timer = window.setTimeout(() => {
      const { pendingBatch } = get();
      get().applyBatch(pendingBatch);
      set({ pendingBatch: [], flushTimer: null });
    }, FLUSH_WINDOW_MS);

    set({ flushTimer: timer });
  },

  clearTimer: () => {
    const timer = get().flushTimer;
    if (timer) {
      window.clearTimeout(timer);
    }
    set({ flushTimer: null, pendingBatch: [] });
  },

  applyBatch: (batch) => {
    if (batch.length === 0) return;
    const last = batch[batch.length - 1];

    set((state) => {
      const bids = batch.reduce(
        (acc, delta) => applySideDelta(acc, delta.bids, "desc"),
        state.bids
      );
      const asks = batch.reduce(
        (acc, delta) => applySideDelta(acc, delta.asks, "asc"),
        state.asks
      );

      return { market: last.market, bids, asks };
    });
  },
}));
