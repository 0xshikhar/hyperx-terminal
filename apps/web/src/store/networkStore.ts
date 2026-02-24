import { create } from "zustand";
import type { ParadexNetwork } from "@hyperx/types/common";

const STORAGE_KEY = "hyperx-paradex-network";

function getInitialNetwork(): ParadexNetwork {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "testnet" || stored === "mainnet") return stored;
  } catch {}
  return "testnet";
}

type NetworkState = {
  network: ParadexNetwork;
  setNetwork: (network: ParadexNetwork) => void;
  isTestnet: boolean;
  isMainnet: boolean;
};

export const useNetworkStore = create<NetworkState>()((set) => ({
  network: getInitialNetwork(),
  setNetwork: (network) => {
    try { localStorage.setItem(STORAGE_KEY, network); } catch {}
    set({ network, isTestnet: network === "testnet", isMainnet: network === "mainnet" });
  },
  get isTestnet() { return false; },
  get isMainnet() { return false; },
}));

useNetworkStore.setState({
  isTestnet: useNetworkStore.getState().network === "testnet",
  isMainnet: useNetworkStore.getState().network === "mainnet",
});
