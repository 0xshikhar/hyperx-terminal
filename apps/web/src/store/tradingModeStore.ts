import { create } from "zustand";

export type TradingMode = "real" | "paper" | "demo";

const STORAGE_KEY = "hyperx-trading-mode";

function getInitialMode(): TradingMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "real" || stored === "paper" || stored === "demo") return stored;
  } catch {}
  return "demo";
}

type TradingModeState = {
  mode: TradingMode;
  setMode: (mode: TradingMode) => void;
  isReal: boolean;
  isPaper: boolean;
  isDemo: boolean;
};

export const useTradingModeStore = create<TradingModeState>()((set) => ({
  mode: getInitialMode(),
  setMode: (mode) => {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
    set({ mode, isReal: mode === "real", isPaper: mode === "paper", isDemo: mode === "demo" });
  },
  get isReal() { return false; },
  get isPaper() { return false; },
  get isDemo() { return false; },
}));

useTradingModeStore.setState({
  isReal: useTradingModeStore.getState().mode === "real",
  isPaper: useTradingModeStore.getState().mode === "paper",
  isDemo: useTradingModeStore.getState().mode === "demo",
});
