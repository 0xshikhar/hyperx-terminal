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
 * Binary search to locate a price level in an already-sorted orderbook side in O(log N) time.
 * - "desc": sorted descending (highest price at index 0, e.g. bids: [76000, 75990, 75980])
 * - "asc":  sorted ascending (lowest price at index 0, e.g. asks: [76010, 76020, 76030])
 *
 * Returns { found: true, index } if price matches an existing level.
 * Returns { found: false, index } where `index` is the exact insertion position.
 */
export function binarySearchPrice(
  levels: OrderbookLevel[],
  targetPrice: number,
  direction: "asc" | "desc"
): { found: boolean; index: number } {
  let low = 0;
  let high = levels.length - 1;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    const midPrice = levels[mid].price;

    if (midPrice === targetPrice) {
      return { found: true, index: mid };
    }

    const isBefore = direction === "desc" ? midPrice < targetPrice : midPrice > targetPrice;
    if (isBefore) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return { found: false, index: low };
}

/**
 * Applies a batch of orderbook deltas to an already-sorted orderbook side using O(log N)
 * binary search insertion/mutation, completely eliminating Map allocations and O(N log N)
 * full array sorts on the hot path.
 */
function applyCoalescedSideDeltas(
  currentSide: OrderbookLevel[],
  batch: OrderbookDelta[],
  side: "bids" | "asks",
  direction: "asc" | "desc"
): OrderbookLevel[] {
  let hasUpdates = false;
  for (let b = 0; b < batch.length; b++) {
    if (batch[b][side].length > 0) {
      hasUpdates = true;
      break;
    }
  }
  if (!hasUpdates) return currentSide;

  // Clone current side array once
  const next = currentSide.slice();

  for (let b = 0; b < batch.length; b++) {
    const updates = batch[b][side];
    for (let u = 0; u < updates.length; u++) {
      const update = updates[u];
      const { found, index } = binarySearchPrice(next, update.price, direction);

      if (update.size <= 0) {
        if (found) {
          next.splice(index, 1);
        }
      } else {
        if (found) {
          next[index] = { price: update.price, size: update.size };
        } else {
          next.splice(index, 0, { price: update.price, size: update.size });
        }
      }
    }
  }

  if (next.length > MAX_LEVELS) {
    next.length = MAX_LEVELS;
  }

  return next;
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
