import { create } from "zustand";

export type LatencySample = {
  timestamp: number;
  value: number;
};

export type LatencyData = {
  wsPing: number | null;
  apiLatency: number | null;
  lastUpdate: number | null;
  wsHistory: LatencySample[];
  apiHistory: LatencySample[];
};

type LatencyStore = {
  latency: LatencyData;
  setWsPing: (ping: number) => void;
  setApiLatency: (latency: number) => void;
};

const MAX_SAMPLES = 60;

function pushSample(history: LatencySample[], value: number) {
  return [...history.slice(-(MAX_SAMPLES - 1)), { timestamp: Date.now(), value }];
}

export const useLatencyStore = create<LatencyStore>((set) => ({
  latency: {
    wsPing: null,
    apiLatency: null,
    lastUpdate: null,
    wsHistory: [],
    apiHistory: [],
  },
  setWsPing: (ping) =>
    set((state) => ({
      latency: {
        ...state.latency,
        wsPing: ping,
        lastUpdate: Date.now(),
        wsHistory: pushSample(state.latency.wsHistory, ping),
      },
    })),
  setApiLatency: (latency) =>
    set((state) => ({
      latency: {
        ...state.latency,
        apiLatency: latency,
        lastUpdate: Date.now(),
        apiHistory: pushSample(state.latency.apiHistory, latency),
      },
    })),
}));
