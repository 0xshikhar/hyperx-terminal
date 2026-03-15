import { create } from "zustand";
import type { ConnectionState, WSConnectionEvent } from "@/services/wsClient";

type FeedTimestamps = {
  orderbook?: number;
  trades?: number;
  ticker?: number;
  status?: number;
};

type ReconnectPlan = {
  attempt: number;
  delayMs: number;
  scheduledAt: number;
  reconnectAt: number;
} | null;

type DisconnectSnapshot = {
  at: number;
  code: number;
  reason: string;
} | null;

type RuntimeHealthState = {
  connectionState: ConnectionState;
  reconnectCount: number;
  lastConnectionChangeAt: number | null;
  lastPongAt: number | null;
  lastErrorAt: number | null;
  lastSocketEventAt: number | null;
  reconnectPlan: ReconnectPlan;
  lastDisconnect: DisconnectSnapshot;
  feedsByMarket: Record<string, FeedTimestamps>;
  setConnectionState: (state: ConnectionState) => void;
  recordConnectionEvent: (event: WSConnectionEvent) => void;
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
  lastErrorAt: null,
  lastSocketEventAt: null,
  reconnectPlan: null,
  lastDisconnect: null,
  feedsByMarket: {},

  setConnectionState: (state) =>
    set({
      connectionState: state,
      lastConnectionChangeAt: Date.now(),
    }),

  recordConnectionEvent: (event) =>
    set((current) => {
      const base = {
        lastSocketEventAt: event.timestamp,
      };

      switch (event.type) {
        case "connect_start":
          return base;
        case "open":
          return {
            ...base,
            reconnectPlan: null,
          };
        case "close":
          return {
            ...base,
            reconnectPlan: event.willReconnect ? current.reconnectPlan : null,
            lastDisconnect: {
              at: event.timestamp,
              code: event.code,
              reason: event.reason,
            },
          };
        case "error":
          return {
            ...base,
            lastErrorAt: event.timestamp,
          };
        case "reconnect_scheduled":
          return {
            ...base,
            reconnectCount: current.reconnectCount + 1,
            reconnectPlan: {
              attempt: event.attempt,
              delayMs: event.delayMs,
              scheduledAt: event.timestamp,
              reconnectAt: event.reconnectAt,
            },
          };
        case "manual_disconnect":
          return {
            ...base,
            reconnectPlan: null,
          };
      }
    }),

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
