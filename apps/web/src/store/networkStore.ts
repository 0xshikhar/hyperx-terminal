import { create } from "zustand";
import type { ParadexNetwork } from "@hyperx/types/common";

const STORAGE_KEY = "hyperx-trading-mode";

export type TradingMode = "testnet" | "mainnet" | "paper";

function getInitialMode(): TradingMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "testnet" || stored === "mainnet" || stored === "paper") return stored;
    // Fallback to legacy key if present
    const legacy = localStorage.getItem("hyperx-paradex-network");
    if (legacy === "testnet" || legacy === "mainnet") return legacy;
  } catch {
    // localStorage unavailable
  }
  return "paper"; // Default to paper so first-time visitors can trade immediately
}

type NetworkState = {
  network: ParadexNetwork;
  tradingMode: TradingMode;
  setTradingMode: (mode: TradingMode) => void;
  setNetwork: (network: ParadexNetwork) => void;
  isTestnet: boolean;
  isMainnet: boolean;
  isPaperTrading: boolean;
};

const initialMode = getInitialMode();
const initialNetwork: ParadexNetwork = initialMode === "mainnet" ? "mainnet" : "testnet";

export const useNetworkStore = create<NetworkState>()((set) => ({
  network: initialNetwork,
  tradingMode: initialMode,
  isTestnet: initialMode === "testnet",
  isMainnet: initialMode === "mainnet",
  isPaperTrading: initialMode === "paper",

  setTradingMode: (mode: TradingMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* localStorage unavailable */
    }
    const network: ParadexNetwork = mode === "mainnet" ? "mainnet" : "testnet";
    set({
      tradingMode: mode,
      network,
      isTestnet: mode === "testnet",
      isMainnet: mode === "mainnet",
      isPaperTrading: mode === "paper",
    });
  },

  setNetwork: (network: ParadexNetwork) => {
    try {
      localStorage.setItem(STORAGE_KEY, network);
    } catch {
      /* localStorage unavailable */
    }
    set({
      tradingMode: network,
      network,
      isTestnet: network === "testnet",
      isMainnet: network === "mainnet",
      isPaperTrading: false,
    });
  },
}));
