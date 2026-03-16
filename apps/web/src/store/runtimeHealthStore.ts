import { create } from "zustand";
import type { ConnectionState } from "@/services/wsClient";

type FeedTimestamps = {
  orderbook?: number;
  trades?: number;
  ticker?: number;
  status?: number;
};

type RuntimeHealthState = {
  connectionState: ConnectionState;
  reconnectCount: number;
  lastConnectionChangeAt: number | null;
  lastPongAt: number | null;
  feedsByMarket: Record<string, FeedTimestamps>;
  setConnectionState: (state: ConnectionState) => void;
  recordReconnect: () => void;
  recordPong: (timestamp?: number) => void;
  recordFeedEvent: (
    market: string,
    feed: keyof FeedTimestamps,
    timestamp?: number
  ) => void;
  getMarketFeedHealth: (market: string) => {
    isFresh: boolean;
    ageMs: number | null;
    staleReason: "disconnected" | "silent_feed" | null;
  };
};

const FEED_STALE_AFTER_MS = 10_000;

export const useRuntimeHealthStore = create<RuntimeHealthState>()((set, get) => ({
  connectionState: "disconnected",
  reconnectCount: 0,
  lastConnectionChangeAt: null,
  lastPongAt: null,
  feedsByMarket: {},

  setConnectionState: (state) =>
    set({
      connectionState: state,
      lastConnectionChangeAt: Date.now(),
    }),

  recordReconnect: () =>
    set((current) => ({
      reconnectCount: current.reconnectCount + 1,
      lastConnectionChangeAt: Date.now(),
    })),

  recordPong: (timestamp = Date.now()) => set({ lastPongAt: timestamp }),

  recordFeedEvent: (market, feed, timestamp = Date.now()) =>
    set((current) => ({
      feedsByMarket: {
        ...current.feedsByMarket,
        [market]: {
          ...current.feedsByMarket[market],
          [feed]: timestamp,
        },
      },
    })),

  getMarketFeedHealth: (market) => {
    const state = get();
    if (state.connectionState !== "connected") {
      return {
        isFresh: false,
        ageMs: null,
        staleReason: "disconnected" as const,
      };
    }

    const feeds = state.feedsByMarket[market];
    const lastFeedAt = Math.max(
      feeds?.orderbook ?? 0,
      feeds?.trades ?? 0,
      feeds?.ticker ?? 0
    );

    if (!lastFeedAt) {
      return {
        isFresh: false,
        ageMs: null,
        staleReason: "silent_feed" as const,
      };
    }

    const ageMs = Date.now() - lastFeedAt;
    return {
      isFresh: ageMs < FEED_STALE_AFTER_MS,
      ageMs,
      staleReason: ageMs < FEED_STALE_AFTER_MS ? null : ("silent_feed" as const),
    };
  },
}));
