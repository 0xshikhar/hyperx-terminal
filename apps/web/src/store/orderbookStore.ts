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
  flushTimer: ReturnType<typeof setTimeout> | number | null;
  aggregation: number;
  pendingBatchDepth: number;
  lastBatchSize: number;
  lastAppliedAt: number | null;
  lastApplyDurationMs: number | null;

  setMarket: (market: string) => void;
  setAggregation: (aggregation: number) => void;
  queueBatch: (delta: OrderbookDelta) => void;
  applyBatch: (batch: OrderbookDelta[]) => void;
  clearTimer: () => void;
};

const MAX_LEVELS = 200;
export const FLUSH_WINDOW_MS = 50;

/**
 * Coalesces an entire batch of deltas against the current book side in a single pass.
 * Instead of creating M Maps and sorting M times for M deltas, this creates exactly 1 Map
 * and performs 1 sort per side per flush window.
 */
function applyCoalescedSideDeltas(
  currentSide: OrderbookLevel[],
  batch: OrderbookDelta[],
  side: "bids" | "asks",
  direction: "asc" | "desc"
): OrderbookLevel[] {
  const map = new Map<number, number>();

  // 1. Seed existing levels
  for (let i = 0; i < currentSide.length; i++) {
    const level = currentSide[i];
    map.set(level.price, level.size);
  }

  // 2. Apply all deltas in the batch sequentially into the single Map
  for (let b = 0; b < batch.length; b++) {
    const updates = batch[b][side];
    for (let u = 0; u < updates.length; u++) {
      const update = updates[u];
      if (update.size <= 0) {
        map.delete(update.price);
      } else {
        map.set(update.price, update.size);
      }
    }
  }

  // 3. Extract and sort once
  const result: OrderbookLevel[] = [];
  for (const [price, size] of map.entries()) {
    result.push({ price, size });
  }

  result.sort((a, b) => (direction === "asc" ? a.price - b.price : b.price - a.price));
  return result.length > MAX_LEVELS ? result.slice(0, MAX_LEVELS) : result;
}

// Ingestion buffer and timer held outside of reactive state to eliminate subscriber thrashing
let internalPendingDeltas: OrderbookDelta[] = [];
let internalFlushTimer: ReturnType<typeof setTimeout> | null = null;

export const useOrderbookStore = create<OrderbookState>()((set, get) => ({
  market: null,
  bids: [],
  asks: [],
  pendingBatch: [],
  flushTimer: null,
  aggregation: 1,
  pendingBatchDepth: 0,
  lastBatchSize: 0,
  lastAppliedAt: null,
  lastApplyDurationMs: null,

  setMarket: (market) => {
    if (internalFlushTimer) {
      clearTimeout(internalFlushTimer);
      internalFlushTimer = null;
    }
    internalPendingDeltas = [];

    set({
      market,
      bids: [],
      asks: [],
      pendingBatch: [],
      flushTimer: null,
      pendingBatchDepth: 0,
      lastBatchSize: 0,
      lastAppliedAt: null,
      lastApplyDurationMs: null,
    });
  },

  setAggregation: (aggregation) => set({ aggregation }),

  queueBatch: (delta) => {
    const currentMarket = get().market;
    if (currentMarket && currentMarket !== delta.market) return;

    // Buffer internally: O(1) push, zero object spreads, ZERO React store notifications
    internalPendingDeltas.push(delta);

    if (internalFlushTimer) return;

    internalFlushTimer = setTimeout(() => {
      internalFlushTimer = null;
      const batch = internalPendingDeltas;
      internalPendingDeltas = [];

      if (batch.length === 0) return;

      const startedAt = performance.now();
      const last = batch[batch.length - 1];

      // Single-pass coalesced delta apply
      const state = get();
      const bids = applyCoalescedSideDeltas(state.bids, batch, "bids", "desc");
      const asks = applyCoalescedSideDeltas(state.asks, batch, "asks", "asc");
      const durationMs = performance.now() - startedAt;

      // Exactly ONE store mutation per flush window
      set({
        market: last.market,
        bids,
        asks,
        pendingBatch: [],
        pendingBatchDepth: 0,
        flushTimer: null,
        lastBatchSize: batch.length,
        lastAppliedAt: Date.now(),
        lastApplyDurationMs: durationMs,
      });
    }, FLUSH_WINDOW_MS);
  },

  clearTimer: () => {
    if (internalFlushTimer) {
      clearTimeout(internalFlushTimer);
      internalFlushTimer = null;
    }
    internalPendingDeltas = [];
    set({ flushTimer: null, pendingBatch: [], pendingBatchDepth: 0 });
  },

  applyBatch: (batch) => {
    if (batch.length === 0) return;
    const last = batch[batch.length - 1];
    const startedAt = performance.now();

    const state = get();
    const bids = applyCoalescedSideDeltas(state.bids, batch, "bids", "desc");
    const asks = applyCoalescedSideDeltas(state.asks, batch, "asks", "asc");
    const durationMs = performance.now() - startedAt;

    set({
      market: last.market,
      bids,
      asks,
      lastBatchSize: batch.length,
      lastAppliedAt: Date.now(),
      lastApplyDurationMs: durationMs,
    });
  },
}));
