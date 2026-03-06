import { connect, disconnect } from "@starknet-io/get-starknet";
import { RpcProvider, WalletAccount } from "starknet";
import { create } from "zustand";

export type WalletState = {
  isConnecting: boolean;
  isConnected: boolean;
  address: string | null;
  walletName: string | null;
  account: WalletAccount | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
};

const RPC_URL = import.meta.env.VITE_STARKNET_RPC_URL ?? "";

function getInitialWalletState() {
  if (typeof window === "undefined") {
    return { address: null, walletName: null, isConnected: false };
  }

  const address = window.localStorage.getItem("starknet-address");
  const walletName = window.localStorage.getItem("starknet-wallet-name");
  return {
    address,
    walletName,
    isConnected: Boolean(address),
  };
}

export const useWallet = create<WalletState>()((set, get) => {
  const initial = getInitialWalletState();

  return {
    isConnecting: false,
    isConnected: initial.isConnected,
    address: initial.address,
    walletName: initial.walletName,
    account: null,

    connectWallet: async () => {
      const state = get();
      if (state.isConnecting || state.isConnected) return;

      set({ isConnecting: true });
      try {
        const swo = await connect({
          modalMode: "alwaysAsk",
          modalTheme: "dark",
        });
        if (!swo) {
          throw new Error("Failed to connect Starknet wallet");
        }

        const provider = new RpcProvider({ nodeUrl: RPC_URL });
        const walletAccount = await WalletAccount.connect(provider, swo);
        const address = walletAccount.address;
        const walletName = swo.name ?? null;

        window.localStorage.setItem("starknet-address", address);
        window.localStorage.setItem("starknet-wallet-name", walletName ?? "");

        set({
          address,
          walletName,
          isConnected: Boolean(address),
          isConnecting: false,
          account: walletAccount,
        });
      } finally {
        set({ isConnecting: false });
      }
    },

    disconnectWallet: async () => {
      try {
        await disconnect({ clearLastWallet: true });
      } catch {
        return;
      } finally {
        window.localStorage.removeItem("starknet-address");
        window.localStorage.removeItem("starknet-wallet-name");
        set({
          address: null,
          walletName: null,
          isConnected: false,
          isConnecting: false,
          account: null,
        });
      }
    },
  };
});
