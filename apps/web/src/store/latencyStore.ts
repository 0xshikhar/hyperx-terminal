import { create } from "zustand";

export type LatencyData = {
  wsPing: number | null;
  apiLatency: number | null;
  lastUpdate: number | null;
};

type LatencyStore = {
  latency: LatencyData;
  setWsPing: (ping: number) => void;
  setApiLatency: (latency: number) => void;
};

export const useLatencyStore = create<LatencyStore>((set) => ({
  latency: {
    wsPing: null,
    apiLatency: null,
    lastUpdate: null,
  },
  setWsPing: (ping) =>
    set((state) => ({
      latency: {
        ...state.latency,
        wsPing: ping,
        lastUpdate: Date.now(),
      },
    })),
  setApiLatency: (latency) =>
    set((state) => ({
      latency: {
        ...state.latency,
        apiLatency: latency,
        lastUpdate: Date.now(),
      },
    })),
}));
